# Raaga authentication setup and verification

## Delivery status

Implemented in the existing Node/Express and React target. The existing Sites Worker still uses ChatGPT-managed access. Vercel deployment has **not** completed: the connection returns a team-authorization error, and Google, email and rotated MongoDB credentials are not configured. Do not describe live login as working until the checklist below is completed.

Vercel project: `raaga-studio`, ID `prj_chg86ePVa7JW50gDq0Q9hBFhg5Td`, team `team_gMQTg9J9uoI9XWyzUwN90eRQ` (`ayush-guptas-projects-cbb4d7ab`). The project was created successfully. Do not create a duplicate project to resolve the access error. Complete the Vercel team-consent flow with the account that owns this team. If the consent page shows an error, record that error and repair the team grant before retrying deployment.

## What was implemented

- Sign-in, sign-up, forgot-password, reset-password and resend-verification views in `components/authenticated-studio.tsx`, matching Raaga's dark/peach design. Password visibility, confirmation validation, loading, recoverable errors and an official Google logo are included.
- `server/auth.mjs` configures Better Auth 1.7.14 with the MongoDB adapter and server-side Google authorization-code/ID-token handling. No client-secret variables are built into React.
- Backend password hashing uses Better Auth's salted scrypt implementation. Passwords must contain 12–128 characters. MongoDB has unique email and provider/account indexes. Email input is normalized to lowercase; concurrent duplicate writes are rejected by the index.
- Email/password users verify email before signing in. Verification links expire after one hour; password reset links expire after 30 minutes and are single-use. Password reset revokes existing sessions.
- Sessions are database-backed, seven days, with HttpOnly, SameSite=Lax cookies and Secure cookies on HTTPS. Cookie session caching is disabled, so server revocation is checked. Production URLs must be HTTPS. CSRF/origin protections remain enabled, with a single configured trusted origin.
- MongoDB-backed authentication rate limits: five email sign-ins, three sign-ups/reset requests/verification resends per minute, with a general 60-request/minute limit. Limits are shared via the database. No password/token values are logged by the auth configuration.
- Automatic email-based OAuth linking is disabled. If Google and password accounts have the same email, sign in using the existing method, then choose **Link Google**. Different emails cannot be linked. Google-only accounts can use the verified-email password-reset flow to establish a password.
- `/api/music/*` and `/studio` validate a verified backend session. Browser-supplied identity headers are ignored. `/api/app-auth/session` exposes only safe user fields and public capability flags. Sign-out revokes the session and unmounts the studio, releasing its temporary audio URL.
- Account records persist in MongoDB; lyrics/audio/history do not. MongoDB TTL indexes remove expired session and verification records. Expired tokens are rejected even before TTL deletion runs.
- Request bodies are capped at 32 KB before auth parsing, including chunked requests, through Better Call's supported Node adapter. MongoDB connections are pooled and reused per instance; failed initialization releases the client and can retry.

## 1. MongoDB Atlas

The connection string pasted into chat contains an exposed password. Rotate that database user's password or replace the user before deployment. Do not reuse that credential in this repository.

1. In Atlas, open **Database Access** and create a dedicated application user with `readWrite` restricted to the `login_accounts` database. Use a generated password.
2. Use **Connect → Drivers → Node.js** to obtain the SRV URI. Include `/login_accounts` as the database name and percent-encode special characters in the username/password.
3. Set `MONGODB_URI` in Vercel as a secret. For local development, put it only in ignored `.env`.
4. Configure Atlas Network Access for the deployment's permitted outbound network. Prefer controlled/static egress when available; do not disable TLS or certificate checks. A cluster supporting transactions is required for this adapter configuration (Atlas replica sets support this).
5. The app creates indexes at runtime. If existing records conflict with a unique index, startup fails closed; inspect and repair those records deliberately instead of deleting data automatically.

## 2. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select your project.
2. Configure **Google Auth Platform → Branding / Audience** (or **APIs & Services → OAuth consent screen**): application name **Raaga Studio**, support email and developer contact. Select the appropriate audience. In Testing mode, add your intended Google accounts as test users.
3. In **Clients / Credentials**, create an **OAuth client ID**, type **Web application**. This is an OAuth client, not an API key or service account.
4. Add these exact local **Authorized JavaScript origins**: `http://127.0.0.1:3000` and, only if used, `http://localhost:3000`.
5. Add these exact local **Authorized redirect URIs**:
   - `http://127.0.0.1:3000/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (only if using localhost)
6. Once Vercel reports the actual production URL, add its exact HTTPS origin (no path) under Authorized JavaScript origins, and that same origin plus `/api/auth/callback/google` under Authorized redirect URIs. For example, for **your actual** `https://YOUR_DOMAIN`, use `https://YOUR_DOMAIN/api/auth/callback/google`. Do not use the old chatgpt.site callback or invent a deployment domain. No final production hostname is assigned in this delivery yet.
7. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel server environment variables. Set `BETTER_AUTH_URL` to that same exact production HTTPS origin, without a trailing path.
8. Keep scopes to basic identity (`openid`, email and profile). No Drive/Gmail access is required. Complete Google's production consent/verification requirements before general public rollout.

The code uses the supported authorization-code flow; the library exchanges codes and verifies Google identity on the server. Never implement Google sign-in by trusting a browser-supplied email or decoding an unsigned token.

## 3. Email delivery

1. Create a [Resend](https://resend.com/) account and verify a sending domain you control by adding the DNS records it provides.
2. Create a sending API key, preferably restricted to that domain.
3. Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM`, e.g. `Raaga Studio <accounts@YOUR_VERIFIED_DOMAIN>`.
4. Verification and password-reset messages are sent through Resend's official HTTPS endpoint. The app awaits delivery acceptance; it never claims delivery from a log-only mock. Provider acceptance does not guarantee inbox delivery—check spam and provider delivery events during validation.

Email/password registration is disabled until both email configuration values exist. Google can operate independently when its own configuration is ready. Resend's test sender is not sufficient for unrestricted production recipients.

## 4. Vercel environment and deployment

In [Raaga project environment settings](https://vercel.com/ayush-guptas-projects-cbb4d7ab/raaga-studio/settings/environment-variables), set:

| Variable | Required value |
| --- | --- |
| `MONGODB_URI` | Rotated Atlas connection string |
| `BETTER_AUTH_SECRET` | Cryptographically random secret, at least 32 characters; keep stable across deploys |
| `BETTER_AUTH_URL` | Exact production HTTPS origin assigned by Vercel |
| `GOOGLE_CLIENT_ID` | Google Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Matching client secret |
| `RESEND_API_KEY` | Email sending key |
| `AUTH_EMAIL_FROM` | Verified sender identity |
| `ACESTEP_API_KEY` | Existing ACE Music key, configured separately on Vercel |
| `MUSIC_TIMEOUT_MS` | `280000` for the configured 300-second Vercel function budget |

Generate the auth secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and place it directly in secret settings. Never paste it into chat or source. Do not prefix server secrets with `VITE_` or `NEXT_PUBLIC_`.

The repository's `vercel.json` selects Express, `npm run build:vercel`, a 300-second function duration, private-response headers, and the HTML file tracing rule. Root `index.mjs` exports the same existing Express application. Built browser assets are copied to `public/assets` for Vercel's CDN; generated assets are ignored by Git. The Node target requires Node 22.13+ (22.x or 24.x).

Deploy the pushed commit to the existing `raaga-studio` Vercel project. Inspect the build result, obtain its actual URL, configure that canonical URL and Google callback, then redeploy. Preview deployments must use separate test auth secrets/databases and explicitly registered origins; do not wildcard trusted origins or share production auth cookies across preview hosts.

Vercel deployment protection remains as initially configured. Do not silently disable it or change the old site's audience. Vercel login is an additional platform gate until the owner intentionally configures the desired audience.

The default Vercel duration is 300 seconds; long music generations may exceed this even if authentication works. Audio is piped without Content-Length on Vercel for streaming delivery. Real long-song delivery still needs deployment validation. No paid plan/feature was enabled.

## 5. Local development

Copy `.env.example` to `.env`, fill the server variables, and use the matching `BETTER_AUTH_URL=http://127.0.0.1:3000`. Run:

```sh
npm ci
npm test
npm run lint
node node_modules/typescript/bin/tsc --noEmit
npm run build:node
npm run start:node
```

Open `http://127.0.0.1:3000/sign-in`. The local server binds only to loopback. `/sign-up`, `/forgot-password`, `/reset-password` and `/verify-email` are real routes serving the same React application. Reset tokens are read from the emailed URL, not localStorage. The studio and music routes require a verified session. The existing Worker build is still available independently.

## Verification evidence and outstanding checks

Automated tests use the **real Better Auth implementation with isolated in-memory storage and captured test emails**, never production MongoDB. They prove hashing, unverified-user rejection, successful verification/sign-in, invalid credentials, no duplicate user on repeated sign-up, cookie attributes, sign-out revocation, reset and old-password rejection, reset token reuse rejection, CSRF origin rejection, weak-password rejection, forged Google ID-token rejection and anonymous/forged-identity music-route rejection. The existing 29 music tests remain.

Browser QA on the isolated test server verified password-confirmation errors, loading/disabled state, successful registration's verification screen, and password show/hide. Google remains disabled in this preview because no genuine OAuth credentials exist. No real email was sent by the isolated QA server.

**Still required before declaring production complete:** successful Vercel team grant/deployment, real Atlas indexes and account persistence, actual inbox verification/reset delivery, real Google consent/callback and explicit linking for an existing email, production Secure cookies and CSRF, and a logged-in song generation/download. None of these live-provider checks are claimed as passed.

## Official references

- [Better Auth MongoDB](https://better-auth.com/docs/adapters/mongo)
- [Better Auth Express](https://better-auth.com/docs/integrations/express)
- [Email/password, verification and reset](https://better-auth.com/docs/authentication/email-password)
- [Google provider](https://better-auth.com/docs/authentication/google)
- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google button branding](https://developers.google.com/identity/branding-guidelines)
- [Resend email setup](https://resend.com/docs/send-with-nodejs)
- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)

Final validation: 34/34 tests passed, TypeScript and ESLint passed without warnings, Vercel/Node production build passed, and the existing Sites/Worker build passed. No live MongoDB, Google OAuth consent, external mail delivery or Vercel deployment was performed because credentials and the team grant remain unavailable.


## OpenAI / ChatGPT sign-in update
The Vercel account screen now includes **Continue with ChatGPT** alongside email/password and the optional Google method. It uses Better Auth's maintained generic OIDC provider with the fixed OpenAI discovery URL, PKCE, server-generated nonce binding, required ID-token signature/issuer/audience validation and a verified-email gate. Account identity is namespaced by issuer, registered client ID and stable subject, never email alone. Existing-account linking remains explicit. Local logout ends the Raaga session without logging the user out of their OpenAI account.

A registered website OAuth client is required. OpenAI currently offers this website integration to selected commercial partners; request access at https://developers.openai.com/siwc/request-client-id. An ordinary OpenAI API key, a ChatGPT subscription, the Sites client ID or a Codex OAuth client ID is not a substitute. Do not use the open-source plan-usage client-registration flow for a hosted website.

Set server-only `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_CLIENT_SECRET` (for a confidential client), and `OPENAI_OAUTH_TOKEN_AUTH_METHOD` matching the registration (`client_secret_post`, `client_secret_basic`, or `none` for a public client). Register the exact callback `<BETTER_AUTH_URL>/api/auth/callback/openai`, locally `http://127.0.0.1:3000/api/auth/callback/openai`. Only `openid profile email` scopes are requested; this does not consume the user's ChatGPT plan for music generation. No live OpenAI login is claimed until the app has registration credentials and an approved callback.

The original ChatGPT-hosted studio continues to use platform-managed sign-in. Its login and sessions cannot simply be copied to a Vercel domain. The new account screen offers an explicitly labelled link to that existing studio while Vercel setup is pending; this link does not authenticate a Node session.

Existing configuration audit: the Sites runtime contains only `ACESTEP_API_KEY`, marked secret, with its value masked. There is no local `.env` file. The Vercel team still returns 403, so no environment values were changed and no Vercel deployment was attempted. The music key cannot be exported from the Sites secret store; its owner must add it to Vercel directly. MongoDB, email, auth session and OAuth configuration remain required. Do not claim those values were migrated.

Official OpenAI references: https://developers.openai.com/siwc/website and https://developers.openai.com/siwc/request-client-id.
