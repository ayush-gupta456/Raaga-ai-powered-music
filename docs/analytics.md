# PostHog analytics and AI observability

## Activation
1. Create a PostHog account and project at https://app.posthog.com/signup. Choose the desired region.
2. Copy the **project token** (`phc_…`) from Project settings. This is a public ingestion token, not a personal API key (`phx_…`).
3. Add these Production variables in the existing Vercel raaga-studio project:
   - `POSTHOG_PROJECT_TOKEN`: the public project token.
   - `POSTHOG_HOST`: `https://us.i.posthog.com` for US, or `https://eu.i.posthog.com` for EU.
4. Redeploy. The Node app provides only this public configuration at `/api/analytics/config`; no build-time VITE variable or secret is needed.
5. Open the production website, sign in, connect a key and generate/play/download a song. In PostHog Activity, confirm events arrive. In AI Observability, confirm an ACE Music generation trace. This real delivery check requires the owner's configured project and is not claimed as completed.

## Events and dashboards
- `page_viewed`: view enum (sign-in, sign-up, recovery or studio); count total events and unique visitors/users for traffic. Identified users use the backend account ID, never name/email. Browser identity is memory-only, so anonymous visitors are session-level estimates.
- `account_created`, `sign_in_completed`, `sign_out_completed`: email form outcomes; account-created means the registration request succeeded, including the deliberately generic anti-enumeration response. Use backend account counts for actual registrations. OAuth user activity is linked when the signed-in session loads.
- `ace_key_connected`, `ace_key_disconnected`: connection actions, not key values or provider validation claims.
- `song_generation_started`, `song_generation_succeeded`, `song_generation_failed`, `song_generation_cancelled`: browser experience funnel. Success means the audio response was received, not that playback has been tested.
- `song_played`, `song_downloaded`: playback/download interactions (not proof a downloaded file was saved).
- `$ai_generation`: server-side ACE Music attempts with provider/model, request UUID, latency in seconds, status/error code, mode and requested duration. No fake token usage, billing or costs. One-shot generations have `$ai_session_id: null`.

Suggested dashboard: unique users by `page_viewed`; studio-to-generation-to-playback-to-download funnel; generation counts by outcome; average/p95 `$ai_latency`; `$ai_is_error` percentage. In PostHog, use Product analytics → New insight, then Save to dashboard. No dashboard has been created in an unconfigured account.

## Privacy and reliability
No lyrics, titles, style descriptions, audio, key values, passwords, reset tokens, emails or names are passed to analytics. Browser recording, autocapture, automatic URL/pageview capture and exception capture are off. URLs/referrers/search/hash properties are stripped, and only allowlisted application metrics are accepted. This prevents auth callback/reset URL tokens and personal keys from being captured. Browser persistence is memory-only; songs/keys are still not restored between visits. Account IDs and usage events are stored in the owner's PostHog project under its retention/access policies.

The server creates traces only after auth/origin/input/limit checks and a provider attempt begins. Error text is reduced to controlled codes. SDK flushing is bounded (1.5 seconds overall) and exceptions never change a song response; missing configuration is a no-op. The PostHog SDK loads only when a valid project is configured. Fixed US/EU hosts prevent an environment typo from directing analytics elsewhere. Setting an empty token disables new analytics on the next deployment.

## Wizard and runtime
The requested `npx -y @posthog/wizard@latest ai-observability` was attempted. Wizard 2.88.0 requires Node >=22.22, while the local runtime is 22.20. It was retried with temporary Node 24 using `npx -y -p node@24 -p @posthog/wizard@latest wizard ai-observability --no-telemetry`. The wizard then required a larger terminal (80x28 minimum, available 80x24) and was stopped. It made no source changes or PostHog account configuration. The integration was completed directly using official PostHog SDKs and manual-capture documentation for ACE Music, which is a custom music provider.

`posthog-node` 4.18 supports the existing Node runtime; current 5.x requires a newer Node patch. No system Node upgrade or separate provider AI credentials were needed. The wizard can be rerun in a normal terminal after updating Node, but review generated changes to preserve the content exclusions above.

References: https://posthog.com/docs/libraries/react, https://posthog.com/docs/libraries/node, https://posthog.com/docs/ai-observability/installation/manual-capture.

## Project setup progress
PostHog project 696151 exists in the US region. Its onboarding was configured for Product Analytics, Web Analytics and AI Observability, with Session Replay excluded. Its existing public project token was retrieved from the setup page into an ignored local work file; it was not committed. Vercel's API denied the environment update with 403. Production still needs `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST=https://us.i.posthog.com`, then a redeploy and real ingestion verification.

The requested MCP command succeeded via temporary Node 24: `npx -y -p node@24 -p @posthog/wizard@latest wizard mcp add --project-id 696151 --no-telemetry`. The wizard reported configuration for Claude Desktop/Web, ChatGPT and Visual Studio Code. This is not proof Codex's hosted plugin is authorized; a separate PostHog connection was offered for this app and remains unconfirmed. No personal API key was requested or copied.

Manual `$pageview` events reconstruct only an allowlisted app route and the site's origin. They never use the current URL's query/hash; person initial-property bags, referrers and marketing query metadata are removed before dispatch. Identical consecutive view events are deduplicated, including development Strict Mode effects.
