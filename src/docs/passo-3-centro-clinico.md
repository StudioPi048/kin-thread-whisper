# Passo 3 — Centro Clínico

> Status: **Aguardando validação visual da tela de Clientes**  
> Início: após aprovação visual do Passo 2.5

---

## Premissa

O Dashboard atual responde "quais módulos existem?".  
O Centro Clínico deve responder **"o que merece minha atenção hoje?"**

São problemas cognitivos completamente diferentes:

| Dashboard tradicional | Centro Clínico |
|---|---|
| Catálogo de funcionalidades | Centro de decisão clínica |
| Vários cards iguais | Hierarquia narrativa |
| Tudo tem o mesmo peso | O urgente domina o olhar |
| Usuário busca o que precisa | A interface apresenta o que importa |

**Regra de ouro**: se o Centro Clínico parecer uma segunda tela de Clientes com menos cards, está errado.

---

## Materiais permitidos

Seguindo a regra de máximo 3 materiais por tela:

| Material | Uso no Centro Clínico |
|---|---|
| `archive` | Fundo base da página |
| `document` | Painéis de seção, cards informativos |
| `protocol` | Destaque de atenção clínica (o que é urgente) |
| `dossier (compact)` | Apenas quando um paciente específico é apresentado — nunca em grade |

> [!CAUTION]
> O `DossierCard` **nunca** aparece em grade de 3 colunas no Centro Clínico.  
> Se aparecer, a tela vira catálogo.

---

## Estrutura da Página (wireframe conceitual)

```
┌───────────────────────────────────────────────────────────────────┐
│  SAUDAÇÃO PESSOAL                              [ data · hora ]    │
│  Bom dia, Letícia                                                 │
│  Hoje existe 1 hipótese forte e 2 sessões à tarde.                │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐  ┌──────────────────────────────┐
│  PRIORIDADE CLÍNICA             │  │  AGENDA DO DIA               │
│                                 │  │                              │
│  ● Geovanna — investigar        │  │  14:00 · Maria L.            │
│    linhagem paterna             │  │  16:30 · João P.             │
│    [DossierCard compact]        │  │  ──────────────              │
│                                 │  │  Amanhã: 3 sessões           │
│  + 2 outros casos pendentes     │  │                              │
└─────────────────────────────────┘  └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  IA CLÍNICA                                                         │
│  "Três pacientes compartilham o padrão de Síndrome de Aniversário   │
│  este mês. Considere uma abordagem transversal."                    │
│                                                   [Explorar →]      │
└─────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐  ┌──────────────────────────────────┐
│  DOSSIÊS RECENTES             │  │  LEITURA RELACIONADA             │
│  [DossierCard compact]        │  │  [BookCard — surface-book]       │
│  [DossierCard compact]        │  │  [BookCard]                      │
│  [DossierCard compact]        │  │                                  │
└───────────────────────────────┘  └──────────────────────────────────┘
```

### Hierarquia de atenção
1. **Saudação + resumo editorial** — onde o olhar pousa primeiro
2. **Prioridade clínica** — 1 dossiê específico + contagem de pendentes
3. **Agenda do dia** — o imediato operacional
4. **IA Clínica** — a hipótese mais forte do momento
5. **Dossiês recentes** — acesso rápido, compact, nunca em grade de 3+
6. **Leitura relacionada** — conexão com a Biblioteca

---

## Passo 3A — Centro Clínico (Atenção)

**Objetivo único**: Responder em menos de 5 segundos: *"O que precisa da minha atenção?"*

**Arquivos a modificar:**
- `src/routes/_authenticated.app.index.tsx` — reescrever a home

**Componentes a criar:**
- `ClinicalPriorityPanel` — painel de prioridade (protocol material)
- `AgendaPanel` — agenda simplificada do dia
- `AIInsightBanner` — hipótese da IA em destaque

**Componentes reutilizados:**
- `DossierCard variant="compact"` — para dossiês recentes (máx 3, nunca grade larga)

**Regra editorial da saudação:**

```tsx
// Saudação varia por hora do dia — nunca genérica
const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

// Resumo editorial — constrói narrativa com dados reais
// Ex: "Hoje existem 3 pacientes prioritários e 2 sessões à tarde."
// NUNCA: "Bem-vindo de volta!"
```

**O que NÃO fazer:**
- Grade de DossierCards full
- Resumos numéricos sem contexto ("12 pacientes", "5 sessões")
- Widgets soltos sem hierarquia entre eles
- IA como elemento menor/secundário

---

## Passo 3B — Linha Narrativa (Fluxo entre ambientes)

**Objetivo**: ao sair do Centro Clínico → Paciente → Dossiê, o usuário não deve sentir que "trocou de módulo".

**Implementação:**
- Breadcrumb consistente com material `document` em todas as rotas internas
- Transição de entrada suave (`framer-motion`, `@starting-style`)
- Link contextual da Agenda → Dossiê → de volta ao Centro Clínico

**Nota**: este passo só começa após 3A aprovado visualmente.

---

## Passo 3C — Microinterações

**Objetivo**: as animações terão significado porque a estrutura já existirá.

**Prioridade:**
1. Entrada do `ClinicalPriorityPanel` (reveal com delay)
2. Hover do `AIInsightBanner` (brilho sutil no border)
3. Transição entre Centro Clínico e Dossiê (scale + fade)

**Nota**: microinterações por último — não antes da estrutura estar validada.

---

## Critério de Início

> [!IMPORTANT]
> O Passo 3 só começa após resposta afirmativa a esta pergunta:
>
> **"Se eu esconder o nome da plataforma, alguém acreditaria que isso foi desenhado especificamente para uma clínica de Psicogenealogia?"**
>
> Se **sim** → avançar para 3A.  
> Se **não** → refinar composição da tela de Clientes até que ela se torne a referência.

---

## Critérios de Aceite — Passo 3A

- [ ] Saudação usa nome do usuário e hora do dia
- [ ] Resumo editorial é gerado com dados reais (0 textos hardcoded)
- [ ] "Prioridade clínica" mostra no máximo 1 dossiê específico + contagem
- [ ] Agenda mostra sessões do dia de forma compacta
- [ ] IA Clínica tem o maior peso visual depois da saudação
- [ ] `DossierCard compact` aparece no máximo 3 vezes na seção de recentes
- [ ] A tela NÃO parece uma grade de cards
- [ ] `surface-book` usado apenas na seção de Leitura (futuro)
- [ ] Máx 3 materiais na página: archive + document + protocol
- [ ] Loading state para cada painel independentemente
- [ ] Estado vazio elegante para quando não há dados
- [ ] Responsivo: 1 coluna em mobile, 2 colunas em tablet, estrutura editorial em desktop
