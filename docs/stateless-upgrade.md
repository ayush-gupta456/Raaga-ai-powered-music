# Stateless Raaga: repository review and implementation plan

Reviewed 2026-10-28. Upgrade the existing project and retain its private Sites identity and GitHub repository.

## Baseline audit

- The deployed UI is `web/studio.html` plus `public/app.js` and `public/style.css`, served directly by `worker/index.ts`. React/Vinext is installed but the original page bypasses it.
- `lib/music.mjs` calls the authenticated official ACE Music `/v1/models` and `/v1/chat/completions` endpoints. It returns inline base64 JSON. Real 30-second and 120-second songs were verified in earlier releases.
- `public/app.js` writes prompts to localStorage and drafts/audio Blobs to IndexedDB (`raaga-studio`, store `songs`). It restores them after reload and implements a library, import/export and a beforeunload prompt.
- `public/duration.mjs` plans a 10–600 second target from the user's minimum/maximum. Preserve this feature, presets, lyrics, language, tempo, instruments and styling.
- `.openai/hosting.json` has no D1 or R2 binding. `db/`, `drizzle/` and `examples/d1/` are unused starter examples, not a live database.
- `ACESTEP_API_KEY` is a Sites runtime secret; `ACESTEP_MODEL` is optional. No frontend credential is required. Sites supplies trusted visitor identity.
- Production is a Cloudflare Worker built by Vinext and the supplied Sites plugin. There is no existing Express server. A shared Express entrypoint will support Node deployment without replacing the existing host or duplicating the UI/provider logic.
- `components/ui`, hooks and connector helpers are retained starter assets. No unrelated functionality needs redesign.

## Chosen architecture

React state → same-origin POST → input/access/rate validation → provider adapter → bounded inline audio decode → audio response → temporary browser Blob URL → preview/download.

One synchronous request matches the verified provider contract. There is no job database, history API, file directory or object bucket. No polling endpoints or invented provider progress. The UI describes observable phases (requesting / receiving / ready), with elapsed time rather than percentages. Retry is explicit; do not retry a generation automatically after an uncertain network failure.

Only operational concurrency/rate entries remain briefly in server memory, with configurable expiry. Abort/timeouts release request references. Server restarts discard this state. Browser cleanup revokes audio URLs on replacement, reset, page exit and unmount. Back-forward cache restoration resets the interface. Old Raaga browser keys/database are deleted without reading their contents as a migration; no new persistent writes are introduced.

## Provider authorization and research

The official ACE-Step skill documentation explicitly identifies `https://api.acemusic.ai` as its cloud API and documents authenticated programmatic generation. Use that API with the user's existing key. No webpage scraping, cookies, selectors, CAPTCHA solving, paywall access or anti-bot bypass is implemented. Redirects are rejected, never followed with credentials. An access denial is surfaced and stops the request. We do not infer permission to scrape other sites, nor promise deletion of provider-held copies.

Sources reviewed:
- https://github.com/ace-step/ace-step-skills/blob/main/skills/acestep/SKILL.md
- https://github.com/ace-step/ace-step-skills/blob/main/skills/acestep/api-reference.md
- https://react.dev/reference/react/useEffect
- https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
- https://expressjs.com/en/advanced/best-practice-security/

Design: retain Raaga's charcoal/peach palette, composer, vinyl artwork and style presets. Replace the library with a single current-result card. Use a labelled prompt, optional custom lyrics, accessible waiting/error states, explicit retry, and a clear reminder to download before leaving. UI/UX Pro Max guidance supports truthful loading feedback and recoverable errors.

## Acceptance plan

Automated: payload/schema checks, actual MIME signatures, bounded body sizes, auth/origin/redirect rejection, provider failure mapping, no automatic generation retries, timeouts/cancellation, concurrency/rate expiry, frontend state lifecycle, Express routing, builds and lint.

Live: generate through configured ACE Music; play and download valid audio; replace a result; reload and reopen empty; verify no history controls/storage writes. Clearly distinguish mocked tests from live evidence. Maximum duration limits belong to the provider; testing one duration does not prove every language/style/length.
