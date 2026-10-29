# Authentication and email setup

Raaga's primary Node/Vercel deployment uses Better Auth with MongoDB. The legacy Sites target uses its host's managed identity and does not share sessions with Node.

## Required account settings

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string with the intended account database. |
| `BETTER_AUTH_SECRET` | Stable cryptographically random secret, at least 32 characters. |
| `BETTER_AUTH_URL` | Exact origin: `http://127.0.0.1:3000` locally or your HTTPS production origin. |

Use a dedicated MongoDB user restricted to the application database. Configure Atlas network access for your deployment and keep TLS validation enabled. Rotate any credentials that have been exposed. Unique indexes protect user emails, provider identities and session tokens; TTL indexes expire sessions and verification records. Conflicting existing records need deliberate repair, not automatic deletion.

## Google sign-in

1. Create/select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Configure Google Auth Platform branding, audience and developer/support contacts. Add test users while the consent screen is in Testing mode.
3. Create a **Web application** OAuth client.
4. Add the local authorized origin `http://127.0.0.1:3000` and redirect URI `http://127.0.0.1:3000/api/auth/callback/google`.
5. For production, add the exact HTTPS origin and `<production-origin>/api/auth/callback/google`.
6. Save `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel, then redeploy. Set `BETTER_AUTH_URL` to the same production origin.

For the current site, the callback is `https://raaga-studio.vercel.app/api/auth/callback/google`. Add localhost variants only if you actually use them. Do not wildcard callback URLs or copy callbacks from the legacy Sites host.

Google sign-in operates independently of email delivery. Authorization codes and identity tokens are handled by the supported server library; browser-provided email strings are not trusted as identity. Existing accounts must sign in using their original method and explicitly choose **Link Google**. Accounts are never merged just because their emails match.

## Gmail verification and reset email

No custom domain is needed for this route.

1. Enable 2-Step Verification for the Gmail sender account.
2. Generate a Google App Password for Raaga, if available for that account.
3. Save it as the server-only `GMAIL_APP_PASSWORD` in Vercel Production. Do not use the normal Google password.
4. Optionally set `GMAIL_USER`. The app-specific default is `create.personal456@gmail.com`.
5. Redeploy, register with email/password, and confirm the verification message arrives. Test **Forgot password** as well; check spam and the sender's security activity if delivery fails.

Gmail takes priority when `GMAIL_APP_PASSWORD` is supplied. Its 16-character app password may contain Google's display spaces; these are removed before use. Invalid Gmail configuration disables email instead of silently choosing another sender. Nodemailer uses the fixed Gmail SMTP host, port 465, TLS with certificate verification, bounded connection/socket timeouts and no protocol logging. The sender must match the authenticated account. Errors are sanitized and recipient acceptance is checked.

Gmail applies sending and account limits. For growth, use a dedicated transactional mail provider with an owned sending domain. The sender address above is deployment configuration, not a promise that contributors can use that account.

### Resend alternative

If Gmail is not configured, set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` to a verified Resend sender. The shared `onboarding@resend.dev` sender is limited to testing with the Resend account's email; public signup needs a verified sending domain. Gmail does not use `AUTH_EMAIL_FROM`.

## Account behavior

- Passwords: 12–128 characters; Better Auth stores salted scrypt hashes.
- Signup: no automatic session; email verification is required before sign-in.
- Verification links: expire after one hour.
- Password-reset links: expire after 30 minutes and are single-use; reset revokes existing sessions.
- Sessions: database-backed, seven days, HttpOnly and SameSite=Lax; Secure on HTTPS. Production/Vercel auth requires HTTPS.
- CSRF/origin protections remain enabled. Auth body size is capped at 32 KB.
- Shared MongoDB auth limits include five email sign-ins and three signups/reset/verification requests per minute, plus a general limit.
- Sign-out revokes the session and unmounts the studio, releasing temporary audio and personal-key state.

## Optional registered ChatGPT sign-in

The code retains an optional OpenAI OIDC provider for registered website clients. It is hidden unless configured. An ordinary OpenAI API key, ChatGPT plan or another application's OAuth client is not a substitute.

Set `OPENAI_OAUTH_CLIENT_ID`, the client secret when applicable, and `OPENAI_OAUTH_TOKEN_AUTH_METHOD` matching registration. Register `<BETTER_AUTH_URL>/api/auth/callback/openai`. The integration requires PKCE, nonce and ID-token validation; account identity is scoped to issuer, client and subject. See [OpenAI website registration](https://developers.openai.com/siwc/request-client-id) for current availability. Google/email setup does not depend on it.

## Local and production checks

Use Node 24, copy `.env.example` to ignored `.env`, then run `npm ci`, `npm run build:node` and `npm run start:node`. Keep all secrets out of frontend variables, Git and screenshots.

`GET /api/app-auth/session` returns safe user fields and public capability flags. An enabled email flag confirms configuration presence, not SMTP authentication or inbox delivery. `/studio` and every `/api/music/*` endpoint validate a verified server session. Public frontend files contain no private music/account data.

Before claiming a deployment is ready, verify:

- New account → actual inbox verification → sign-in → sign-out.
- Incorrect password, duplicate signup, reset and old-password rejection.
- Real Google consent/callback and explicit linking for an existing email.
- Anonymous and revoked-session denial on private APIs.
- Personal-key generation → preview → download.

Automated tests use real Better Auth with isolated in-memory data and captured mail, plus mocked SMTP/provider boundaries. They do not prove real inbox delivery, Google consent or ACE Music availability. Current production implementation evidence is in [the review](redesign-review.md).

## References

[Better Auth email/password](https://better-auth.com/docs/authentication/email-password) · [MongoDB adapter](https://better-auth.com/docs/adapters/mongo) · [Google provider](https://better-auth.com/docs/authentication/google) · [Nodemailer Gmail](https://nodemailer.com/usage/using-gmail/) · [SMTP security](https://nodemailer.com/smtp)


## Contextual account actions

- The normal sign-in page does not show a resend action. It appears after a correct-password login is rejected as `EMAIL_NOT_VERIFIED`, or a protected-page redirect identifies an unverified session. Registration opens `/verify-email`; this page can also be opened directly for recovery.
- Registration and unverified sign-in request a verification message. The resend form preserves the entered email, uses a 60-second UI cooldown, and is protected separately by database-backed rate limits. Unknown or already verified addresses receive generic responses. Links expire in one hour; a successful verification redirects to sign-in with confirmation.
- `Link Google` appears only for signed-in, verified accounts when Google is configured and the backend confirms it is not linked. An accessible dialog explains that this adds Google to the same Raaga account, requires the same email, and does not connect the music engine. Already linked accounts show `Google connected`.
- Provider listing errors hide linking actions, rather than assuming an account is unlinked. The session endpoint returns provider names only, never OAuth tokens or account secrets. Implicit merging remains disabled. Linking errors return to the studio with recovery guidance.

### Mail-delivery diagnostics

Production logs record `auth_verification_request` with `account_state` (`missing`, `already_verified`, `pending_verification`) and `auth_email_delivery` with provider/outcome. Failure codes are restricted to known SMTP categories. These server-only records contain no email addresses, message text, links, tokens, passwords or raw provider errors. Provider acceptance does not establish inbox delivery. Public responses continue to conceal account existence.
