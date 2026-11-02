<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Project rules
- Genossociograma: CLIENTE E IRMÃOS SEMPRE NO TOPO (geração 0, menor Y); pais abaixo, avós abaixo dos pais. Never invert to ancestors-on-top. Every person links to its parents through the correct UnionNode. Guarded by `src/lib/geno/invariants.test.ts` — run `bunx vitest run` before changing `src/lib/geno/*`.
- Clinical hypotheses come only from `src/lib/evidence.ts` (built on `detectPatterns`); no fixed fallbacks, no simulated chat, no numeric confidence — why: hypotheses must be traceable to recorded evidence.
- Evidence queries share the React Query key `["clinical-intel", clientId]` so dossier and IA Clínica invalidate together.
