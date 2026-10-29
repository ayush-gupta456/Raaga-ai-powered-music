# Analytics and AI observability

Raaga uses PostHog for explicit product events and server-side ACE Music timing/outcomes. It does not record lyrics, song descriptions, titles, audio, passwords or personal music keys.

## Configure

Create a PostHog project, then add these variables to Vercel Production and redeploy:

| Variable | Value |
| --- | --- |
| `POSTHOG_PROJECT_TOKEN` | Public project ingestion token (`phc_…`), not a personal API key (`phx_…`). |
| `POSTHOG_HOST` | `https://us.i.posthog.com` or `https://eu.i.posthog.com`, matching the project region. |

The server exposes only this public configuration at `/api/analytics/config`. The browser SDK loads lazily when configuration is valid. No build-time `VITE_` token is required. An empty token disables new analytics after redeployment. Missing/blocked analytics never prevents music creation.

## Events

| Event | Measures |
| --- | --- |
| `page_viewed`, `$pageview` | Allowlisted authentication/studio views; query strings and hashes are excluded. |
| `account_created` | Successful registration request, including generic anti-enumeration responses; not a precise count of database accounts. |
| `sign_in_completed`, `sign_out_completed` | Email form sign-in and sign-out actions. OAuth identity is associated when its session loads. |
| `ace_key_connected`, `ace_key_disconnected` | Connection actions, never key values or a claim of provider validation. |
| `song_generation_started`, `song_generation_succeeded` | Generation started and audio response received. |
| `song_generation_failed`, `song_generation_cancelled` | Browser-visible failures and local cancellation. |
| `song_played`, `song_downloaded` | Player/download interactions; a download click is not proof a file was saved. |
| `$ai_generation` | Server provider/model, trace UUID, latency, outcome/error code, mode and requested duration. |

ACE Music is a custom music provider. No token usage or billing is invented. Single-shot traces use `$ai_session_id: null`. Generation telemetry starts after auth, origin, input and quota checks and uses bounded, fail-open flushing.

## Useful dashboard views

- Unique signed-in users by `page_viewed`.
- Studio → generation → playback → download funnel.
- Generation counts and failures by outcome.
- Average/p95 `$ai_latency` and `$ai_is_error` rate.

Create these in PostHog Product Analytics/AI Observability. Browser identity is memory-only, so anonymous visitor figures are session-level estimates rather than durable cross-visit counts.

## Privacy

Autocapture, session recording, automatic pageview collection, surveys and exception capture are disabled. Only explicitly selected application properties are sent. URLs are reconstructed from the site origin and an allowlisted view; referrers, query/hash/marketing metadata and initial person-property bags are removed before dispatch. Names and email addresses are not used for identification; signed-in activity uses the backend account ID.

Accounts and usage events are retained according to the owner's PostHog settings; this is separate from Raaga's session-only song lifecycle. Production browser security policy permits only the configured official PostHog ingestion/asset hosts.

## Verify

Open the deployed app and perform an action. Confirm events in PostHog Activity and a real generation trace in AI Observability. Automated tests cover event redaction and failure isolation; they do not send production analytics. The production project's onboarding previously reported **Installation complete**, confirming browser event delivery at that time. Recheck after configuration changes.

## Development MCP

The official command is `npx @posthog/wizard mcp add`. It requires a compatible Node version and an authorized PostHog connection. In the development session, the wizard reported adding supported-client configuration; that does not prove every client's connection is authorized. Install/authorize the PostHog connection in the client you actually use. Never put a personal API key into app frontend variables.

References: [React SDK](https://posthog.com/docs/libraries/react) · [Node SDK](https://posthog.com/docs/libraries/node) · [Custom-provider traces](https://posthog.com/docs/ai-observability/installation/manual-capture)
