# Raaga Studio

Private lyrics-to-song studio powered by ACE Music's hosted ACE-Step API. The existing browser library is preserved across the server migration.

## Working features
Vocal/instrumental generation with complete lyrics, style, mood, language, tempo, instruments and minimum and maximum durations from 10–600 seconds, with a lyrics-based target estimate. Drafts save before generation. Returned audio is saved in IndexedDB and opened in the player. Includes playback, download, import, draft editing/export, search, responsive layout and progress/error messages.

## Configuration
Configure ACESTEP_API_KEY as a secret in Sites runtime environment variables, then deploy. Optional ACESTEP_MODEL overrides model discovery. Never put keys in source or browser storage. API base is fixed to https://api.acemusic.ai. The server uses /v1/models and /v1/chat/completions, with User-Agent RaagaStudio/1.0.

## Development
Node 22.13+. npm run dev starts the supplied Vinext/Cloudflare server. npm run build builds the site. node --test tests/music.test.mjs checks validation, mapping, access controls and provider response handling. The Worker serves the studio HTML and /api/music/*; Vite serves client assets.

## Limits
Owner-private personal studio. ACE Music controls availability, quotas and output quality. Keep the tab open during generation. Requests time out after ten minutes; an interrupted request may still run upstream, so retries are manual. Responses are limited to 16 MB. Only inline audio data URLs are accepted.

Songs and drafts stay in this browser, with no cloud synchronization. Download/export backups; clearing browser data removes the library. In-flight duplicate protection applies per running server instance. Before public or multi-user use, add durable jobs, distributed quotas and private object storage.

## Official resources
- https://github.com/ace-step/ace-step-skills
- https://ace-step.github.io/ACE-Step-1.5/en/
- https://acemusic.ai/playground/api-key

Installed companion skills: acestep, acestep-docs, acestep-songwriting. Skills assist development; the deployed website uses its server adapter.
