"""
Regressão visual e estrutural do Genossociograma.

Roda o canvas em múltiplas resoluções (1080p e 4K por padrão) e valida:

  1) Cliente centralizado horizontalmente no canvas.
  2) Pelo menos um nó do ramo paterno acima e à esquerda do cliente,
     e pelo menos um do ramo materno acima e à direita.
  3) Todos os nós de pessoa renderizam nome com bounding box > 0
     (sem clipping/colapso — invariante de legibilidade).
  4) Nenhum erro de runtime no console.
  5) Screenshot salvo por viewport.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from playwright.async_api import Page, async_playwright

DEFAULT_CLIENT_ID = "72257c9a-6515-436b-8159-bc00c624e653"
BASE_URL = "http://localhost:8080"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORTS: dict[str, tuple[int, int]] = {
    "1080p": (1920, 1080),
    "1440p": (2560, 1440),
    "4k": (3840, 2160),
}


@dataclass
class Failure:
    viewport: str
    check: str
    detail: str


async def restore_supabase_session(page: Page) -> None:
    """Injeta a sessão Supabase gerenciada, se disponível."""
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if status != "injected":
        return

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await page.context.add_cookies(cookies)

    await page.goto(BASE_URL, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def collect_person_nodes(page: Page) -> list[dict]:
    """Retorna {id, x, y, w, h, label_w, label_h, name, is_proband} para cada nó.

    Usa offsetWidth/Height para o label (tamanho intrínseco, ignora o
    transform do React Flow) e getBoundingClientRect para posição na tela.
    """
    return await page.evaluate(
        """
        () => {
          const nodes = Array.from(document.querySelectorAll('.react-flow__node-person'));
          return nodes.map(node => {
            const r = node.getBoundingClientRect();
            const labelEl = node.querySelector('p.font-sans, p');
            const name = labelEl ? labelEl.textContent.trim() : '';
            const isProband = Array.from(node.querySelectorAll('span'))
              .some(s => s.textContent.trim().toLowerCase() === 'cliente');
            return {
              id: node.getAttribute('data-id'),
              x: r.x + r.width / 2,
              y: r.y + r.height / 2,
              w: r.width,
              h: r.height,
              // offset* = tamanho intrínseco em px CSS, sem CSS transform
              label_w: labelEl ? labelEl.offsetWidth : 0,
              label_h: labelEl ? labelEl.offsetHeight : 0,
              name,
              is_proband: isProband,
            };
          });
        }
        """
    )



async def run_viewport(
    playwright,
    client_id: str,
    viewport_name: str,
    size: tuple[int, int],
) -> list[Failure]:
    failures: list[Failure] = []
    width, height = size
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(viewport={"width": width, "height": height})
    page = await context.new_page()

    console_errors: list[str] = []
    page.on(
        "console",
        lambda msg: console_errors.append(msg.text)
        if msg.type == "error"
        else None,
    )

    try:
        await restore_supabase_session(page)

        target = f"{BASE_URL}/app/clientes/{client_id}"
        await page.goto(target, wait_until="networkidle")

        # Aciona a aba do Genossociograma se existir
        try:
            tab = page.get_by_role("tab", name="Genossociograma")
            if await tab.count() > 0:
                await tab.first.click()
        except Exception:
            pass

        # Espera o canvas do React Flow existir
        await page.wait_for_selector(".react-flow", timeout=15_000)
        # Aguarda a animação de fitView + setCenter (700ms + margem)
        await page.wait_for_timeout(1_500)

        await page.screenshot(path=str(SCREENSHOTS / f"{viewport_name}.png"))

        persons = await collect_person_nodes(page)

        # ── Check 1: pelo menos alguns nós de pessoa
        if len(persons) < 3:
            failures.append(
                Failure(viewport_name, "person-nodes-count",
                        f"esperava ≥ 3 nós de pessoa, encontrei {len(persons)}")
            )
            return failures

        # ── Check 2: legibilidade — todo label com dimensões > 0
        for p in persons:
            if p["label_w"] < 20 or p["label_h"] < 10:
                failures.append(Failure(
                    viewport_name,
                    "label-legibility",
                    f"nó {p['id'][:8]} ('{p['name']}') com label {p['label_w']:.0f}x{p['label_h']:.0f}px",
                ))

        # ── Check 3: proband existe e está horizontalmente centralizado
        proband = next((p for p in persons if p["is_proband"]), None)
        if not proband:
            failures.append(Failure(viewport_name, "proband-missing",
                                    "nenhum nó marcado como Cliente foi encontrado"))
            return failures

        canvas_center_x = width / 2
        # tolerância: 12% da largura do viewport
        tolerance_x = width * 0.12
        if abs(proband["x"] - canvas_center_x) > tolerance_x:
            failures.append(Failure(
                viewport_name, "proband-centered",
                f"cliente em x={proband['x']:.0f}, esperado ~{canvas_center_x:.0f} "
                f"(±{tolerance_x:.0f})",
            ))

        # ── Check 4: existe nó acima E à esquerda do proband (ramo paterno)
        above = [p for p in persons if p["y"] < proband["y"] - 20 and not p["is_proband"]]
        left_of_proband = [p for p in above if p["x"] < proband["x"] - 10]
        right_of_proband = [p for p in above if p["x"] > proband["x"] + 10]

        if not left_of_proband:
            failures.append(Failure(
                viewport_name, "ramo-paterno-esquerda",
                "nenhum ancestral posicionado à esquerda do cliente",
            ))
        if not right_of_proband:
            failures.append(Failure(
                viewport_name, "ramo-materno-direita",
                "nenhum ancestral posicionado à direita do cliente",
            ))

        # ── Check 5: nenhum erro no console (filtra ruído conhecido)
        real_errors = [e for e in console_errors
                       if "data-tsd" not in e
                       and "code-split" not in e.lower()
                       and "hydrat" not in e.lower()
                       and "failed to load resource" not in e.lower()
                       and "403" not in e
                       and "404" not in e]
        if real_errors:
            failures.append(Failure(
                viewport_name, "console-errors",
                f"{len(real_errors)} erro(s): {real_errors[0][:200]}",
            ))


    finally:
        await browser.close()

    return failures


async def main(client_id: str, viewports: Iterable[str]) -> int:
    all_failures: list[Failure] = []
    async with async_playwright() as pw:
        for vp_name in viewports:
            if vp_name not in VIEWPORTS:
                print(f"⚠️  viewport desconhecido: {vp_name} (opções: {list(VIEWPORTS)})")
                continue
            size = VIEWPORTS[vp_name]
            print(f"\n▶ {vp_name} {size[0]}x{size[1]}")
            fails = await run_viewport(pw, client_id, vp_name, size)
            if not fails:
                print(f"  ✓ todos os invariantes ok")
            else:
                for f in fails:
                    print(f"  ✗ [{f.check}] {f.detail}")
                all_failures.extend(fails)

    print("\n" + "=" * 60)
    if all_failures:
        print(f"❌ {len(all_failures)} falha(s) — ver screenshots em {SCREENSHOTS}")
        return 1
    print(f"✅ Todos os viewports passaram — screenshots em {SCREENSHOTS}")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--client-id", default=DEFAULT_CLIENT_ID)
    ap.add_argument("--viewports", default="1080p,4k",
                    help=f"lista separada por vírgula. Opções: {list(VIEWPORTS)}")
    args = ap.parse_args()
    vps = [v.strip() for v in args.viewports.split(",") if v.strip()]
    sys.exit(asyncio.run(main(args.client_id, vps)))
