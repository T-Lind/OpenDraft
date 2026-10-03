# Security

Only the current release is maintained. Keep dependencies and the deployment
runtime updated, and report security issues privately.

Use this repository's private vulnerability reporting on its Security tab when
enabled. Otherwise contact the workshop operator privately to arrange a secure
report. Do not post passwords, API keys, database URLs, private writing, or
exploitable account details in public issues. Include a minimal reproduction,
affected version, impact, and suggested mitigation when possible.

Secrets belong in ignored local environment files or server-only deployment
variables. Production sessions use signed HttpOnly cookies and verified Google
identities. Caller-supplied identity headers never grant production access.
Private drafts, messages, and feedback require server-side authorization.

PostgreSQL rate limits persist across Vercel instances. They reduce application
abuse; the hosting provider's request and network protections remain relevant.
Profile pictures appear only after the configured SafeSearch check succeeds.
Manuscripts are rendered as text with bold, italic, and underline formatting.

When a credential is exposed, revoke it with its provider, replace its deployment
value, and redeploy. Rotate the session signing secret to invalidate all sessions.
