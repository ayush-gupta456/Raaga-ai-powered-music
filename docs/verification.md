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
Verified on the private production site on 2026-10-29 (India time):
- Real prompt-only vocal generation through the configured ACE Music key succeeded.
- First transfer failed at the browser despite server HTTP 200. A manual retry delivered playable audio; no automatic generation retry was added.
- Browser audio reported duration 272 seconds, readyState 4, paused false and no media error. Playback was started and paused using native controls.
- Download Song saved `First-Light.mp3`: 4,353,069 bytes, validated MPEG signature and MIME `audio/mpeg`.
- Starting another generation removed the previous audio player immediately; Stop waiting cancelled the local request.
- Refresh returned an empty prompt and zero audio players. Closing and reopening the site also returned an empty prompt and zero players.
- The provider returned 4:32 despite a 30-second requested target in prompt-only sample mode. Exact duration enforcement is NOT verified and must not be promised. Earlier custom-lyrics releases generated 30- and 120-second songs.
- Live access remained owner-private. No persistent app storage is configured; static source tests confirm the React client has no storage writes. Provider-side retention cannot be audited by this app.

The clearer transfer-error wording was then type-checked, linted and rebuilt for both targets. A Windows file-lock interrupted one hosted rebuild while its preview was running; stopping that preview and rebuilding succeeded.

## Changed source groups
- React interface/lifecycle: `components/music-studio.tsx`, `client/session.mjs`, `app/page.tsx`, `app/layout.tsx`, `public/style.css`.
- Shared API/provider: `lib/music.mjs`, `lib/providers/ace-music.mjs`, `lib/audio.mjs`, `lib/http.mjs`, `lib/limits.mjs`, `worker/index.ts`.
- Node target/config: `server/index.mjs`, `node-web/`, `vite.node.config.ts`, `.env.example`, `.gitignore`, package manifests and ESLint configuration.
- Tests/docs: `tests/music.test.mjs`, README and `docs/`.
- Removed obsolete persistent client: `public/app.js`, `web/studio.html`; unused database scaffolding: `db/`, Drizzle config/metadata, `examples/d1/`. No existing browser data was deleted.

## Deliberate limits
Provider access, credits, availability and output quality remain external dependencies. Final duration may vary. Progress percentages are not available. Cancellation stops Raaga waiting but may not cancel remote processing. Counters expire per instance; there are no stored jobs/files. Provider-retained copies and user downloads are not deleted by refresh. This remains owner-private, with loopback-only local Express support.


## Lyrics composer restoration — 2026-10-29
Reviewed the active React UI, Blob session lifecycle, shared API/provider, validation, rate limits, audio handling, Express adapter and hosting configuration. Restored the visible Lyrics editor above the separate Song Style / Description field, with vocal-lyrics validation and instrumental controls. Sound presets now preserve lyrics already written instead of resetting the form. The backend and storage lifecycle remain unchanged. Existing provider duration and per-instance quota limitations still apply. The prior live audio evidence above belongs to the preceding release; this design restoration uses the same provider payload path.
