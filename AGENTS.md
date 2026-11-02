<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Project rules
- Genossociograma: CLIENTE E IRMÃOS SEMPRE NO TOPO (geração 0, menor Y); pais abaixo, avós abaixo dos pais. Never invert to ancestors-on-top. Every person links to its parents through the correct UnionNode. Explicit `parent` relationships override tag-based filiation; persons without known filiation are never attached to the proband's parents. Guarded by `src/lib/geno/invariants.test.ts` — run `bunx vitest run` before changing `src/lib/geno/*`.
- Clinical hypotheses come only from `src/lib/evidence.ts` (built on `detectPatterns`); no fixed fallbacks, no simulated chat, no numeric confidence — why: hypotheses must be traceable to recorded evidence.
- Case evidence is fetched only via `clinicalIntelQuery` in `src/lib/clinical-intel.ts` (key `["clinical-intel", clientId]`, full shape) — why: one key must never hold two data shapes.
- Per-user UI memory (resume visits, list filters, onboarding dismissal) lives in `src/lib/recent-activity.ts`, localStorage, IDs/tabs only — why: no clinical data in the browser storage.
- Design tokens: a single `:root` block in `src/styles.css`; DESIGN.md is the spec — why: avoid Atlas/Arquivo vivo override contradictions.
- Clan spreadsheet imports go through `src/lib/clan-import.ts` (preview/validation) and the transactional RPC `import_genogram_persons` — why: a failed import must never leave a partial or emptied sheet.
- After any family/relationship mutation call `invalidateCase()` from `src/lib/clinical-intel.ts` — why: every evidence surface must refresh together.
- Agenda times/day boundaries are computed in the viewer's IANA time zone via `src/lib/scheduling.ts`; reschedules are revalidated server-side in `rescheduleSession` — why: the server runs in UTC and conflicts must not depend on client checks.
- Session clinical status and audio pipeline state are separate (`src/lib/session-state.ts`); professional notes live in `manual_notes`, never overwritten by audio processing, drafts kept in memory only — why: audio failure must never lose notes and no clinical text goes to browser storage.
- Hypothesis reviews are append-only rows in `hypothesis_reviews` (owner forced by trigger, RLS by professional + client, versioned with an evidence fingerprint from `src/lib/hypothesis-review.ts`) — why: review history must be auditable and flag reviews made on outdated evidence.
- Synthetic families for tests/landing live in `src/lib/geno/fixtures.ts`; never use real patients in fixtures, demos or screenshots — why: clinical data privacy.
- User preferences live in `profiles.preferences` (parsed by `src/lib/preferences.ts`) — why: account settings must follow the user across devices.
