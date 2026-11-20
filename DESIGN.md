---
name: "GENEALIZ — Arquivo vivo"
description: "Relações familiares em um espaço de trabalho profissional, claro e legível."
colors: {"forest": "#253c38", "forest-mid": "#36534b", "forest-soft": "#59706a", "forest-mist": "#e8ede7", "gold": "#cba56b", "gold-soft": "#dfbe8c", "gold-muted": "#f0e3ca", "bronze": "#7e572a", "archive": "#f6f6f4", "archive-old": "#ecece8", "archive-doc": "#ffffff", "ink": "#253430", "ink-soft": "#59665e", "warm-gray": "#647169", "border": "#dddcd3", "input": "#c8cdc3", "clinical-critical": "#8b3a3a", "clinical-warning": "#8a6407"}
typography: {"editorial": "Cormorant Garamond — só títulos editoriais", "ui": "Inter — controles, dados, nomes, tabelas", "body": "15–16px, entrelinha 1.6", "label": "14px mínimo"}
---

# Design System: GENEALIZ — Arquivo vivo

Direção única e vigente. A direção "Atlas" (azul/âmbar) foi rejeitada; seus valores foram removidos de `:root`. Classes CSS com prefixo `atlas-` são apenas nomes legados de estrutura (shell, nav) e usam os tokens abaixo.

## Fonte da verdade
- Tokens: **um único bloco `:root`** em `src/styles.css`. Não criar segundo `:root` nem overrides por hex; usar `var(--token)` / utilitários (`bg-forest`, `text-ink`, `border-border`).
- Fotografia familiar (`public/assets/genealiz/*`) e logo/wordmark são preservados.

## Revisão da capa pública — 02/11/2026
Pietro rejeitou o diagrama SVG de exemplo: linhas atravessavam nomes e a composição era inadequada para a capa. `GenogramDemo` foi removido; não recolocar uma variação reduzida. A seção pública usa detalhe da fotografia de arquivo existente. O mapa operacional continua na plataforma, sujeito às invariantes abaixo. A nova seção fotográfica ainda não tem aprovação estética do usuário registrada.

## Cores
- **Verde profundo (`forest`, `forest-mid`)**: orientação — navegação, botão principal, foco, seleção.
- **Superfícies neutras (`archive`, `archive-doc` branco, `archive-old`)**: área de trabalho clara, sem textura, pergaminho, gradiente ou brilho decorativo.
- **Bronze/dourado (`bronze`, `gold`)**: poucos destaques. `gold` só sobre fundo verde; sobre branco use `bronze`.
- **Estados**: `clinical-critical` (erro/destrutivo), `clinical-warning` (atenção). Nunca usar cor como único sinal.

## Contraste medido (WCAG 2.1, fórmula de luminância relativa)
| Par | Razão |
|---|---|
| ink sobre archive | 12.04 |
| ink-soft sobre archive | 5.57 |
| warm-gray sobre archive | 4.72 |
| warm-gray sobre branco | 5.11 |
| texto archive sobre botão forest | 10.89 |
| bronze sobre branco | 6.39 |
| gold sobre forest | 5.13 |
| clinical-warning sobre branco | 5.38 |
| clinical-critical sobre branco | 7.60 |

Todos ≥ 4.5 (AA texto normal). Não usar `gold` sobre branco nem opacidades `/50` em texto.
Essas razões verificam os pares definidos, não certificam todas as combinações e estados da interface.

## Tipografia (modo Operate)
- Inter em controles, dados, nomes, tabelas; mínimo 14px, corpo 15–16px.
- Cormorant Garamond apenas em títulos editoriais (um título por página).
- Um título e uma ação principal por tela.

## Interação
- Alvos de toque ≥ 44px; foco visível (anel 2px `ring`).
- `prefers-reduced-motion` reduz animações a 0.01ms.
- Mobile 390px funcional: navegação inferior; painéis laterais viram drawer sem ocultar ações.

## Genossociograma (inviolável)
O consultante e os irmãos consanguíneos ocupam o topo. Pais, avós e antepassados descem em faixas. Cada parentesco usa o grafo comum. O arranjo automático aproxima o eixo de cada casal da fratria correspondente e mantém cada par de antepassados junto, com espaço para distinguir as uniões vizinhas. Cartões opacos protegem nomes e datas das linhas. Os nomes completos quebram em linhas no 2D e no 3D, inclusive no panorama. As sugestões de filiação têm traço pontilhado em bronze e exigem confirmação na ficha. O traço horizontal superior marca falecimento, segundo o Manual da Psicogenealogia, p. 164. A ficha escreve a natureza da filiação ao lado do vínculo.

A vista 3D abre de frente, com a árvore inteira enquadrada. Os cartões permanecem voltados para leitura enquanto a câmera inclina. Separar vínculos usa pontes desenhadas em profundidade para distinguir cruzamentos sem alterar as filiações. Abrir uniões desloca as junções de um familiar em profundidade e mostra os filhos de cada par, com cada pessoa representada uma vez. As cores dos trajetos distinguem os ramos quando o parentesco os identifica. O índice de nomes aproxima a câmera do familiar escolhido.

Arrastar o fundo desloca a câmera. Mover pessoa ajusta a posição horizontal do cartão na própria geração. A edição de posições, o histórico e os comandos de filiação usam o mesmo estado nas duas vistas.

## Linha do tempo do dossiê
Em telas largas, lista cronológica compacta à esquerda e gráfico temporal à direita, com trilhos por tipo de evento. A seleção sincroniza os dois lados. Registros sem data ficam na lista; datas parciais ocupam uma faixa. No celular, o gráfico precede a lista.
