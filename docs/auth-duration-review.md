# Authentication and duration review — 29 October 2026

## Changes

The sign-in card now uses compact spacing and a smaller decorative record. All sign-in methods remain together on desktop and a 390-pixel-wide preview, with content-driven scrolling when notices or registration fields need more room.

Verification recovery appears after an unverified-account rejection, after registration, or when an unverified session is redirected. The dedicated recovery page remains directly accessible. A 60-second client cooldown complements the database-backed abuse limits; email existence is not disclosed. Successful verification returns to sign-in with confirmation. Verification does not silently log users in.

The backend reads the signed-in user's linked providers using Better Auth. It returns provider names only. Google linking is offered only when not linked; a native modal explains the purpose and same-email requirement. Already linked users see a connected label. Implicit account merging remains disabled, and linking failures return to the studio.

Auto is the default song length and resets with Start fresh. It omits `audio_config.duration`, matching the official provider contract. It does not invent a fixed target or clamp Auto output to the custom range. Custom minimum/maximum inputs retain 10–600-second validation. Instrumental mode now explicitly sets the provider's instrumental flag as well as omitting hidden vocal lyrics.

## Verification

- 57 automated tests passed on Node 24, including real Better Auth with isolated memory storage, verification/resend, login/logout/reset, Google linking authorization URL/state, private routes, provider validation, key isolation, cancellation, audio handling, analytics privacy, and Auto duration payloads.
- TypeScript, ESLint, Node/Vercel build, legacy Sites build, and dependency audit passed. Audit reported zero known vulnerabilities. Legacy framework builds retain upstream plugin/source-map warnings.
- Browser checks covered normal sign-in without resend, unverified sign-in recovery, prefilled resend email and cooldown, Google-link modal focus/Escape, linked/unlinked account presentation, Auto/custom selection, presets and reset. A 390-pixel iframe was visually reviewed; this is not a physical mobile-device test.
- No production account was created or modified for this review. Real inbox delivery, final Google consent/linking, and live music generation with credits were not executed. Automated music responses use test fixtures; results do not establish live provider availability or audio quality.

## References

- [Better Auth accounts and linking](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
- [ACE-Step audio configuration](https://ace-step.github.io/ACE-Step-1.5/en/Openrouter_API_DOC)
