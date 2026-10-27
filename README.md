# Raaga Studio

A responsive, buildless music creation workspace. Open `dist/` through a static HTTP server.

## Working features
- Vocal / instrumental creative briefs with lyrics, style presets, mood, language, instruments, tempo and target duration.
- Browser-local IndexedDB library, draft editing, JSON export and deletion confirmation.
- Working-draft recovery through localStorage.
- Audio import (up to 50 MB), playback and download using browser-local storage.
- Mobile layout, keyboard-accessible controls and reduced-motion support.

## Current limitations
No music model is connected. Saving a brief does not generate audio. No account sync, payments, or cloud persistence are implemented. Browser storage clearing removes saved items; export important drafts and audio.

## Next integration
Choose a licensed hosted music API or deploy ACE-Step on a remote GPU. Add a server-side adapter with authenticated submit/status endpoints, persistent generation jobs, private object storage, retries, and idempotency. Keep provider secrets server-side. Only expose the Generate action once the integration can return genuine audio and report failures reliably.

## Preview
`python -m http.server 4173 --bind 127.0.0.1 --directory dist`
