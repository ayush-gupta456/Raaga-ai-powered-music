# Raaga Studio

A private, stateless React music studio using the official ACE Music API. Enter your lyrics and a separate song style/description, choose a duration range, create, preview and download. Vocal songs require your lyrics; Instrumental mode creates music without them. The existing design, presets, instruments, language, tempo and 10–600 second controls are retained.

## Data lifecycle
The current form and result exist only in React state. Generating again replaces the result. Refresh, reopen or Start fresh returns to an empty studio. Blob URLs are revoked on replacement, reset and page exit. Download songs before leaving.

No database, browser storage, history endpoint, audio files or object storage are used for new generations. Legacy browser data from earlier versions is left untouched, but is not read or displayed. Provider-held copies and downloaded files are outside Raaga's cleanup.

## Architecture
`components/music-studio.tsx` → `POST /api/music/generate` → `lib/music.mjs` → `lib/providers/ace-music.mjs` → official ACE Music → validated binary audio → browser Blob player/download.

Production retains the private Sites Cloudflare Worker (`worker/index.ts`). A Node/Express entrypoint (`server/index.mjs`) runs the same API and React interface locally. No scraping, selectors, cookies or access-control bypass is used. The documented provider is synchronous, so there are no invented job, progress or polling endpoints. `GET /api/music/status` reports configuration only.

Requests and responses are bounded (32 KB input, 16 MB provider JSON). Audio signatures and MIME types are validated for MP3/WAV/FLAC. Credentials remain on the backend; redirects and arbitrary audio URLs are rejected. The UI shows elapsed time, supports stopping the local request, and retries only on user action. Cancellation cannot guarantee cancellation at the provider.

## Configuration
Production uses the Sites secret `ACESTEP_API_KEY`. For local Node use, copy `.env.example` to `.env` and enter your own key there. `.env` is ignored by Git. Never put secrets in React variables or commit them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ACESTEP_API_KEY` | Required | ACE Music account API key |
| `ACESTEP_MODEL` | Discovered | Optional model override |
| `MUSIC_TIMEOUT_MS` | 600000 | Processing timeout; 10–900000 ms |
| `MUSIC_MAX_CONCURRENT` | 2 | Per-instance concurrency; 1–10 |
| `MUSIC_MAX_REQUESTS` | 3 | Per-user requests per window; 1–100 |
| `MUSIC_RATE_WINDOW_MS` | 60000 | Counter retention; 10–3600000 ms |
| `PORT` | 3000 | Local Express port |

Only expiring rate/concurrency counters exist in server memory. No prompt/audio/job records are retained. Restart discards counters. In-flight work ends at timeout or disconnect; a provider that ignores abort may finish remotely. There are no temporary files requiring restart cleanup.

## Run and verify
Node 22.13 or later is required.

```sh
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build:node
npm run start:node
```

Open `http://127.0.0.1:3000`. Express binds to loopback only and checks the exact origin. It is a local single-user server, not a public authentication system. Production uses Sites' trusted visitor identity and retains owner-private access. Do not expose Express publicly without adding proper authentication and deployment controls.

The hosted build uses `npm run build` (or the Sites build helper); `npm run dev` provides the existing Worker development flow. See [architecture and audit](docs/stateless-upgrade.md) and [verification record](docs/verification.md).

## Limits
ACE Music controls availability, account credits, accepted duration and output quality. The requested target falls inside your chosen range; actual length may differ. A ten-minute setting is not a guarantee that the provider will generate ten minutes. The 16 MB response limit can reject large outputs. No automatic retry occurs after ambiguous failures.

Rate/concurrency enforcement is per process/Worker isolate, not a distributed quota. This remains a private personal studio. A public multi-user service requires separate distributed abuse controls. Provider retention follows its own policies.

## Official references
- [ACE-Step cloud API](https://github.com/ace-step/ace-step-skills/blob/main/skills/acestep/api-reference.md)
- [ACE-Step skills](https://github.com/ace-step/ace-step-skills)
- [React cleanup](https://react.dev/reference/react/useEffect)
- [Blob URL cleanup](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)
- [Express security](https://expressjs.com/en/advanced/best-practice-security/)

Companion skills assist development; the deployed website calls its server adapter directly.


## Account authentication on Node / Vercel
The Node entrypoint now requires verified Better Auth sessions for the studio and every music API route. Accounts, hashed passwords, sessions and verification records use MongoDB; prompts and generated songs remain session-only. See [complete authentication setup](docs/authentication.md). The existing chatgpt.site Worker retains its platform-managed sign-in and is not changed by the Vercel implementation.

Local Node use now requires the authentication variables in `.env.example`, not just a music API key. Build with `npm run build:vercel` for Vercel, or `npm run build:node` for local Express. Without configured auth credentials the UI displays setup status and private API routes fail closed. Vercel project `raaga-studio` was created, but deployment is pending team authorization and provider credentials.
