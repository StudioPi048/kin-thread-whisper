# Evolução GENEALIZ — 02/11/2026 · Matriz de status

Legenda: **Implementado+verificado** (código feito e teste/build executado) · **Parcial** · **Não iniciado** (nesta execução) · **Bloqueado** (exige teste real/integração externa).

Verificação executada nesta execução: `bunx vitest run` → 8/8 testes passando; build do preview "build OK". Nenhum dado clínico real foi acessado. Não houve teste de e-mail, gravação de áudio, RLS nem capturas desktop/mobile.

| # | Item | Status | Evidência / pendência |
|---|------|--------|-----------------------|
| 0 | Regra absoluta: cliente e irmãos no topo | Implementado+verificado | `src/lib/geno/invariants.test.ts`: cliente geração 0 / menor Y; irmãos na mesma linha; pais abaixo; avós abaixo dos pais; irmãos filhos da mesma união Pai+Mãe; pai→avós paternos, mãe→avós maternos; 2º casamento rotulado. Regra em `AGENTS.md` e `PRODUCT.md`. Engine não alterado. |
| 0b | Testes meios-irmãos | Bloqueado | O motor (`build.ts`) não tem tag/modelo de meio-irmão (só "Irmã(o)" da união Pai+Mãe). Exige decisão de modelo de dados antes de testar. |
| 1 | Mesa (banner, retomar, onboarding) | Implementado (lógica testada; tela não vista no navegador) | `_authenticated.app.index.tsx` reescrita: o banner de 270px virou um cabeçalho de 1 linha; próximo atendimento (7 dias, com duração), pendências (registros de sessões passadas não concluídas + consentimentos) e Retomar ficam no 1º bloco. Retomar usa `src/lib/recent-activity.ts` (localStorage `genealiz:visits:<userId>`, só clientId/aba/horário), gravado pelo dossiê a cada troca de aba; `updated_at` não é mais usado como atividade. Primeiros passos dispensáveis com contagens reais (clientes, familiares, vínculos, sessões). Carregando/erro+retry/vazio separados. Testes: `recent-activity.test.ts` (4). |
| 2 | Navegação/contexto/índice | Parcial | A busca global (`_authenticated.tsx`) agora indexa páginas + clientes e reabre o cliente na última aba visitada. A aba do dossiê sincroniza com a URL (voltar/avançar mantém a aba). Termo "genossociograma" unificado em 7 textos; menu: "Mapas", "Evidências e hipóteses". Pendente: uma faixa constante com o cliente atual fora do dossiê. |
| 3 | Clientes/dossiê (lista, estados, retry) | Parcial | `clientes.index.tsx`: lista por padrão, grade opcional; aba/busca/visualização persistidas por usuário; o estado de erro com "Tentar de novo" ficou separado de vazio/sem resultado (+ "Limpar busca") e de carregando. O cabeçalho do dossiê já mostrava a próxima sessão. Pendente: compactar o cabeçalho do dossiê e escrever um resumo de lacunas na visão geral. |
| 4 | Genossociograma (grupos de ação, drawer, rascunho, desfazer) | Não iniciado | Autosave e Salvar Layout existentes preservados. |
| 5 | Agenda (semana/dia, reagendar com validação) | Não iniciado | — |
| 6 | Anamnese/planilha/importação | Não iniciado | — |
| 7 | Sessões (estados, proteção de saída) | Não iniciado | Gravação exige teste real com microfone. |
| 8 | Linha do tempo (filtros, datas aproximadas) | Não iniciado | — |
| 9a | P0 remover fallback "Lealdade Sistêmica Oculta" | Implementado+verificado | `clinical-intelligence-panel.tsx` usa `buildHypotheses`; sem padrões mostra estado vazio. Teste `src/lib/evidence.test.ts` ("sem dados não gera hipótese"). |
| 9b | P0 remover chat simulado (setTimeout/keywords) | Implementado | `_authenticated.app.ia-clinica.tsx` reescrita: caso → evidências (`detectPatterns`) → hipóteses com fontes, limites e perguntas; erro com "Tentar de novo". Sem confiança numérica (testado). Não verificado no navegador. |
| 9c | Fonte única/invalidação | Corrigido (bug de cache) | `src/lib/clinical-intel.ts` é a única queryFn da chave `["clinical-intel", id]` e devolve o formato completo (`client`, `persons`, `relationships`) no dossiê e na IA Clínica, o que elimina o `client:null` incompatível. Mesa/Agenda (`genogram.functions.ts`) ainda usam regras próprias. | Dossiê e IA Clínica usam `evidenceForCase/buildHypotheses` e a mesma chave `["clinical-intel", clientId]`. Mesa/Agenda (`genogram.functions.ts`) ainda usam suas próprias regras. `patterns_detected` sem escrita: não usado. |
| 9d | Copiloto mobile / seleção de evidências | Implementado (não visto no navegador) | Copiloto: botão fixo abaixo de 1024px abre uma gaveta (`Sheet`) com o mesmo conteúdo do desktop; perguntas vêm só das hipóteses com evidência (o fallback tendencioso "Quem no clã foi excluído…" foi removido). IA Clínica: evidências com checkbox, botão "Gerar hipóteses" desabilitado sem seleção, seleção zerada ao trocar de caso. As perguntas de `evidence.ts` foram reescritas como neutras (sem "silenciadas", sem "medo"). Revisão/contestação persistente: bloqueado (exige tabela + RLS). |
| 10 | Biblioteca/guia | Não iniciado | — |
| 11 | Conta/auth/landing | Não iniciado | Google/recuperação de senha não tocados. |
| 12 | Qualidade (zoom 200%, AA medido, 390px, reduced-motion) | Não iniciado | Só a nova página IA Clínica usa alvos ≥44px, rótulos e foco visível. |
| — | Tokens CSS / DESIGN.md consolidados | Parcial | `src/styles.css`: o 2º bloco `:root` (override "Arquivo vivo") foi removido e os valores fundidos no único `:root`; o azul Atlas residual em clinical-positive/olive/sepia/wood/graphite virou verde/neutro; superfícies neutras `#f6f6f4`. `DESIGN.md` reescrito com uma direção única e a tabela de contraste calculada (todos os pares ≥ 4.72:1). Pendente: há hex fixos em regras `.atlas-*`/`gv-*` posteriores e `!important` em ~1450–2400. |

## Lote 2 (02/11/2026 ~17:00 UTC) — verificação executada
- `bunx vitest run` → 3 arquivos, 12/12 testes passando (genossociograma 6, evidências 2, retomada/onboarding 4).
- `bunx tsgo --noEmit` → sem erros.
- `bunx eslint --fix` nos 12 arquivos alterados → 0 erros restantes.
- Build do preview: "build OK".
- Sem capturas desktop/mobile: as telas autenticadas mostram dados reais de clientes, e a regra proíbe usá-los em teste. Pendente: conta de teste com dados sintéticos.
- Regra cliente+irmãos no topo: motor não alterado; testes continuam passando.

**Conclusão honesta:** esta execução entregou os P0 de evidências/IA e os testes da regra do genossociograma. Os demais itens (1–8, 10–12) continuam pendentes e precisam de execuções seguintes, superfície por superfície.
