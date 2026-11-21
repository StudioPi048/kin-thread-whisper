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
- A marca vigente é a árvore circular escolhida por Pietro. Os traços do símbolo e do lettering vêm do mesmo PNG aprovado. Use `GenealizWordmark` em bronze sobre fundo claro e em dourado claro sobre verde. A versão vertical conserva a composição original. O favicon usa o símbolo.

## Capa pública e demonstração
A capa põe o dossiê em papel claro diante da apresentação em verde. O botão do exercício leva à família completa e a entrada na conta usa um link direto no cabeçalho e na abertura. O visitante pode alternar vínculos, cronologia e registros e abrir a ficha das quatro pessoas do recorte. O exercício completo carrega sob demanda, com a mesma família em 2D, 3D e cronologia. O visitante pode revisar uma filiação e desfazer, editar um nome e ajustar posições na própria geração. O estado do exercício fica em memória. A capa do Manual da Psicogenealogia vem do acervo editorial já usado no site de Letícia Baccin.

## Área de trabalho

- Navegação em verde de mata, com a seção ativa em papel claro, organizada em três grupos. A busca global reúne resultados por dossiês e páginas e o último ponto de trabalho fica no cabeçalho. No celular, as quatro seções principais ficam ao alcance do polegar e o restante abre em Mais.
- A Mesa começa pelo próximo atendimento e permite agendar no próprio painel quando não há sessão futura. O retorno aos dossiês e as pendências vêm abaixo. Índices de clientes, árvores e cronologias usam linhas com ações legíveis. As prévias das árvores carregam quando abertas.
- O dossiê organiza a identificação, os atalhos e as seções em duas faixas. O mapa usa controles dedicados para edição e câmera, com a ficha de filiação ao lado e uma gaveta em telas pequenas. Anamnese, sessões e evidências apresentam os registros em blocos delimitados por linhas.

## Acervo ilustrado da aplicação

- A Mesa apresenta a fotografia de um livro de arquivo com um ramo prensado. Uma ficha opaca sobre a cena traz o próximo atendimento. No celular, a ficha antecede a fotografia.
- A gravura de raízes acompanha dossiês e árvores. O relógio de bolso acompanha datas e cronologias, os livros marcam a Biblioteca e as chaves ficam na entrada das Evidências. São peças ilustrativas criadas para o Genealiz, servidas em WebP, com transparência preservada onde a arte é isolada.
- A aplicação usa linho quente para o fundo, papel creme para leitura, manilha e sálvia para agrupamento. As imagens ficam em espaços próprios das capas e cabeçalhos. O campo de edição usa uma superfície lisa e deixa nomes e vínculos em primeiro plano.

## Cores
- **Verde profundo (`forest`, `forest-mid`)**: orientação — navegação, botão principal, foco, seleção.
- **Superfícies de leitura**: a capa pública usa os neutros de arquivo. A área autenticada usa `workspace-linen`, `workspace-sheet`, `workspace-manila` e `workspace-sage`, declarados com os demais tokens em `src/styles.css` e aplicados em `workspace-shell.css`.
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

O mapa abre com o campo de trabalho ocupando a largura disponível. A ficha aparece ao selecionar uma pessoa ou usar seu botão. A vista 3D abre de frente, com a árvore inteira enquadrada, e oferece um atalho para a perspectiva. Os cartões claros permanecem voltados para leitura à medida que a câmera inclina. Separar vínculos usa pontes desenhadas em profundidade para distinguir cruzamentos sem alterar as filiações. Abrir uniões desloca as junções de um familiar em profundidade e mostra os filhos de cada par, com cada pessoa representada uma vez. As cores dos trajetos distinguem os ramos quando o parentesco os identifica. O índice de nomes aproxima a câmera do familiar escolhido.

No quadro verde, o enquadramento por ramo usa o parentesco do grafo e mantém a geração do consultante como referência. O foco em um núcleo segue as uniões e filiações registradas. Os demais familiares permanecem no mapa e disponíveis para seleção. A perspectiva conserva o foco em uso e o retorno à árvore inteira repõe o panorama. A ficha do 3D reúne a edição da pessoa, a revisão de filiação e a navegação pelos vínculos próximos.

Arrastar o fundo no board desloca a câmera. Mover pessoa ajusta a posição horizontal do cartão na própria geração.

A Órbita 3D apresenta a mesma árvore em planos espaciais por geração. O arraste gira a câmera em torno da árvore, com inclinação limitada para preservar o topo. Os nomes completos acompanham a câmera em cartões voltados para quem lê. Enquadrar a árvore, escolher um ramo e focar uma pessoa são ações reversíveis de navegação. A ficha, o histórico e os comandos de filiação usam o mesmo estado nas três vistas.

## Linha do tempo do dossiê
Em telas largas, lista cronológica compacta à esquerda e gráfico temporal à direita, com trilhos por tipo de evento. A seleção sincroniza os dois lados. Registros sem data ficam na lista; datas parciais ocupam uma faixa. No celular, o gráfico precede a lista.
