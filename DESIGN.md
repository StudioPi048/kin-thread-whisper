---
name: "GENEALIZ — Atlas familiar"
description: "Relações familiares em um espaço de trabalho profissional."
colors: {"forest": "#17273a", "forest-mid": "#243b53", "forest-soft": "#405b76", "forest-mist": "#eaf0f6", "gold": "#dbac67", "gold-soft": "#e7bf86", "gold-muted": "#f4e6d0", "archive": "#f5f7fa", "archive-doc": "#ffffff", "ink-soft": "#4c6179", "warm-gray": "#53677e", "border": "#d8e1ea", "input": "#bdcada", "clinical-critical": "#8b3a3a"}
typography: {"display": {"fontFamily": "Cormorant Garamond, ui-serif, Georgia, serif", "fontSize": "clamp(3rem, 6vw, 6rem)", "fontWeight": 600, "lineHeight": 1, "letterSpacing": "-0.025em"}, "headline": {"fontFamily": "Cormorant Garamond, ui-serif, Georgia, serif", "fontSize": "42px", "fontWeight": 600, "lineHeight": 1.04, "letterSpacing": "-0.02em"}, "title": {"fontFamily": "Cormorant Garamond, ui-serif, Georgia, serif", "fontSize": "27px", "fontWeight": 600, "lineHeight": 1.15}, "body": {"fontFamily": "Inter, ui-sans-serif, system-ui, sans-serif", "fontSize": "15px", "lineHeight": 1.65}, "label": {"fontFamily": "Inter, ui-sans-serif, system-ui, sans-serif", "fontSize": "14px", "fontWeight": 600}}
rounded: {"chip": "4px", "nav": "5px", "sm": "6px", "md": "8px", "lg": "12px", "xl": "16px", "2xl": "20px"}
spacing: {"2": "8px", "3": "12px", "4": "16px", "5": "20px", "6": "24px"}
components: {"button-default": {"backgroundColor": "{colors.forest}", "textColor": "{colors.archive}", "rounded": "{rounded.md}", "height": "44px", "padding": "8px 20px"}, "button-gold": {"backgroundColor": "{colors.gold}", "textColor": "{colors.forest}", "rounded": "{rounded.md}", "height": "44px", "padding": "8px 20px"}, "button-gold-hover": {"backgroundColor": "{colors.gold-soft}"}, "button-outline": {"backgroundColor": "{colors.archive-doc}", "textColor": "{colors.forest}", "rounded": "{rounded.md}", "height": "44px", "padding": "8px 20px"}, "input": {"backgroundColor": "{colors.archive-doc}", "textColor": "{colors.forest}", "rounded": "{rounded.md}", "height": "44px", "padding": "0 12px"}, "nav-item": {"rounded": "{rounded.nav}", "padding": "13px 10px"}, "chip": {"backgroundColor": "{colors.forest-mist}", "textColor": "{colors.ink-soft}", "rounded": "{rounded.chip}", "padding": "4px 8px"}, "dossier-card": {"backgroundColor": "{colors.archive-doc}", "rounded": "{rounded.lg}", "padding": "22px"}}
---

# Design System: GENEALIZ

## Overview

**Creative North Star: "Atlas familiar"**

Atlas familiar organiza pessoas, vínculos e registros com navegação azul profundo, superfícies claras de leitura e âmbar para destaque. Títulos editoriais em serifa marcam contexto; Inter mantém formulários e controles legíveis. O desenho é preciso, plano e contido, sem brilho ornamental nem significado clínico atribuído à posição visual.

Direção **Atlas familiar** e composição **Mapa em primeiro plano** aprovadas por Pietro em 06/10/2026. Este documento consolida o seed da mesma sessão com o código implementado. Implementação local concluída nas páginas do aplicativo, entrada pública e autenticação; revisão final PASS comunicada pelo revisor, com os apontamentos materiais resolvidos. **Ainda não publicada.** Regra obrigatória preservada do motor original: cliente no topo, pais abaixo, avós abaixo dos pais; filiação sempre passa pela união dos respectivos pais. A orientação não é uma limitação. O preview usa dados fictícios calculados pelo motor original, sem posições manuais impostas; a IA clínica permanece demonstrativa.

Fontes: `src/styles.css`, componentes compartilhados de botão, campo, dossiê e cabeçalho, contrato em `src/routes/__root.tsx`, `PRODUCT.md`, `design/restructure/brief.md` e capturas `map-desktop.jpg`, `map-mobile.jpg`, `biblioteca-desktop.jpg` em `design/restructure/screenshots/`. A composição aprovada é uma expressão do sistema; páginas de acervo e leitura usam sua própria organização.

**Key Characteristics:**

- Navegação azul profundo e registros claros.
- Serifa editorial nos títulos; sans nos controles.
- Bordas finas, cantos contidos e relações identificáveis.

## Colors

Azul profundo sustenta orientação, âmbar sinaliza destaque e os neutros frios sustentam leitura. O frontmatter contém os valores normativos extraídos; nomes históricos `forest` e `gold` são preservados para acompanhar o código.

### Primary

- **Azul do atlas — forest:** navegação, campo do mapa, texto principal e botão padrão.
- **Azuis de apoio — forest-mid / forest-soft:** busca, controles do mapa e foco de componentes.

### Secondary

- **Âmbar — gold / gold-soft / gold-muted:** ação destacada, seleção e estados de apoio; não é sinal clínico.
- **Crítico — clinical-critical:** ações destrutivas e comunicação de erro.

### Neutral

- **Arquivo claro — archive / archive-doc:** fundo e campos brancos.
- **Névoa azul — forest-mist:** estados secundários e etiquetas.
- **Texto auxiliar — warm-gray / ink-soft:** metadados e descrições.
- **Linhas — border / input:** separação e limites de campos.

## Typography

Cormorant Garamond e Inter são carregadas localmente via Fontsource. O wordmark GENEALIZ usa a família editorial; controles usam a família sans.

- **Display:** classe de títulos amplos definida no frontmatter. A entrada pública usa uma escala própria (`clamp(42px, 4.3vw, 70px)`, peso 500, entrelinha 1.06).
- **Headline:** título de página do frontmatter, reduzido a 34px abaixo de 768px.
- **Title:** nome em dossiê; a ficha do mapa usa 32px e itens de biblioteca usam 25px.
- **Body:** leitura com entrelinha confortável; subtítulo de página usa 14px e largura máxima 74ch.
- **Label:** controles 14px; navegação 13px; metadados 11–12px conforme contexto.

## Layout

Shell desktop em grade com coluna de navegação de 220px, ou 76px recolhida, e conteúdo flexível. Sidebar fixa durante rolagem e barra superior de 72px. Contêiner de conteúdo até 1600px com margens internas `clamp(18px, 2.5vw, 40px)`.

Abaixo de 1024px, a sidebar dá lugar à navegação inferior; a barra superior tem 64px e o conteúdo reserva 80px ao rodapé. A navegação inferior respeita a área segura do dispositivo. Abaixo de 768px, cabeçalhos empilham ações; mapa e ficha ficam em coluna, com área de trabalho do mapa de 580px e ficha de até 460px com rolagem. A biblioteca passa de índice de 205px mais lista flexível para categorias horizontais e lista única. Abas podem rolar horizontalmente.

## Elevation & Depth

Superfícies do Atlas usam preenchimento e borda, sem sombra estrutural. Os utilitários de sombra surface/dossier/gold foram neutralizados. Permanecem sombras discretas `shadow-lifted` e `shadow-hover` para consumidores existentes; valores completos estão no sidecar. O componente legado Card ainda contém superfície quente e sombra: é uma exceção do código, não o padrão dos dossiês Atlas.

Movimento predominante: transições de cor em 150ms. Skeleton pulsa em 1.6s; a preferência de redução de movimento reduz animações e transições para 0.01ms e remove rolagem suave.

## Shapes

Etiquetas pequenas usam cantos de 4px; navegação e controles de mapa, 5px. Botões e campos compartilhados usam o token md de 8px; CTAs públicos usam 6px. Painéis Atlas e dossiês usam 12px. Linhas de separação são de 1px. Pessoas do genograma mantêm símbolos próprios do motor; a reforma visual não redefine a semântica desses símbolos.

## Components

### Buttons

Botão padrão azul, destaque gold/hero âmbar, outline branco com borda de campo; variantes secondary, ghost, link, forest e destructive permanecem no componente compartilhado. Altura padrão 44px; pequeno 36px, grande 48px, extra grande 56px. Hover altera cor; foco tem contorno de 2px com afastamento de 2px. Desabilitado reduz opacidade à metade e bloqueia interação. CTAs públicos têm padding de 13px por 24px e raio de 6px.

### Chips

Etiqueta Atlas compacta com fundo secundário, texto ink-soft e tipografia de 11px. Estados devem ter rótulo explícito. O Badge genérico também permanece disponível; não confundir sua variante padrão sombreada com a etiqueta Atlas.

### Cards / Containers

Dossiê branco, borda fina, padding 22px, intervalo interno 16px; hover escurece a borda. Nome editorial, detalhes em sans, rodapé separado por linha e ações de gestão existentes. No celular, padding 20px. Seções de formulário usam 24px no desktop e 20px no celular.

### Inputs / Fields

Campo branco com borda input, altura 44px, padding horizontal 12px, texto de 14px e placeholder auxiliar. Foco usa o contorno ring; estado desabilitado tem opacidade reduzida e cursor de indisponibilidade.

### Navigation

Links desktop têm altura mínima 46px, texto de 13px e ícones; a seleção usa âmbar suave, fundo translúcido e linha interna à esquerda, com `aria-current`. Hover clareia o fundo. Mobile mantém rótulos e acesso às áreas adicionais por Mais. Abas usam linha inferior no estado ativo, sem cartões ao redor dos títulos.

### Mapa e ficha

Campo azul com pessoas e vínculos do caso, controles de zoom e ficha clara contextual. A seleção orienta consulta e edição existentes. Rótulos de vínculos, legenda e metadados dão contexto; nenhuma relação deve ser deduzida apenas do posicionamento. Avisos de preview e demonstração pertencem ao estado real do produto.

## Do's and Don'ts

### Do:

- **Do** preservar os nomes e rótulos dos vínculos e complementar cor com texto ou forma.
- **Do** manter o aviso de dados fictícios visível no preview, acima da navegação móvel.
- **Do** reutilizar controles compartilhados, foco visível e redução de movimento.

### Don't:

- **Don't** usar astrologia, constelações ornamentais ou inferências clínicas inventadas.
- **Don't** aplicar brilho dourado, gradientes decorativos ou textura de pergaminho.
- **Don't** tratar dados fictícios do preview como validação do motor de parentescos.

## Revisão do usuário — 06/10/2026
A qualidade estética global foi questionada pelo usuário: aprovação de direção não equivale à aprovação da implementação. Priorizar refinamento conservador da base existente. Cartões de nome e datas do mapa têm fundo sólido e altura mínima de 72px para preservar leitura sobre conexões; não remover essa proteção.
