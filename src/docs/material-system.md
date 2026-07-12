# Sistema de Materiais — Instituto Liz

> Versão 1.0 · Passo 2.5 · Última atualização: 2026-07-12

Este documento registra o **Sistema de Materiais** da plataforma GeneaLiz/PsicoLink.  
O sistema define quais "superfícies" existem na interface, como devem ser usadas e quais comportamentos são proibidos.

A premissa central:
> A plataforma deve transmitir a sensação de um **arquivo histórico clínico de alta precisão** — não de um álbum vintage ou scrapbook.

---

## Princípio de Design

A identidade visual de arquivo histórico opera de forma **subliminar**, nunca literal.

| Correto | Incorreto |
|---|---|
| Tons de marfim e bege quente | Textura de papel rasgado |
| Borda esquerda em bronze | Fita adesiva em cards |
| Carimbo SVG discreto (48px, 0.72 opacidade) | Carimbo gigante ou rotacionado > 5° |
| Sombra multi-camada sutil | Sombra drop com spread excessivo |
| Serif italic em citações curtas (≤ 2 linhas) | Serif italic em blocos longos de texto |
| Número de registro como metadado | Número de registro como título principal |

---

## 1. Superfícies Estruturais

São os **recipientes** da interface — definem áreas, fundos e containers.

### `surface-archive`
- **Token CSS**: `--surface-archive: #F4F1EB`
- **Finalidade**: Fundo base global da plataforma. O "pergaminho arquivístico" que envolve tudo.
- **Uso permitido**: `background` de `<body>`, fundo de páginas, fundo de seções abertas.
- **Uso proibido**: cards, dialogs, qualquer elemento flutuante (use `surface-document`).
- **Contraste mínimo**: texto `var(--ink)` (#1A1714) sobre `#F4F1EB` → 12.4:1 ✅

### `surface-document`
- **Token CSS**: `--surface-document: #FAFAF7`
- **Finalidade**: Superfície de "papel clínico" para conteúdo principal.
- **Uso permitido**: toolbar, painéis de filtro, listas compactas, fundos de seção dentro de cards.
- **Uso proibido**: não substituir `surface-dossier` em cards de paciente.
- **Contraste mínimo**: texto `var(--ink)` → 13.1:1 ✅

### `surface-dossier`
- **Token CSS**: `--surface-dossier: #FAFAF4`
- **Finalidade**: A "pasta clínica" — superfície específica do DossierCard.
- **Uso permitido**: `DossierCard`, variante compact do DossierCard, cards de sessão.
- **Uso proibido**: fundo de página, toolbars, elementos secundários.
- **Nota**: levemente mais quente que `surface-document` para criar diferenciação de hierarquia.

### `surface-manuscript`
- **Token CSS**: `--surface-manuscript: #F0EDE5`
- **Finalidade**: Superfície de manuscrito/anotação — seções de texto autoral, hipóteses da IA.
- **Uso permitido**: área de hipótese no DossierCard, anotações de sessão, citações longas.
- **Uso proibido**: cards inteiros, toolbars, qualquer elemento de navegação.
- **Tipografia**: Cormorant Garamond italic para frases curtas (≤ 2 linhas). Outfit regular para desenvolvimento.

### `surface-folder`
- **Token CSS**: `--surface-folder: #EDE8DE`
- **Finalidade**: Aba de pasta / tab secundária — seções dentro de um dossiê.
- **Status**: ⏳ Token definido. Componente ainda não implementado.
- **Uso previsto**: abas no detalhe do paciente (`_authenticated.app.clientes.$clientId.tsx`).

### `surface-book`
- **Token CSS**: `--surface-book: #E8E3D8`
- **Finalidade**: Capa de livro — cards da Biblioteca.
- **Status**: ⏳ Token definido. Aplicação pendente no redesign da Biblioteca.
- **Uso previsto**: card de livro na rota `_authenticated.app.biblioteca.tsx`.

---

## 2. Ornamentos (Elementos Acessórios)

Não são superfícies — são **componentes semânticos** que transmitem identidade.

### `status-stamp` (StatusStamp)
- **Token CSS**: `--material-stamp-fg`, `--material-stamp-arc`
- **Componente**: `src/components/ui/dossier-card.tsx` → `StatusStamp`
- **Especificações obrigatórias**:
  - Diâmetro: **48px**
  - Opacidade: **0.72** (nunca acima de 0.85)
  - Rotação: **≤ ±4°** (nunca além disso)
  - `pointer-events: none` — nunca bloqueia cliques
  - `aria-label` descritivo obrigatório
  - Texto interno: máximo 8 caracteres
- **O status também existe em texto** (legível ao lado ou via aria-label). O carimbo é *reforço visual*, não substituto.
- **Usos permitidos**: DossierCard, fichas de sessão, cards de protocolo.
- **Usos proibidos**: como único indicador de status, em tamanho > 64px, com textura envelhecida.

### `protocol-card` (PatternToken)
- **Token CSS**: `--material-protocol: #5C6644`
- **Componente**: `src/components/ui/dossier-card.tsx` → `PatternToken`
- **Finalidade**: Identificar padrões clínicos detectados (real — nunca fictício).
- **Tipos**: `sentido`, `lealdade`, `aniversario`, `geral`
- **Regra de exibição**: máximo 3 visíveis + contador "+N" quando houver mais.
- **Acessibilidade**: cor nunca é o único diferencial (texto sempre presente).

### `reference-bookmark`
- **Token CSS**: `--material-bookmark: #C6A23A`
- **Componente**: ❌ **Ainda não implementado**
- **Finalidade prevista**: referências bibliográficas, citações, fontes em painéis laterais.
- **Design planejado**: barra vertical de 3-4px em dourado à esquerda de uma citação curta.
- **Uso previsto**: sidebar da Biblioteca, seção de referências no dossiê do paciente.

---

## 3. Tokens de Cor de Material

Complementam os tokens de superfície com cores específicas de ornamento.

| Token | Valor | Uso |
|---|---|---|
| `--material-border` | `rgba(180,170,155,0.5)` | Borda arquivística universal |
| `--material-bronze` | `#8A6845` | Accent bar esquerda, número de registro |
| `--material-gold` | `#C6A23A` | Hover de link, carimbo dourado |
| `--material-olive` | `#7D8060` | Label IA Clínica, categorias secundárias |
| `--material-terracotta` | `#A8654D` | Alertas, consentimento pendente |
| `--material-stamp-fg` | `#1B3D2D` | Carimbo de dossiê ativo |
| `--material-stamp-arc` | `#8B6914` | Carimbo de dossiê arquivado |
| `--material-protocol` | `#5C6644` | Padrões clínicos / protocol cards |
| `--material-bookmark` | `#C6A23A` | Marcador de referência bibliográfica |

---

## 4. Regras Rígidas de Tipografia

| Token | Classe CSS | Fonte | Onde usar | Onde NUNCA usar |
|---|---|---|---|---|
| Display | `.type-display` | Cormorant Garamond 700 | Hero, números decorativos gigantes | Dentro de cards |
| Headline | `.type-headline` | Cormorant Garamond 700 | Nome do paciente, título de livro | Botões, labels |
| Title | `.type-title` | Cormorant Garamond 600 | Subtítulo de seção | Texto corrido |
| Body | `.type-body` | Outfit 400 | Descrições, anotações, prontuário | Títulos, botões |
| Caption | `.type-caption` | Outfit 400 | Data, hora, ID, metadados | Títulos |
| Label | `.type-label` | Outfit 700 | Botões, badges de status | Títulos, corpo |
| Eyebrow | `.type-eyebrow` | Outfit 800 | Tipo de superfície, categoria | Qualquer texto longo |

**Serif itálico (Cormorant Garamond italic)**:
- ✅ Permitido: frases curtas de IA (≤ 2 linhas), citações, hipóteses de destaque
- ❌ Proibido: blocos longos de prontuário, listas, tabelas, qualquer texto de mais de 3 linhas

---

## 5. Componentes Disponíveis

| Componente | Caminho | Variantes | Status |
|---|---|---|---|
| `DossierCard` | `src/components/ui/dossier-card.tsx` | `full`, `compact` | ✅ Implementado |
| `DossierCardSkeleton` | `src/components/ui/dossier-card.tsx` | — | ✅ Implementado |
| `StatusStamp` | `dossier-card.tsx` (interno) | `active`, `archived` | ✅ Implementado |
| `PatternToken` | `dossier-card.tsx` (interno) | por tipo | ✅ Implementado |
| `ReferenceBookmark` | — | — | ❌ Pendente |
| `FolderTab` | — | — | ❌ Pendente |
| `BookCard` | — | — | ❌ Pendente |

---

## 6. Comportamento Responsivo

| Largura | Grid DossierCard | Comportamento |
|---|---|---|
| ≥ 1280px | 3 colunas | Completo |
| 1024–1279px | 2 colunas | Completo |
| 768–1023px | 2 colunas | Carimbo ligeiramente menor |
| < 768px | 1 coluna | Stack vertical, nome em tamanho completo |

**Altura dos cards**: `auto-fill, minmax(280px, 1fr)`. Sem altura fixa — cards com mais padrões serão naturalmente mais altos. O grid masonry não está implementado (a considerar no Passo 3).

---

## 7. Auditoria Honesta — Estado Atual (Passo 2.5)

| Material | Token CSS | Componente | Aplicado em rota |
|---|---|---|---|
| archive | ✅ `--surface-archive` | — | ✅ Clientes |
| document | ✅ `--surface-document` | — | ✅ Clientes |
| dossier | ✅ `--surface-dossier` | ✅ DossierCard | ✅ Clientes |
| folder | ✅ `--surface-folder` | ❌ Pendente | ❌ |
| manuscript | ✅ `--surface-manuscript` | ✅ (no DossierCard) | ✅ Clientes |
| book | ✅ `--surface-book` | ❌ Pendente | ❌ |
| protocol | ✅ `--material-protocol` | ✅ PatternToken | ✅ Clientes |
| stamp | ✅ `--material-stamp-*` | ✅ StatusStamp | ✅ Clientes |
| bookmark | ✅ `--material-bookmark` | ❌ Pendente | ❌ |

**Conclusão**: 6 tokens de superfície + 9 tokens de ornamento = **15 tokens** (conforme relatório anterior).  
Dos 9 materiais conceituais, **6 têm implementação completa** (token + componente + uso em rota).  
3 materiais (`folder`, `book`, `bookmark`) têm **token definido mas componente pendente** — previsto para os próximos passos (Biblioteca, detalhe do paciente).

---

## 8. Próximos Passos

1. **Passo 3 — Dashboard**: usar `<DossierCard variant="compact" />` nos dossiês recentes.
2. **Passo 4 — Biblioteca**: implementar `BookCard` com `--surface-book`.
3. **Passo 5 — Detalhe do Paciente**: implementar `FolderTab` com `--surface-folder` e `ReferenceBookmark` com `--material-bookmark`.
4. **Passo 6 — Agenda**: aplicar `surface-document` em cards de sessão.
