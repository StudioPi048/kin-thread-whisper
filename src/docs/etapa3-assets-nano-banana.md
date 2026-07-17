# Etapa 3 — Acervo de renders (Nano Banana)

> **STATUS (17/07/2026):** todos os 10 renders foram gerados pelo Pietro,
> otimizados (JPG, 55–670 KB) e integrados às telas. Os arquivos finais
> vivem em `public/assets/renders/*.jpg`. Este documento permanece como
> receita para regenerar ou expandir o acervo.
>
> Nota técnica: objetos fundem ao pergaminho com `mix-blend-darken` +
> máscara radial. Cuidado com ancestrais que criam stacking context
> (z-index/opacity/transform) — eles quebram o blend contra o fundo.

## Como funciona

1. Gere cada imagem no Nano Banana com o prompt indicado.
2. Salve com o **nome de arquivo exato** na pasta:
   `public/assets/renders/`
3. Avise o Claude Code — ele integra às telas e faz o commit/push.

## Regras de formato

- **Objetos**: fundo **branco puro (#FFFFFF)**, sem sombra dura no fundo. O site funde a imagem ao pergaminho com `mix-blend-darken` — por isso o branco puro é obrigatório (vira "transparente" visualmente).
- **Fundos (full-bleed)**: sem texto, sem pessoas em destaque, cantos escuros suaves.
- Resolução mínima: 2048 px no lado maior. JPG ou PNG.
- Nada de texto, marca-d'água ou logotipo dentro da imagem.

## DNA de estilo (prefixo de todo prompt de objeto)

> Museum-grade still-life photograph of [OBJETO], antique object from a family archive. Warm archival palette: aged bronze and copper, deep forest green accents, sepia and parchment tones. Soft diffused daylight from the upper left, subtle soft shadow, shallow depth of field. Centered composition, isolated on a seamless pure white background (#FFFFFF). No text, no watermark, no people. Photorealistic, ultra detailed, 4K.

## Lista de assets

| # | Arquivo | Formato | Onde entra |
|---|---------|---------|-----------|
| 1 | `arvore-genealogica-bronze.png` | 1:1 | Genossociogramas (hero + empty state) |
| 2 | `fio-heranca.png` | 16:9 | Linhas de Herança |
| 3 | `relogio-de-bolso.png` | 1:1 | Agenda (estado vazio) |
| 4 | `gaveta-arquivo.png` | 4:3 | Clientes (empty state) |
| 5 | `lupa-documentos.png` | 1:1 | Padrões / busca |
| 6 | `cerebro-raizes.png` | 1:1 | Segundo Cérebro |
| 7 | `tinteiro-pena.png` | 1:1 | Sessões / evoluções |
| 8 | `medalhao-retrato.png` | 1:1 | Dossiê do Paciente |
| 9 | `mesa-de-madeira.jpg` | 21:9 | Faixa de fundo da Mesa Clínica |
| 10 | `constelacao-floresta.jpg` | 16:9 | Painéis escuros (login, Briefing IA) |

### 1. arvore-genealogica-bronze.png

DNA de estilo + objeto:
> ...of a small sculptural family tree cast in aged bronze with copper patina, delicate branches ending in tiny oval frames, standing on a small parchment-wrapped base...

### 2. fio-heranca.png

> ...of a deep burgundy red silk thread loosely unspooling from an antique wooden bobbin, the thread forming gentle generational loops across the frame, with a small brass needle resting at its end... (wide horizontal composition, 16:9)

### 3. relogio-de-bolso.png

> ...of an open antique brass pocket watch with a cream porcelain dial and roman numerals, its chain curling softly around it, glass slightly reflecting warm light...

### 4. gaveta-arquivo.png

> ...of a vintage wooden card-catalog drawer half open, filled with aged ivory index cards with handwritten edges, a small brass label frame on the front...

### 5. lupa-documentos.png

> ...of a brass magnifying glass with a dark wooden handle resting over a folded aged letter with a faint sepia handwritten text (illegible), a corner of the letter lifting slightly...

### 6. cerebro-raizes.png

> Vintage scientific illustration, engraved etching style in sepia ink on aged ivory paper: a human brain seen in profile whose lower half dissolves into fine tree roots, extremely delicate crosshatched line work, warm bronze ink tone. Isolated on a seamless pure white background (#FFFFFF). No text, no watermark. Ultra detailed, 4K.

### 7. tinteiro-pena.png

> ...of a small crystal inkwell with deep green-black ink, a bronze fountain pen resting diagonally against it, one tiny ink drop on the white surface nearby...

### 8. medalhao-retrato.png

> ...of an open oval brass locket revealing a faded sepia portrait photograph of an anonymous ancestor (face softly blurred/indistinct), fine chain pooling beside it...

### 9. mesa-de-madeira.jpg (fundo, 21:9)

> Top-down photograph of a dark walnut wooden desk surface from a historical archive, rich warm grain, softly lit from the upper left, edges falling into gentle shadow vignette. Empty surface, no objects, no text. Subtle, calm, usable as a website background strip. Ultra detailed, 4K, 21:9.

### 10. constelacao-floresta.jpg (fundo escuro, 16:9)

> Abstract dark background in deep forest green (#12291F) with a very subtle constellation-like web of fine golden threads and tiny nodes suggesting a family tree seen as stars, extremely low contrast, elegant, almost invisible pattern, darker toward the edges. No text, no watermark. 4K, 16:9.

## Depois de gerar

Coloque tudo em `public/assets/renders/` com os nomes exatos e me avise. Integro cada peça na tela correspondente (com `mix-blend-darken` nos objetos e máscaras suaves nos fundos), otimizo o peso e subo via main.
