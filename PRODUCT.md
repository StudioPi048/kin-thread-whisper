# GENEALIZ

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Psicogenealogistas, principalmente profissionais que atendem clientes e investigam relações familiares ao longo de várias sessões. Confirmado por Pietro em 06/10/2026 e no plano por ele aceito.

## Product Purpose

Organizar clientes, histórias familiares, sessões e acervo para apoiar o trabalho do profissional. O pedido atual é reformular e unificar toda a interface antes de evoluir os motores técnicos.

## Operating Context

Agenda → dossiê → genossociograma/linha do tempo/anamnese/sessões/planilha. Biblioteca e guia apoiam consulta; configurações e autenticação suportam acesso. Desktop durante atendimentos é uma hipótese em confirmação, com mobile responsivo obrigatório.

## Capabilities and Constraints

Rotas existentes em src/routes. Preservar contratos de dados, autenticação, URLs, cadastros, importação e exportação. Não alterar registros clínicos reais durante a reforma. Na evolução de 02/11/2026, o chat demonstrativo foi removido: hipóteses provisórias derivam de evidências registradas, com fontes, limites e revisão humana. Isso não equivale a diagnóstico ou validação clínica. Não inventar relatórios, resultados, estatísticas, assinaturas ou alegações de segurança. A matriz em `design/evolution-2026-11-02/status.md` registra implementação, verificações e integrações ainda não testadas.

## Brand Commitments

Nome oficial confirmado pelo usuário em 06/10/2026: GENEALIZ. Essa correção prevalece sobre nomes anteriores. Instituto LIZ é a origem institucional. O pedido atual autoriza substituir a aparência visual em todas as páginas. Logos e retratos existentes devem permanecer íntegros, usados apenas quando relevantes.

## Evidence on Hand

Código GitHub StudioPi048/kin-thread-whisper, Lovable projeto 0bbf5716-9319-44ef-94e7-0852e32026e1 e registro remoto GeneaLiz (Kin Thread). Dados sintéticos devem ser rotulados em previews. Nenhum dado de paciente foi obtido para desenhar ou testar a interface.

## Product Principles

- Fidelidade dos vínculos e clareza de contexto.
- Decisões do profissional, com origem da informação e hipóteses revisáveis.
- Continuidade entre agenda, dossiê, árvore e histórico.
- Interface consistente e legível durante o atendimento.
- Funções demonstrativas claramente distinguíveis de funções operacionais.

## Regra estrutural confirmada — 06/10/2026
Cliente/paciente-índice sempre no topo. Gerações anteriores descem: pais, avós e assim por diante. Cada filho liga-se à união dos respectivos pais; o eixo do cliente e dos ancestrais diretos fica centralizado na união parental. Preservar o motor existente; mudanças estéticas e dados de demonstração não podem impor orientação contrária.

## Regra absoluta do genossociograma
Cliente e irmãos sempre no topo; pais abaixo; avós abaixo dos pais. Nunca inverter. Ligações de filiação sempre pela união correta dos pais.

## Hipóteses clínicas
Só a partir de evidências registradas, sempre com fontes, limites e perguntas. Sem dados, sem hipótese.
