# Evolução GENEALIZ — 02/11/2026 · Matriz de status

Legenda: **Implementado+verificado** (código feito e teste/build executado) · **Parcial** · **Não iniciado** (nesta execução) · **Bloqueado** (exige teste real/integração externa).

Verificação executada nesta execução: `bunx vitest run` → 8/8 testes passando; build do preview "build OK". Nenhum dado clínico real foi acessado. Não houve teste de e-mail, gravação de áudio, RLS nem capturas desktop/mobile.

| # | Item | Status | Evidência / pendência |
|---|------|--------|-----------------------|
| 0 | Regra absoluta: cliente e irmãos no topo | Implementado+verificado | `src/lib/geno/invariants.test.ts`: cliente geração 0 / menor Y; irmãos na mesma linha; pais abaixo; avós abaixo dos pais; irmãos filhos da mesma união Pai+Mãe; pai→avós paternos, mãe→avós maternos; 2º casamento rotulado. Regra em `AGENTS.md` e `PRODUCT.md`. Engine não alterado. |
| 0b | Testes meios-irmãos | Bloqueado | O motor (`build.ts`) não tem tag/modelo de meio-irmão (só "Irmã(o)" da união Pai+Mãe). Exige decisão de modelo de dados antes de testar. |
| 1 | Mesa (banner, retomar, onboarding) | Não iniciado | — |
| 2 | Navegação/contexto/índice | Não iniciado | — |
| 3 | Clientes/dossiê (lista, estados, retry) | Não iniciado | — |
| 4 | Genossociograma (grupos de ação, drawer, rascunho, desfazer) | Não iniciado | Autosave e Salvar Layout existentes preservados. |
| 5 | Agenda (semana/dia, reagendar com validação) | Não iniciado | — |
| 6 | Anamnese/planilha/importação | Não iniciado | — |
| 7 | Sessões (estados, proteção de saída) | Não iniciado | Gravação exige teste real com microfone. |
| 8 | Linha do tempo (filtros, datas aproximadas) | Não iniciado | — |
| 9a | P0 remover fallback "Lealdade Sistêmica Oculta" | Implementado+verificado | `clinical-intelligence-panel.tsx` usa `buildHypotheses`; sem padrões mostra estado vazio. Teste `src/lib/evidence.test.ts` ("sem dados não gera hipótese"). |
| 9b | P0 remover chat simulado (setTimeout/keywords) | Implementado | `_authenticated.app.ia-clinica.tsx` reescrita: caso → evidências (`detectPatterns`) → hipóteses com fontes, limites e perguntas; erro com "Tentar de novo". Sem confiança numérica (testado). Não verificado no navegador. |
| 9c | Fonte única/invalidação | Parcial | Dossiê e IA Clínica usam `evidenceForCase/buildHypotheses` e a mesma chave `["clinical-intel", clientId]`. Mesa/Agenda (`genogram.functions.ts`) ainda usam suas próprias regras. `patterns_detected` sem escrita: não usado. |
| 9d | Revisão/contestação persistente, copiloto em drawer mobile | Não iniciado | Exige tabela nova + RLS. |
| 10 | Biblioteca/guia | Não iniciado | — |
| 11 | Conta/auth/landing | Não iniciado | Google/recuperação de senha não tocados. |
| 12 | Qualidade (zoom 200%, AA medido, 390px, reduced-motion) | Não iniciado | Só a nova página IA Clínica usa alvos ≥44px, rótulos e foco visível. |
| — | Tokens CSS / DESIGN.md consolidados | Não iniciado | — |

**Conclusão honesta:** esta execução entregou os P0 de evidências/IA e os testes da regra do genossociograma. Os demais itens (1–8, 10–12) continuam pendentes e precisam de execuções seguintes, superfície por superfície.
