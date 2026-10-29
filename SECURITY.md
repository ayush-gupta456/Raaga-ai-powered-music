# Security

## Reporting a vulnerability

Contact the repository owner privately through an existing trusted channel. If GitHub offers **Security → Report a vulnerability** for this repository, use that private reporting flow. Do not disclose credentials, reset links, personal data or exploit details in a public issue.

Include the affected route/version, a minimal reproduction with synthetic data, impact and any suggested mitigation. Do not access other users' accounts, consume their provider credits, or perform destructive/load testing.

## Deployment responsibilities

Keep Node and dependencies patched. Rotate leaked secrets and configure credentials in Vercel, never in the frontend or repository. Review OAuth callback URLs, MongoDB access, sending-account limits and PostHog retention. A clean dependency audit is not a guarantee that every security risk is absent.

Email accounts require verification. OAuth accounts link explicitly rather than merging on email alone. Personal ACE keys are memory-only and request-scoped. Music quotas are per instance; authentication rate limits are shared through MongoDB. See docs/redesign-review.md for the current security review and its limits.
