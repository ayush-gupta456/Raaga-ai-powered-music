# Contributing to Raaga

Thanks for helping make the studio clearer, safer and more useful.

## Before changing code

Use Node 24.x. Install dependencies with `npm ci`, copy `.env.example` to ignored `.env` for local work, and follow the README's Node setup. Never commit real credentials, user lyrics, email tokens or generated audio. Tests run without production accounts.

Keep the lyrics-first workflow, personal-key isolation and session-only audio lifecycle intact. Use existing plain CSS and Lucide icons; add a UI dependency only when there is a concrete need.

## Pull requests

1. Work on a focused branch and explain the user-visible problem.
2. Add meaningful regression coverage for behavior/security changes.
3. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:vercel` and `npm run build`.
4. For UI work, check desktop, a narrow viewport, keyboard focus, loading and error states.
5. Include screenshots when appearance changes and state any live services you could not verify.

Use descriptive commits such as `fix(auth): handle expired verification links`. Keep generated builds, local previews and `.env` files out of Git. Report vulnerabilities privately using SECURITY.md rather than opening a public issue.
