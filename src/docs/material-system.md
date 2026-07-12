# Sistema de Materiais — Instituto Liz

> Versão 1.1 · Passo 2.5 · Última atualização: 2026-07-12

Este documento é o **contrato de produto** do Sistema de Materiais.  
Define quais superfícies existem, seu nível de maturidade, onde podem ser usadas, onde são proibidas e o que ainda está planejado.

A premissa central:
> A plataforma deve transmitir a sensação de um **arquivo histórico clínico de alta precisão** — não de um álbum vintage ou scrapbook.

---

## Regra Central — Máximo 3 Materiais por Tela

> **Cada tela deve usar no máximo três materiais principais.**  
> Usar todos os materiais disponíveis ao mesmo tempo destrói a elegância.  
> A restrição é o que cria personalidade.

Cada ambiente recebe uma **identidade material própria**:

| Tela | Material 1 | Material 2 | Material 3 | Função cognitiva |
|---|---|---|---|---|
| **Clientes** | archive | document | dossier | "Quem faz parte da minha base?" |
| **Centro Clínico** | archive | document | protocol | "O que merece minha atenção hoje?" |
| **Biblioteca** | archive | book | bookmark | "O que posso aprender?" |
| **Detalhe do Paciente** | document | folder | manuscript | "Qual é a história deste caso?" |
| **Agenda** | document | dossier (compact) | — | "O que acontece agora?" |

**Consequências desta regra:**
- O Centro Clínico (Dashboard) NÃO usa `dossier` em grade. Usa `protocol` para destacar o que é urgente.
- A Biblioteca NÃO usa `dossier`. Os cards de livro têm identidade própria (`book`).
- O Detalhe do Paciente aprofunda com `manuscript` — o único ambiente onde o texto autoral é protagonista.

---

## Regra da Assinatura Invisível

> **Toda tela deve possuir apenas um elemento memorável.**  
> Nunca dois ou três "efeitos assinatura" competindo no mesmo ambiente.  
> Essa disciplina dá a cada tela uma identidade própria e mantém a plataforma inteira elegante.

O elemento memorável não é o mais chamativo — é o mais **característico**.  
Ele define o que o usuário vai lembrar sobre aquela tela 24 horas depois.

| Tela | Assinatura Invisível | O que o usuário lembra |
|---|---|---|
| **Clientes** | O dossiê | "Cada paciente tem um arquivo" |
| **Centro Clínico** | O painel de prioridades | "Sei exatamente o que fazer hoje" |
| **Biblioteca** | Lombadas dos livros | "Parecem livros de verdade" |
| **Detalhe do Paciente** | O manuscrito | "Sinto que estou lendo uma história" |
| **Agenda** | A linha temporal clínica | "Tenho controle do meu dia" |

**Consequência direta:**  
Se numa tela existem dossiê *e* carimbo *e* marcador *e* lombada competindo ao mesmo tempo, nenhum deles é memorável. Todos viram decoração.

**Critério de revisão:**  
Ao finalizar qualquer tela, perguntar: *"Qual é o único elemento que define este ambiente?"*  
Se a resposta não for imediata, a tela tem elementos demais.

---

## Regra do Teste do Screenshot

> **Nenhuma tela entra em produção sem passar por este teste.**

**Protocolo:**
1. Fazer um screenshot da tela completa
2. Esconder logotipo e nome da plataforma
3. Mostrar para alguém que nunca viu o sistema
4. Perguntar apenas: *"Que tipo de software você acha que é?"*

**Critério de aprovação:**  
A resposta deve convergir espontaneamente para um destes conceitos:
- Psicogenealogia
- história familiar
- genealogia clínica
- arquivo clínico
- prontuário genealógico

Qualquer outra resposta — *CRM*, *software médico*, *sistema de gestão*, *dashboard* — indica que a identidade ainda não foi incorporada ao design. Não propagar para outras telas.

**Por que essa regra existe:**  
Ela mede a percepção real do produto, não a intenção do designer.  
Um Design System pode estar tecnicamente correto e ainda assim não comunicar identidade.  
O teste do screenshot é o único critério que não pode ser justificado por arquitetura.

**Vereditos possíveis:**

| Veredito | Significado | Próximo passo |
|---|---|---|
| 🟢 Aprovado | A tela virou referência visual do produto | Propagar o sistema para o próximo ambiente |
| 🟡 Refinamento | Arquitetura correta, ajustes pontuais de composição | Refinar antes de propagar |
| 🔴 Reprojeto | Ainda parece coleção de cards | Não propagar. Identificar o que falta |

---

## Princípio de Design

A identidade visual de arquivo histórico opera de forma **subliminar**, nunca literal.

| ✅ Correto | ❌ Incorreto |
|---|---|
| Tons de marfim e bege quente | Textura de papel rasgado |
| Borda esquerda em bronze | Fita adesiva em cards operacionais |
| Carimbo SVG 48px, opacidade 0.72 | Carimbo > 64px ou rotacionado > 5° |
| Sombra multi-camada discreta | Drop shadow com spread excessivo |
| Serif italic em citações curtas (≤ 2 linhas) | Serif italic em blocos longos de prontuário |
| Número de registro como metadado (Eyebrow) | Número de registro como título principal |

---

## 1. Matriz de Maturidade

Cada material possui um nível de maturidade declarado:

| Nível | Significado |
|---|---|
| **stable** | Token CSS + componente + validado em tela de produção |
| **experimental** | Componente criado, aguardando validação visual completa |
| **planned** | Token CSS definido, componente ainda não implementado |
| **deprecated** | Substituído — não usar em novas telas |

### Matriz Completa

| Material | Maturidade | Token CSS | Componente | Rotas aprovadas | Rotas proibidas |
|---|---|---|---|---|---|
| **archive** | stable | `--surface-archive` | — | Todas as áreas autenticadas, fundos de página | Modais críticos, dialogs |
| **document** | stable | `--surface-document` | — | Toolbars, fichas, painéis de filtro, tabelas | Botões, badges, qualquer elemento flutuante |
| **dossier** | stable | `--surface-dossier` | `DossierCard` | Clientes (full), Dashboard (compact) | Biblioteca, Configurações |
| **manuscript** | stable | `--surface-manuscript` | (interno ao DossierCard) | IA Clínica, hipóteses curtas, citações | Texto corrido longo, prontuário completo |
| **protocol** | stable | `--material-protocol` | `PatternToken` | Padrões clínicos, DossierCard, busca | Status global, navegação |
| **stamp** | stable | `--material-stamp-*` | `StatusStamp` | Status do dossiê (DossierCard) | Elemento único de status, navegação |
| **folder** | planned | `--surface-folder` | ❌ `DossierTabs` | Detalhe do paciente (abas) | Dashboard, qualquer outra área |
| **book** | planned | `--surface-book` | ❌ `BookCard` | Biblioteca | Pacientes, Agenda |
| **bookmark** | planned | `--material-bookmark` | ❌ `ReferenceBookmark` | Referências bibliográficas, Biblioteca | CTAs, navegação |

---

## 2. Superfícies Estruturais (stable)

### `surface-archive`
- **Token**: `--surface-archive: #F4F1EB`
- **Função**: Pergaminho arquivístico — fundo base global da plataforma.
- **Uso**: `background` de páginas autenticadas, seções abertas.
- **Proibido**: Cards, dialogs, elementos flutuantes.
- **Contraste**: `var(--ink)` / `#F4F1EB` → 12.4:1 ✅

### `surface-document`
- **Token**: `--surface-document: #FAFAF7`
- **Função**: Papel clínico — superfície de conteúdo editável ou navegável.
- **Uso**: Toolbars, listas, painéis de filtro, tabelas.
- **Proibido**: Não substituir `surface-dossier` em cards de paciente.
- **Contraste**: `var(--ink)` / `#FAFAF7` → 13.1:1 ✅

### `surface-dossier`
- **Token**: `--surface-dossier: #FAFAF4`
- **Função**: Pasta clínica — superfície do DossierCard.
- **Diferença de document**: levemente mais quente para criar hierarquia visual.
- **Uso**: `DossierCard` (full e compact), cards de sessão no futuro.
- **Proibido**: Fundos de página, toolbars.

### `surface-manuscript`
- **Token**: `--surface-manuscript: #F0EDE5`
- **Função**: Manuscrito/anotação — seções de hipótese e texto autoral da IA.
- **Uso**: Bloco de hipótese no DossierCard, anotações de sessão.
- **Tipografia**: `Cormorant Garamond italic` apenas em frases curtas (≤ 2 linhas). Outfit regular para desenvolvimento do texto.
- **Proibido**: Cards inteiros, toolbars, navegação.

### `surface-folder` *(planned)*
- **Token**: `--surface-folder: #EDE8DE`
- **Função prevista**: Aba de pasta clínica — tabs no detalhe do paciente.
- **Componente planejado**: `DossierTabs`

### `surface-book` *(planned)*
- **Token**: `--surface-book: #E8E3D8`
- **Função prevista**: Capa de livro — cards da Biblioteca.
- **Componente planejado**: `BookCard`

---

## 3. Ornamentos (Componentes Semânticos)

### `status-stamp` — StatusStamp (stable)
- **Tokens**: `--material-stamp-fg: #1B3D2D`, `--material-stamp-arc: #8B6914`
- **Componente**: interno a `dossier-card.tsx`
- **Especificações obrigatórias**:
  - Diâmetro: 48px (full) / 36px (compact)
  - Opacidade: máx 0.72
  - Rotação: ≤ ±4°
  - `pointer-events: none` — nunca bloqueia cliques
  - `aria-label` descritivo obrigatório
  - Texto interno: ≤ 8 chars
  - **Nunca é o único indicador de status** — texto sempre presente ao lado
- **Proibido**: Como única fonte de status, tamanho > 64px, textura envelhecida.

### `protocol-card` — PatternToken (stable)
- **Token**: `--material-protocol: #5C6644`
- **Componente**: interno a `dossier-card.tsx`
- **Tipos**: `sentido`, `lealdade`, `aniversario`, `geral`
- **Regra**: máx 3 (full) / máx 2 (compact) + contador "+N"
- **Acessibilidade**: cor nunca é o único diferencial.

### `reference-bookmark` *(planned)*
- **Token**: `--material-bookmark: #C6A23A`
- **Componente planejado**: `ReferenceBookmark`
- **Design**: barra vertical de 3-4px em dourado + citação ao lado.
- **Uso previsto**: Sidebar de referências na Biblioteca e no detalhe do paciente.

---

## 4. Tokens de Cor de Material

| Token | Valor | Semântica |
|---|---|---|
| `--material-border` | `rgba(180,170,155,0.5)` | Borda arquivística universal |
| `--material-bronze` | `#8A6845` | Accent bar, número de registro |
| `--material-gold` | `#C6A23A` | Hover, CTAs, selos dourados |
| `--material-olive` | `#7D8060` | Label IA Clínica, categorias |
| `--material-terracotta` | `#A8654D` | Alertas, consentimento pendente |
| `--material-stamp-fg` | `#1B3D2D` | Carimbo de dossiê ativo |
| `--material-stamp-arc` | `#8B6914` | Carimbo de dossiê arquivado |
| `--material-protocol` | `#5C6644` | Padrões clínicos / protocol cards |
| `--material-bookmark` | `#C6A23A` | Marcador de referência bibliográfica |

---

## 5. Regras Tipográficas Rígidas

| Token | Fonte / Peso | Onde usar | Onde NUNCA usar |
|---|---|---|---|
| Display | Cormorant Garamond 700 | Hero, números decorativos gigantes | Dentro de qualquer card |
| Headline | Cormorant Garamond 700 | Nome do paciente, título de livro | Botões, labels, inputs |
| Title | Cormorant Garamond 600 | Subtítulo de seção | Texto corrido |
| Body | Outfit 400 | Prontuário, anotações, descrições | Títulos, botões |
| Caption | Outfit 400 | Data, hora, ID, metadados | Títulos |
| Label | Outfit 700 | Botões, badges de status | Títulos, corpo |
| Eyebrow | Outfit 800 | Tipo de superfície, categoria | Qualquer texto longo |

**Serif italic** (`Cormorant Garamond italic`):
- ✅ Hipóteses curtas da IA (≤ 2 linhas), citações de destaque, frases de abertura
- ❌ Blocos longos de prontuário, listas, tabelas, qualquer texto contínuo > 3 linhas

---

## 6. Componentes — Inventário

| Componente | Caminho | Variantes | Maturidade |
|---|---|---|---|
| `DossierCard` | `src/components/ui/dossier-card.tsx` | `full`, `compact` | stable |
| `DossierCardSkeleton` | `src/components/ui/dossier-card.tsx` | `full`, `compact` | stable |
| `StatusStamp` | `dossier-card.tsx` (interno) | `active`, `archived` | stable |
| `PatternToken` | `dossier-card.tsx` (interno) | por tipo | stable |
| `CardMenu` | `dossier-card.tsx` (interno) | `compact` prop | stable |
| `DossierTabs` | — | — | planned |
| `BookCard` | — | — | planned |
| `ReferenceBookmark` | — | — | planned |

---

## 7. DossierCard — Semântica de Acessibilidade

```tsx
<article
  role="link"                            // interativo, navega ao dossiê
  tabIndex={0}                           // focável por teclado
  aria-label={`Abrir dossiê de ${name}`} // ação descrita, não apenas conteúdo
  onKeyDown={e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(…);
    }
  }}
>
```

- **Controles internos** (menu, "Abrir →"): `onClick={e => e.stopPropagation()}`
- **Focus ring**: `outline: 2px solid var(--forest-soft)` + `outline-offset: 3px`
- **Skeleton**: `aria-busy="true"` no container externo + `aria-hidden="true"` no conteúdo visual interno

---

## 8. DossierCard — Variante Compact

A variante `compact` não é apenas redução de padding. Ela altera a **estrutura e os metadados exibidos**.

| | `variant="full"` | `variant="compact"` |
|---|---|---|
| Número de registro | ✅ | ❌ |
| Carimbo SVG | ✅ 48px | ❌ → status em texto |
| Nome | ✅ h2 grande | ✅ h3 |
| Subtítulo/especialidade | ✅ | ✅ (inline com idade) |
| Queixa principal | ✅ 2 linhas | ✅ 1 linha |
| Padrões | ✅ máx 3 | ✅ máx 2 |
| Hipótese IA | ✅ (se real) | ❌ |
| Consentimento | ✅ ícone + texto | ❌ |
| Ação explícita | ✅ "Abrir →" | ❌ (clique no card) |

---

## 9. Comportamento Responsivo

| Largura | Grid DossierCard | Observação |
|---|---|---|
| ≥ 1280px | 3 colunas | Completo |
| 1024–1279px | 2 colunas | Completo |
| 768–1023px | 2 colunas | — |
| < 768px | 1 coluna | Stack vertical, nome em tamanho pleno |

Grid CSS: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`  
Altura: `auto` — cards com mais padrões são naturalmente mais altos (masonry considerado para Passo 3).

---

## 10. Auditoria de Estado — Passo 2.5

| Material | Token CSS | Componente | Aplicado em rota |
|---|---|---|---|
| archive | ✅ | — | ✅ Clientes |
| document | ✅ | — | ✅ Clientes |
| dossier | ✅ | ✅ DossierCard (full + compact) | ✅ Clientes |
| manuscript | ✅ | ✅ (interno ao DossierCard) | ✅ Clientes |
| protocol | ✅ | ✅ PatternToken | ✅ Clientes |
| stamp | ✅ | ✅ StatusStamp | ✅ Clientes |
| folder | ✅ | ❌ | ❌ |
| book | ✅ | ❌ | ❌ |
| bookmark | ✅ | ❌ | ❌ |

**6 de 9 materiais** operacionais. **3 materiais** com token preparado, aguardando implementação nas rotas específicas (detalhe do paciente, Biblioteca).

---

## 11. Roadmap — Próximas Adoções

| Passo | Rota | Materiais | Componente |
|---|---|---|---|
| 3 | Dashboard (`/app`) | dossier (compact), archive | `DossierCard variant="compact"` |
| 4 | Biblioteca | book, bookmark | `BookCard`, `ReferenceBookmark` |
| 5 | Detalhe do Paciente | folder, manuscript | `DossierTabs`, `ManuscriptBlock` |
| 6 | Agenda | document | cards de sessão |
