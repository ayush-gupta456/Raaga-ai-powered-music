# Raaga studio redesign and verification — 2026-10-29

## Design decisions
Preserve the user's lyrics-first composer, song description, duration range, personal ACE key, Google and email accounts. Replace accumulated legacy styles with one coherent charcoal/copper design system: 16px panels, 8–10px controls, Manrope headings, DM Sans body, warm serif emphasis, restrained borders and clear section numbering. Auth and studio share the palette. Vinyl artwork is CSS, so it adds no image downloads or licensing dependency.

The music connection is a compact native disclosure above the composer; key entry remains accessible and does not push lyrics down the page. The guide is a native modal with keyboard dismissal. A keyboard skip link targets the editor. Mobile uses a bottom navigation, stacked panels, 44px key controls/chips and 16px form inputs. Reduced motion is respected. Email forms are hidden when delivery isn't configured, with a clear explanation and available Google sign-in; enabling email configuration restores the full existing forms.

Research references (read, not copied):
- Udio custom-lyrics workflow: https://help.udio.com/en/articles/10716221-create-a-song-with-your-own-lyrics
- Suno custom lyrics: https://help.suno.com/en/articles/2415873
- Ableton's focused music-learning/playground flow: https://learn.ableton.com/
- Local UI/UX Pro Max dark-studio guidance was reviewed; the recommended marketing-page pattern and purple/green palette were not a fit for this existing brand, so the studio interaction and copper brand were retained.

## Security changes
- Patched Next.js, React/React DOM/server components, Vite, Vinext, Cloudflare tooling and vulnerable transitive dependencies, maintaining peer compatibility rather than forcing downgrades. Pinned the deployment to Node 24.x to avoid silently switching major runtimes.
- Full npm audit (including development tools): zero known vulnerabilities at verification time. This is a package-advisory result, not proof that no vulnerability can exist.
- Content Security Policy restricts scripts/connections to this origin and official PostHog hosts, prevents framing, plugins, base-URL injection and foreign form actions. Inline scripts and eval are not permitted. Styles allow the current Google Fonts setup.
- Added Permissions Policy and production HTTPS HSTS. Existing no-sniff/no-referrer/frame-deny headers apply to Node responses and Vercel CDN assets.
- Vercel authentication URLs require HTTPS even without NODE_ENV=production.
- Personal keys clear on returning from browser back/forward cache as well as page leave. Keys remain memory-only and per request; no lyrics/audio/credentials are added to analytics.
- Existing verified server sessions, salted password hashing, explicit OAuth linking, origin checks, body limits, fixed provider host, redirect rejection, audio validation and bounded generation remain covered.

## Verification
- 47 automated tests pass, including a complete real Better Auth HTTP flow: signup → email-token verification → login → authenticated personal-key generation response → logout → revoked generation access. Provider audio in this test is synthetic; the test never calls ACE Music.
- Tests cover duplicate accounts, wrong credentials, reset and token-reuse behavior, forged Google token, cross-origin rejection, key isolation, cancellation/timeouts, no saved song endpoints, response security headers, private-route denial and no environment/source-file serving.
- Browser QA on an isolated local server: desktop auth/studio, key connect/disconnect, lyrics/style entry, loading/disabled controls, returned audio metadata, actual play/pause, download-button interaction, starting fresh, instrumental disabling vocal controls, presets, native guide focus and Escape, cancellation before completion, sign-out, and password visibility/sign-up navigation. A 390px isolated responsive frame was visually checked; this is not a real-device Safari test.
- Full TypeScript and lint checks, Node/Vercel build and the legacy Sites/Worker build checked after patched dependency updates. Legacy build emits upstream sourcemap/performance warnings; these did not fail the build.

## Limits and required live checks
Real Google consent and account linking require the owner's Google account interaction. Real MongoDB persistence and email inbox delivery require configured production services. Real ACE Music generation requires a listener's valid personal API key; no key was extracted from a screenshot or browser session, and no provider credits were consumed during the isolated QA.

Vercel production deployment is triggered from GitHub; inspect the actual deployment and verify response headers/assets after rollout. The old Sites host is not redeployed as part of the Node/Vercel release. Email delivery and PostHog ingestion still depend on production configuration; a code test cannot establish inbox/event delivery. Music concurrency/rate counters are per process, whereas authentication rate limits are shared in MongoDB; a distributed music quota would be needed for strict global limits across multiple Vercel instances. This review does not claim a penetration test or an absence of all security risks.
