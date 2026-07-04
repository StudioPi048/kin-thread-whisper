# Plano — MVP Fase 1 (Plataforma Psicogenealogia)

Público: psicogenealogistas beta. Identidade: Instituto Liz.
Backend: Lovable Cloud (auth, banco, storage). IA: Lovable AI Gateway.

## Escopo desta fase (do PRD)

Entra no MVP:

1. Auth + onboarding do profissional (email/senha + Google)
2. Cadastro completo de clientes (dossiê multi-dimensional)
3. Genossociograma interativo (React Flow, drag & drop, campos por nó)
4. Linha do tempo biográfica (a partir dos dados dos nós)
5. Motor de padrões v1 (repetições simples: doença, causa de morte, idade de morte, profissão, rupturas)
6. Diário clínico por voz (gravação → transcrição via `openai/gpt-4o-mini-transcribe` → prontuário estruturado via Gemini)
7. Biblioteca sistêmica básica (autores-base, busca por texto)
8. Dashboard sistêmico básico (contagens por família)

Fora do MVP (Fases 2/3, não construir agora):
Questionário adaptativo com IA, Linha dos Nomes/guematria, Cabalá, Decodificação Dental, busca semântica entre casos, comunidade, marketplace, mobile.

## Ordem de construção (entregas verticais utilizáveis)

**Etapa 1 — Fundação (esta iteração)**

- Habilitar Lovable Cloud
- Identidade visual do Instituto Liz (paleta, tipografia, tokens em `src/styles.css`)
- Landing + auth (email/senha + Google)
- Estrutura de rotas: `/auth`, `/_authenticated/clientes`, `/clientes/$id`, `/biblioteca`, `/configuracoes`
- Tabela `profiles` + `user_roles` (admin/profissional) + RLS
- Layout do app autenticado (sidebar Instituto Liz)

**Etapa 2 — Dossiê do cliente**

- CRUD de clientes com dossiê: dados pessoais, biográficos, familiares, saúde, econômico, afetivo
- Upload de mídia (fotos, docs, áudios) → Lovable Cloud Storage
- Consentimento LGPD embutido no cadastro

**Etapa 3 — Genossociograma vivo**

- Canvas React Flow por cliente
- Nós = pessoas com todos os campos do PRD §6.1
- Vínculos tipados (pai, mãe, cônjuge, filho…) com qualidade do vínculo
- Persistência incremental por nó/aresta

**Etapa 4 — Linha do tempo + Motor de padrões v1**

- Timeline biográfica derivada dos eventos dos nós
- Detector server-side de repetições: doença, causa de morte, idade de morte ± 2, profissão, rupturas, síndrome de aniversário
- Painel "Padrões detectados" no caso

**Etapa 5 — Diário clínico por voz**

- Gravação no navegador (Web Audio → WAV)
- Server function transcreve (`openai/gpt-4o-mini-transcribe`)
- Server function estrutura prontuário (`google/gemini-3-flash-preview`) com regras do §7.1 (hipótese vs fato, humildade epistêmica)
- Vínculo com a sessão do cliente

**Etapa 6 — Biblioteca + Dashboard**

- Biblioteca seedada com autores-base (Schützenberger, Jodorowsky, Hellinger, Dolto, etc.) — verbetes editáveis por admin
- Busca textual
- Dashboard sistêmico do caso: contagens por categoria (§6.9)

## Detalhes técnicos

- **Stack**: TanStack Start já configurado. React Flow para o genograma. Framer Motion para transições sutis.
- **Banco**: schema com `clients`, `client_media`, `genogram_nodes`, `genogram_edges`, `sessions`, `session_notes`, `patterns_detected`, `library_entries`, `profiles`, `user_roles`. RLS: profissional só vê seus próprios clientes; admin (Liz) tem visão global.
- **Roles**: enum `app_role` = `admin` | `professional`. Função `has_role` SECURITY DEFINER. Admin seed: `studiopi048@gmail.com` (Liz).
- **IA (server-only)**: `src/lib/ai/*.functions.ts` protegidas por `requireSupabaseAuth`. Nunca expor `LOVABLE_API_KEY` no client.
- **LGPD**: consentimento explícito no cadastro do cliente; dados de terceiros marcados como "contexto clínico"; export/exclusão pelo profissional.
- **Segurança**: RLS em todas as tabelas; grants explícitos; nada de service-role em rotas públicas.

## Perguntas rápidas antes de começar

1. **Cores/logo do Instituto Liz**: você tem paleta oficial (hex) e logo em SVG/PNG? Se não, proponho uma paleta sóbria (bordô profundo + creme + tinta preta, tipografia serifada editorial estilo Freud/psicanálise clássica) inspirada em institutos de formação clínica.
2. **Confirma** que quer que eu **habilite Lovable Cloud agora** e comece pela **Etapa 1** nesta mesma iteração?

Após sua aprovação, executo a Etapa 1 completa e paro para você validar antes da Etapa 2.
