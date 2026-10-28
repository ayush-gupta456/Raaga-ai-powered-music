# Verification record

## Automated checks — 2026-10-29
- 29/29 tests passed. Provider fixtures are isolated mocks, not evidence of live generation.
- ESLint: passed, no warnings after cleanup.
- TypeScript: `npx tsc --noEmit` passed.
- Node/Vite production build: passed.
- Hosted Sites/Vinext production build: passed. Vinext reports its known static route-classification notice.
- Local Express browser preview: correct empty studio, duration controls, presets and explicit missing-key state; local secrets were not copied from production.

Tests cover payload mapping and duration validation, prompt-only vocals, custom lyrics, instrumentals, input size, origin/identity, missing configuration, binary format/signature validation, safe filenames, provider errors, blocked redirects/access, arbitrary URLs, timeout/cancellation cleanup, rate expiry, duplicate prevention, Blob replacement/revocation, absence of persistence/history, and real local Express HTTP routing with a mocked provider.

## Live acceptance
Pending verification against the newly deployed version. Earlier releases generated real 30- and 120-second audio; that evidence alone does not verify this upgrade.

## Changed source groups
- React interface/lifecycle: `components/music-studio.tsx`, `client/session.mjs`, `app/page.tsx`, `app/layout.tsx`, `public/style.css`.
- Shared API/provider: `lib/music.mjs`, `lib/providers/ace-music.mjs`, `lib/audio.mjs`, `lib/http.mjs`, `lib/limits.mjs`, `worker/index.ts`.
- Node target/config: `server/index.mjs`, `node-web/`, `vite.node.config.ts`, `.env.example`, `.gitignore`, package manifests and ESLint configuration.
- Tests/docs: `tests/music.test.mjs`, README and `docs/`.
- Removed obsolete persistent client: `public/app.js`, `web/studio.html`; unused database scaffolding: `db/`, Drizzle config/metadata, `examples/d1/`. No existing browser data was deleted.

## Deliberate limits
Provider access, credits, availability and output quality remain external dependencies. Final duration may vary. Progress percentages are not available. Cancellation stops Raaga waiting but may not cancel remote processing. Counters expire per instance; there are no stored jobs/files. Provider-retained copies and user downloads are not deleted by refresh. This remains owner-private, with loopback-only local Express support.
