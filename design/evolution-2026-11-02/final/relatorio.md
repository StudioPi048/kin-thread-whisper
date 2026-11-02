# Verificação final — main caeddc0 — 02/11/2026

Ambiente: `vite.visual.config.ts` (fixtures sintéticos em memória, porta 4173). Sem banco real, sem auth/RPC/áudio externos, sem microfone, sem importação "substituir", sem publicação, sem e-mail.

## Resultado por item (desktop 1280 e 390 CSS px; innerWidth medido)
| Item | Resultado | Evidência |
|---|---|---|
| Capa sem diagrama | OK — só fotografia de arquivo; nenhum GenogramDemo | desk-capa.png, m390-capa.png |
| Mesa | OK, sem overflow | desk-mesa.png, m390-mesa.png |
| Mapa: Helena e irmão Pedro no topo; pais Carlos/Mariana abaixo; avós abaixo dos pais | OK | desk-mapa.png, m390-mapa.png |
| Ficha mobile | OK — abre em painel inferior ao tocar Helena | m390-ficha-mobile.png |
| Ferramentas mobile | OK — aria-expanded true→false, comandos acessíveis | m390-ferramentas-aberto.png |
| Agenda dia/semana | OK | *agenda-dia.png, *agenda-semana.png |
| Planilha | OK | desk-planilha.png, m390-planilha.png |
| Biblioteca dentro do caso | OK — painel lateral "Consultar biblioteca" | desk-biblioteca-caso.png |
| Guard de saída (Helena › Sessões, nota temporária → aba Planilha) | OK — diálogo Ficar/Descartar/Salvar; "Ficar aqui" manteve o texto e a aba Sessões; depois "Descartar e sair" levou à Planilha | desk-guard-dialogo.png, desk-guard-descartado.png |
| Botões sem nome acessível | 0 em todas as telas | medicoes.json |
| Erros de página | 0 | medicoes.json |

## Falha encontrada e corrigida (P1)
- Em 390px, a barra de abas fixa do dossiê ultrapassava 6px a largura (scrollWidth 396): margem negativa de 24px contra recuo de 18px do contêiner. Corrigido para 18px em `_authenticated.app.clientes.$clientId.tsx`. Remedido: scrollWidth 390 no mapa, planilha e biblioteca.

## Limites
- Persistência, RLS, RPC, reagendamento real, áudio/microfone, e-mails e "substituir" não foram executados (o ambiente não prova isso).
- Selo "Preview local · dados fictícios" aparece só neste ambiente e sobrepõe levemente o canto inferior; não existe no app real.
- Aprovação estética continua pendente da revisão de Pietro.
