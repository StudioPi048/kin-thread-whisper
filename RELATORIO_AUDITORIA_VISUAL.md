# Relatório de Auditoria Visual e Estética — GeneaLiz (Kin Thread)

**Auditor:** Diretor de Design (consultoria externa via Claude Code) · **Data:** 17/07/2026
**Produto:** GeneaLiz — plataforma clínica de psicogenealogia do Instituto Liz
**Público:** psicogenealogistas / terapeutas (beta fechado)
**Stack:** TanStack Start (file-based routing) + React + Tailwind CSS 4 + shadcn/ui + Supabase (Lovable Cloud)
**Design system oficial:** `src/styles.css` (tokens), `src/docs/manifesto-visual-genealiz.md`, `src/docs/filosofia-produto-genealiz.md`, `src/docs/material-system.md`

**Método de evidência:** dev server em `localhost:8080`; screenshots reais em ~1440px e ~375–390px de todas as rotas públicas e autenticadas (auth simulada localmente para render; dados clínicos bloqueados por RLS). Estados **com dados reais** (listas povoadas, abas do dossiê com conteúdo, chat com histórico) foram avaliados por **leitura de código** — cada caso está sinalizado. Contrastes marcados com "(medido)" foram calculados com a fórmula WCAG sobre os hex reais dos tokens; valores sugeridos sem medição estão marcados "(estimar/validar)".

---

## 1. Sumário executivo

**Estado geral: 7,5/10 — identidade rara, execução desigual.**

O GeneaLiz tem o que 95% dos SaaS não têm: uma direção de arte proprietária ("arquivo vivo") com fundamento conceitual documentado, paleta própria, ornamentação com significado clínico e, agora, um acervo fotográfico de objetos que funde com o papel. Nos primeiros 10 segundos, um terapeuta novo sente **atmosfera**: isto não parece um CRM. Esse é o maior ativo do produto e deve ser protegido.

A execução, porém, contradiz a ambição em pontos mensuráveis:

1. **Contraste reprovado em texto estrutural (P0).** Os títulos de seção da Mesa Clínica e da Agenda usam `text-ink/40` = **2,43:1 (medido)** — menos da metade do mínimo AA. O eixo de navegação da tela mais importante do produto é o texto menos legível dela.
2. **Não existe recuperação de senha (P0).** O fluxo de auth para num beco: quem esquece a senha não tem saída na interface. Para um produto que se vende por confiança e sigilo, isso mina credibilidade.
3. **O "Segundo Cérebro" responde com texto enlatado por palavra-chave (P0 de credibilidade).** Há um selo "Protótipo · modo demonstração" no header, mas as respostas em si se apresentam como análise clínica. Num produto cuja Constituição exige Explicabilidade e Não-Substituição, uma simulação que parece real é o risco mais sério do produto.
4. **A landing vive numa paleta paralela (P1).** `#D4AF37`, `#1B211A`, `#FCF9F4` hardcoded — parecidos, mas não iguais aos tokens (`--gold #D4A843`, `--forest #12291F`, `--archive #F7F5F0`). Duas fontes de verdade divergem em silêncio.
5. **Tipografia sem escala na prática (P1).** Existem 14+ tamanhos arbitrários em `px` nas rotas (`text-[8px]` a `text-[17px]`), com a escala oficial `type-*` de `styles.css` quase sem uso.

**Impressão de 10 segundos:** "isto é bonito, sério e diferente" — seguida, no uso, de tropeços de legibilidade e de botões que prometem mais do que entregam.

---

## 2. Checklist de cobertura

| # | Página/estado | Evidência |
|---|---|---|
| 1 | `/` Landing | screenshot 1440 + 375 |
| 2 | `/auth` (login + cadastro; recuperação ausente) | screenshot 1440 + código |
| 3 | `/app` Mesa Clínica | screenshot 1440 + 375 |
| 4 | `/app/clientes` (grade, lista, busca, vazios) | screenshot 375/700 + código (lista povoada) |
| 5 | `/app/clientes/$clientId` (dossiê, 7 abas) | código + screenshot parcial (estrutura) |
| 6 | `/app/paciente/$id` (dossiê narrativo, erro, loading) | screenshot 375 (erro/loading) + código |
| 7 | `/app/agenda` (vazio, erro, povoada) | screenshot 700 + código (povoada) |
| 8 | `/app/genossociogramas` | screenshot 1440 + 700 |
| 9 | `/app/linha-do-tempo` | screenshot 1440 + código |
| 10 | `/app/biblioteca` | screenshot 1440 + 375 |
| 11 | `/app/ia-clinica` | screenshot 1440 + código |
| 12 | `/app/guia` | screenshot 1440 |
| 13 | `/app/configuracoes` | screenshot 375 + código |
| 14 | 404 (`NotFoundComponent`, `src/routes/__root.tsx:17`) | screenshot 1440 |
| 15 | Erro raiz / "500" (`ErrorComponent`, `__root.tsx:40`) | código |
| 16 | Overlays: busca ⌘K, gaveta "Mais", AlertDialogs, Sheets | screenshot 375 + código |

**Confirmação:** todas as 16 entradas mapeadas na Etapa 1 foram avaliadas; nenhuma rota do `src/routes/` ficou de fora (routeTree conferido por listagem de arquivos).

---

## 3. Tabela de notas por página

Critérios: 1 Marca · 2 Hierarquia · 3 Tipografia · 4 Contraste · 5 Componentes · 6 Imagens/ícones · 7 Microinterações · 8 UX writing · 9 Mobile · 10 A11y · 11 Estados · 12 Auth · 13 Perf. percebida

| Página | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|--|--|--|--|--|--|--|--|--|--|--|--|--|
| Landing | 9 | 8 | 7 | 6 | 5 | 9 | 6 | 8 | 8 | 6 | n/a | n/a | 7 |
| Auth | 9 | 9 | 8 | 8 | 8 | 9 | 7 | 8 | 7 | 7 | 6 | **5** | 7 |
| Mesa Clínica | 9 | 8 | 8 | **4** | 8 | 9 | 8 | 9 | 9 | 8 | 9 | n/a | 6 |
| Clientes | 8 | 8 | 7 | 6 | 8 | 9 | 8 | 9 | 8 | 8 | 9 | n/a | 8 |
| Dossiê do cliente | 8 | 7 | 7 | 6 | 7 | 8 | 7 | 8 | 7 | 7 | 8 | n/a | 7 |
| Paciente | 8 | 8 | 7 | 6 | 7 | 8 | 8 | 8 | 8 | 7 | 9 | n/a | 8 |
| Agenda | 8 | 7 | 6 | **5** | 7 | 8 | 8 | 8 | 7 | 7 | 8 | n/a | 7 |
| Genossociogramas | 9 | 9 | 8 | 7 | 9 | 10 | 9 | 9 | 9 | 8 | 10 | n/a | 8 |
| Linhas de Herança | 9 | 9 | 8 | 7 | 9 | 10 | 9 | 9 | 9 | 8 | 10 | n/a | 8 |
| Biblioteca | 9 | 7 | 7 | 7 | 7 | 8 | 8 | 9 | 8 | 7 | 7 | n/a | 6 |
| Segundo Cérebro | 7 | 7 | 7 | 7 | 7 | 8 | 6 | **4** | 6 | 6 | 6 | n/a | 7 |
| Guia | 9 | 9 | 9 | 7 | 8 | 8 | 7 | 9 | 8 | 8 | n/a | n/a | 8 |
| Configurações | 7 | 7 | 8 | 8 | 8 | 7 | 6 | 7 | 8 | 8 | 6 | n/a | 8 |
| 404 | 7 | 8 | 8 | **5** | 8 | 5 | 6 | 8 | 8 | 8 | n/a | n/a | 9 |
| Erro raiz | 7 | 8 | 8 | **5** | 8 | 5 | 6 | 8 | 8 | 8 | n/a | n/a | 9 |
| Overlays | 8 | 8 | 8 | 7 | 9 | 8 | 8 | 8 | 8 | 8 | 8 | n/a | 8 |

---

## 4. Avaliação detalhada por página

### 4.1 Landing (`src/routes/index.tsx`, 1.070 linhas)

**O que está bom, especificamente:** o hero com fotografia física real (livro, selo, fotos sépia) é uma assinatura visual genuína; a hierarquia texto→imagem funciona; responsividade recém-corrigida empilha corretamente em 375px.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Paleta paralela hardcoded: `#D4AF37`, `#1B211A`, `#FCF9F4`, `#3B2F2F`, `#846221` espalhados em ~100 estilos inline, divergindo dos tokens (`--gold #D4A843` etc.) | P1 | Médio | Migrar cores para `var(--gold)`, `var(--forest)`, `var(--archive)`; onde a landing pedir tom próprio, criar token (`--landing-ink`) em `styles.css` |
| Botão "Ver como funciona" (linha ~242) é `<button>` **sem onClick** — promessa morta na página pública | P1 | Baixo | Remover até existir vídeo, ou ancorar para a seção de features |
| Hovers via `onMouseEnter/onMouseLeave` mutando `style` (header, CTAs) | P2 | Baixo | Substituir por classes `hover:`; JS de hover quebra com teclado e reduz manutenção |
| `text-white/45` no rodapé = 4,39:1 (medido) em 14px — abaixo de AA | P2 | Baixo | Subir para `white/60` (≥6:1 estimado) |
| Estilos inline dominam o arquivo (102 ocorrências) — nenhuma reutilização do design system | P2 | Alto | Converter gradualmente para Tailwind + tokens (fazer junto com item 1) |

### 4.2 Auth (`src/routes/auth.tsx`, 305 linhas)

**Bom:** o painel-manifesto com a constelação dourada é o momento visual mais forte do produto; a citação de Dolto conecta marca e disciplina; formulário limpo com labels reais.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| **Não existe "esqueci minha senha"** — nenhum link, nenhuma rota de recovery (grep confirma zero ocorrências) | **P0** | Médio | Link "Esqueci minha senha" sob o campo; fluxo com `supabase.auth.resetPasswordForEmail` + tela de confirmação no mesmo padrão editorial |
| Mensagens de erro do Supabase repassadas cruas (ex.: "Invalid login credentials", em inglês) — leitura de código | P1 | Baixo | Mapear os 5–6 erros comuns para PT com instrução ("E-mail ou senha incorretos. Confira e tente de novo.") |
| Estado de carregamento no submit: verificar spinner/disabled no botão (código sugere estado simples) | P2 | Baixo | Botão com `disabled` + spinner + texto "Entrando…" durante a submissão |
| Painel esquerdo `hidden md:` — em mobile o manifesto (e a marca) somem por completo | P3 | Baixo | Faixa compacta com a citação acima do formulário em `<md` |

### 4.3 Mesa Clínica (`src/routes/_authenticated.app.index.tsx`)

**Bom:** dashboard editorial sem "cards de KPI" genéricos — coerente com o manifesto; selo de cera + citação real + herbário criam profundidade sem ruído; dados reais (sessões, padrões, consentimentos).

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Títulos de seção `text-ink/40` = **2,43:1 (medido)** em 11px uppercase — o esqueleto da página é ilegível para baixa visão | **P0** | Baixo | Trocar para `text-warm-gray` (5,43:1 medido) ou `text-ink/60`; aplicar também na Agenda vazia e no ArchiveEmptyState |
| Frases de estado vazio em `text-ink/40` itálico (2,43:1) | P1 | Baixo | `text-ink/55` mínimo — e mesmo 3,78:1 (medido) só passa como "large text"; em 20px+ ok, abaixo disso usar `ink-soft` |
| Linha de resumo aparece com "0 clientes ativos" durante o fetch e salta para o valor real (flash de dado falso) | P2 | Baixo | Skeleton inline (três `skeleton` de 80px) até as três queries resolverem |
| Sem indicação de erro se as queries da mesa falharem (fica tudo "em dia" — silêncio enganoso) | P2 | Médio | Estado de erro discreto por seção ("Não foi possível carregar — recarregar") |

### 4.4 Clientes (`src/routes/_authenticated.app.clientes.index.tsx`)

**Bom:** DossierCard tem identidade forte (nº de registro, selos, consentimento); vazios com gaveta/lupa do acervo são memoráveis; tabela com colunas progressivas.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| "Consentimento pendente" em `material-terracotta` = **3,84:1 (medido)** em 11px bold | P1 | Baixo | Texto em `clinical-critical` (7,22:1 medido) ou terracota escurecida ~`#8F5340` (validar 4,5+); terracota atual fica para bordas/ícones |
| Toggle grade/lista com alvos de 28px (`size-7`) | P2 | Baixo | `size-9` mínimo (36px) + `p-1` no grupo; ideal 44px de área efetiva |
| Na tabela mobile, colunas escondidas (contato, queixa, tags) não têm caminho alternativo além de abrir o dossiê | P3 | Médio | Linha expansível ou forçar visão de cartões em `<sm` |

### 4.5 Dossiê do cliente (`src/routes/_authenticated.app.clientes.$clientId.tsx` + componentes)

**Bom:** hipótese clínica agora deriva de padrões reais; abas roláveis; gramática visual (`ClinicalDocument`) é um diferencial conceitual raro.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| `ClinicalIntelligencePanel` é `hidden lg:block` — o Copiloto simplesmente não existe em tablet/celular | P1 | Médio | Em `<lg`, virar Drawer inferior acionado por botão flutuante "Copiloto" |
| Conteúdo do Copiloto: verificar origem dos dados (leitura parcial sugere sugestões estáticas) — se for curadoria fixa, rotular como tal | P1 | Médio | Auditar `clinical-intelligence-panel.tsx`; rotular blocos não-dinâmicos como "Sugestão do acervo" |
| 7 abas em pílulas roláveis sem indicador de overflow no mobile (usuário pode não perceber que há mais abas) | P2 | Baixo | Gradiente de fade na borda direita do contêiner de rolagem |
| Avatar com hover "Trocar" invisível para teclado/touch (só `group-hover`) | P2 | Baixo | Botão de câmera sempre visível em touch (`@media (hover: none)`) |
| Tab "Planilha" (ClanSpreadsheet) exige rolagem horizontal de tabela de 1500px no celular — utilizável, mas árduo | P3 | Alto | Visão resumida por pessoa (cartões) em `<md` como alternativa |

### 4.6 Paciente (`src/routes/_authenticated.app.paciente.$id.tsx`)

**Bom:** a página mais bem orquestrada do produto — header constelado, jornada, briefing; estados de loading/erro desenhados; medalhão no genograma vazio é delicado e temático.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Botão "Gerar briefing IA" permanentemente `disabled` com cursor-not-allowed | P2 | Baixo | Remover até a feature existir; botão morto em destaque cobra um preço de confiança |
| `BigTree` SVG com nomes em `fontSize 10` fica ~7px efetivos em 375px | P2 | Médio | Em `<sm`, mostrar só iniciais + tooltip, ou aumentar viewBox/na vertical |
| ActionBar fixa dupla com bottom-nav consome ~130px de tela útil no mobile | P3 | Médio | Colapsar ActionBar em um FAB único no mobile |

### 4.7 Agenda (`src/routes/_authenticated.app.agenda.tsx`)

**Bom:** vazio honesto pós-limpeza (sem pacientes fictícios); selos clínicos em tokens; timeline do dia com ritual de preparação é UX clínica de verdade.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Rótulo "IA Clínica detectou" sobre alertas de motor **de regras** — superdimensiona a "IA" (Explicabilidade) | P1 | Baixo | Renomear para "Padrões detectados" + tooltip "detecção por regras do genossociograma" |
| Títulos/legendas em `ink/40–50` repetem a falha de contraste da Mesa (2,4–3,1:1 medido/estimado) | P1 | Baixo | Mesmo fix do item 4.3 |
| "Ocupado/Livre" calculado como `sessões = horas` (aproximação que vira número falso com sessões de 30min) — leitura de código | P2 | Médio | Somar durações reais (`start`→`end`) ou remover o par de stats |
| `stats` seals: dias com muitos selos empilham 3+ chips por cartão — ruído | P3 | Baixo | Máx. 2 selos + "+n" |

### 4.8 Genossociogramas & 4.9 Linhas de Herança (rotas gêmeas)

**Bom:** os dois melhores empty states do produto (árvore de bronze / fio de herança); gêmeas **de propósito** e consistentes entre si — isso é um dado positivo de sistema; cartões com hover-lift e métricas reais.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| "Ver Árvore"/"Ver Linha do Tempo" apontam ambos para `/app/clientes/$clientId` sem abrir a aba correspondente | P2 | Baixo | Passar `?tab=genogram` / `?tab=timeline` e ler no dossiê (`defaultValue` da Tabs) |
| Busca sem `aria-label` (placeholder não é label) | P2 | Baixo | `aria-label="Buscar por cliente"` nos dois inputs |
| Cartões de cliente idênticos nas duas telas (código duplicado ~80 linhas) | P3 | Médio | Extrair `TreeSummaryCard` compartilhado |

### 4.10 Biblioteca (`src/routes/_authenticated.app.biblioteca.tsx`, 1.807 linhas)

**Bom:** a página com mais alma; acervo autoral com pessoa real; trilho de IA com curadoria rotulada; 30 breakpoints — a mais responsiva do app.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| 1.800 linhas com ~500 de conteúdo hardcoded (obras, glossário, citações) no arquivo de rota | P2 | Alto | Extrair conteúdo para `src/content/biblioteca.ts`; prepara a migração futura para o banco (`library_entries`) |
| Página inteira renderiza de uma vez (10 seções pesadas) — custo de TTI | P2 | Médio | `lazy` por seção abaixo da dobra ou `content-visibility: auto` |
| Foto da autora vem do pipeline Lovable (`.asset.json`) — quebra em dev local; em produção validar peso | P3 | Baixo | Mover para `public/assets/` como os renders |
| Trilho IA `hidden xl:` — some até em laptop 13" (1280px) | P3 | Baixo | Liberar em `lg:` com largura 280px |

### 4.11 Segundo Cérebro (`src/routes/_authenticated.app.ia-clinica.tsx`)

**Bom:** layout de chat limpo; selo "Protótipo · modo demonstração" existe; diretrizes agora sem emoji.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| **Respostas simuladas por palavra-chave apresentadas como análise clínica** (`handleSend`, linhas ~44–61). O selo no header não acompanha a rolagem; cada resposta enlatada parece real | **P0** (credibilidade clínica) | Baixo | Prefixar toda resposta simulada com chip "Demonstração" na própria bolha + banner fixo no topo do chat; ou desativar o input e mostrar roteiro de exemplo estático |
| Sem estado "digitando…" — resposta aparece seca após 1s | P2 | Baixo | Indicador de três pontos na bolha da IA |
| Enter envia, mas não há feedback de foco/disabled durante o "processamento" | P2 | Baixo | Desabilitar input + botão durante o timeout |
| Histórico se perde ao navegar (state local) — sem aviso | P3 | Baixo | Nota "conversas de demonstração não são salvas" |

### 4.12 Guia (`src/routes/_authenticated.app.guia.tsx`)

**Bom:** a melhor tipografia do produto — medida de linha, capítulos numerados, citações; parece um documento do próprio universo da marca.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Breadcrumb duplicado: "Instituto Liz / Instituto Liz / Manual Clínico" (`guia.tsx:14` passa prefixo que o `DocumentHeader` já adiciona) | P2 | Baixo | `breadcrumb="Manual Clínico"` (mesmo fix já aplicado em 3 outras telas) |

### 4.13 Configurações (`src/routes/_authenticated.app.configuracoes.tsx`)

**Bom:** consistente com o padrão DocumentHeader; honesta sobre a Etapa 2.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| **Dark mode completo definido em `styles.css` (bloco `.dark`, 50+ tokens) sem nenhum toggle no produto** — feature fantasma | P2 | Médio | Decidir: expor toggle aqui (3 estados: claro/escuro/sistema) ou remover o bloco morto do CSS |
| Página é a mais "rala" do app — um único cartão | P3 | Médio | Agrupar: Perfil, Preferências (tema), Segurança (troca de senha — casa com o fix do auth), Sobre o beta |

### 4.14 404 & 4.15 Erro raiz (`src/routes/__root.tsx:17` e `:40`)

**Bom:** ambos customizados, serif, centrados, com CTA — acima da média de mercado.

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Eyebrow "INSTITUTO LIZ" em `text-gold` sobre fundo claro = **2,03:1 (medido)** nas duas telas | P1 | Baixo | `text-material-bronze` (4,67:1 medido) — regra geral: **--gold nunca como texto em fundo claro** |
| Sem nenhum elemento do "arquivo vivo" — as únicas telas sem alma da plataforma | P3 | Baixo | Reusar `GenealogicalMark` + tom do acervo ("Esta página não consta no arquivo.") |

### 4.16 Overlays (busca ⌘K, gaveta "Mais", AlertDialogs, Sheets)

**Bom:** cmdk com navegação por teclado e título acessível; gaveta mobile com estado ativo; AlertDialogs com verbos específicos ("Excluir definitivamente").

| Problema | Sev. | Esforço | Recomendação |
|---|---|---|---|
| Busca ⌘K não indica escopo (só clientes ativos) — usuário buscará sessões/conceitos e achará que não existem | P2 | Baixo | Placeholder honesto: "Buscar clientes ativos…" + linha de rodapé "Sessões e biblioteca em breve" |
| Botão de recolher sidebar tem 24px (`size-6`) | P2 | Baixo | `size-8` mínimo com área clicável de 40px |

---

## 5. Análise de consistência entre páginas

1. **Duas paletas douradas.** Landing usa `#D4AF37`; o app usa `--gold #D4A843`. Lado a lado (landing → login) o dourado "muda de temperatura". Unificar no token.
2. **Verbo ↔ confirmação: bom.** "Arquivar" → toast "Dossiê arquivado."; "Excluir definitivamente" → "Dossiê removido permanentemente." Padrão correto e raro — manter como regra escrita.
3. **Breadcrumbs:** convenção `DocumentHeader` prefixa "Instituto Liz /"; 3 telas passavam o prefixo duplicado (2 corrigidas, Guia ainda não). Documentar a regra no próprio componente (JSDoc).
4. **Escala tipográfica oficial vs. praticada:** `styles.css` define `type-display/headline/title/body/caption/label/eyebrow`, mas as rotas usam `text-[Npx]` arbitrário (14+ valores). O sistema existe; ninguém o consome. Consolidar em ~6 tamanhos e fazer sweep.
5. **Ícones: consistentes.** 100% lucide-react, stroke 1.5–1.75 intencional. Nenhuma mistura de biblioteca — ponto forte objetivo.
6. **Sombras:** utilitários quentes (`shadow-surface/dossier/lifted`) convivem com resquícios de sombras arbitrárias (`shadow-md`, `shadow-2xl`, `shadow-sm`) em ~20 pontos. Sweep de substituição.
7. **Selo de cera** aparece em Mesa, empty states e biblioteca — à beira do limite. O manifesto diz: identidade pela consistência, **não pela repetição**. Regra sugerida: 1 relíquia por tela, no máximo.
8. **Motion:** `loadReveal` global + `ink-draw` + framer pontual, todos sob `prefers-reduced-motion` global — disciplina correta e verificada em `styles.css:418`.

---

## 6. Plano de ação priorizado

| # | Sev. | Página | Problema | Recomendação | Esforço |
|---|---|---|---|---|---|
| 1 | P0 | Mesa, Agenda, empty states | Títulos de seção `ink/40` a 2,43:1 | `text-warm-gray` (5,43:1) | Baixo |
| 2 | P0 | Auth | Recuperação de senha inexistente | Fluxo completo com Supabase reset | Médio |
| 3 | P0 | Segundo Cérebro | Simulação parece análise real | Chip "Demonstração" por bolha + banner fixo | Baixo |
| 4 | P1 | Landing | Paleta paralela hardcoded | Migrar para tokens | Médio |
| 5 | P1 | Landing | "Ver como funciona" morto | Remover ou ancorar | Baixo |
| 6 | P1 | Auth | Erros crus em inglês | Mapa de mensagens PT | Baixo |
| 7 | P1 | Clientes/Dossiê | Terracota 3,84:1 em texto pequeno | `clinical-critical` p/ texto | Baixo |
| 8 | P1 | Agenda | "IA Clínica detectou" p/ motor de regras | "Padrões detectados" | Baixo |
| 9 | P1 | Dossiê | Copiloto invisível no mobile | Drawer inferior | Médio |
| 10 | P1 | 404/Erro | Gold 2,03:1 em fundo claro | `material-bronze` | Baixo |
| 11 | P1 | Global | 14+ tamanhos de fonte arbitrários | Consolidar na escala `type-*` | Alto |
| 12 | P2 | Guia | Breadcrumb duplicado | Remover prefixo | Baixo |
| 13 | P2 | Config | Dark mode fantasma | Toggle ou remoção | Médio |
| 14 | P2 | Global | Alvos de toque 24–32px | `size-9`+ em icon buttons | Baixo |
| 15 | P2 | Gêmeas | Links não abrem a aba certa | `?tab=` no dossiê | Baixo |
| 16 | P2 | Mesa | Flash "0" antes dos dados | Skeletons inline | Baixo |
| 17 | P2 | Global | Renders `<img>` sem dimensões (CLS) | `width/height` + `aspect-ratio` | Baixo |
| 18 | P2 | Biblioteca | Conteúdo hardcoded na rota | Extrair p/ `src/content/` | Alto |
| 19 | P2 | Landing | Hover via JS | Classes `hover:` | Baixo |
| 20 | P2 | Warning | `clinical-warning` 3,09:1 | Usar `--bronze` (4,67:1) p/ texto | Baixo |
| 21 | P3 | Paciente | "Gerar briefing IA" disabled perpétuo | Remover | Baixo |
| 22 | P3 | 404/Erro | Sem identidade do arquivo | `GenealogicalMark` + copy | Baixo |
| 23 | P3 | Global | `background-attachment: fixed` (jank mobile) | Trocar por pseudo-elemento fixo | Baixo |
| 24 | P3 | Agenda | Nota rápida só local | Sincronizar no futuro | Alto |
| 25 | P3 | Biblioteca | Trilho IA só em `xl` | Liberar em `lg` | Baixo |

## 7. Quick wins (baixo esforço × alto impacto — fazer primeiro)

1. **#1** Contraste dos títulos de seção (1 classe, ~10 arquivos) — resolve o P0 mais visível em minutos.
2. **#3** Rotular a demonstração do Segundo Cérebro — protege a credibilidade clínica.
3. **#5** Matar o botão morto da landing.
4. **#8** Renomear "IA Clínica detectou".
5. **#10 + #22** 404/Erro: bronze no eyebrow + marca genealógica.
6. **#12** Breadcrumb do Guia.
7. **#7 + #20** Semáforo clínico legível (terracota/âmbar → tokens medidos).
8. **#15** Abrir a aba certa a partir das telas gêmeas.

---

*Notas de verificação: contrastes "(medidos)" calculados por luminância relativa WCAG 2.1 sobre os hex de `src/styles.css` e composições de opacidade; telas com dados reais avaliadas por código (RLS local impede popular o banco); nenhuma página do mapeamento ficou sem avaliação.*
