# OpenCode handoff — OpenDraft

Date: 2026-10-02

## Read this first

The user wants an original, free, open-source alternative to Scribophile, centered
on spotlight rotation, reciprocal critique, writing, and community. Use judgment
and design sense; this should feel like a modern literary workshop, not a copy.
The user explicitly requires **PostgreSQL**, prefers **Neon**, and explicitly
wants **no AI-centric or AI features**. Keep critique, feedback, recommendations,
and moderation human. No model API keys or AI calls exist in this app.

Project checkout:
`C:\Users\tenant\source\repos\OpenDraft\opendraft`

Start with README.md, then app/workshop.tsx, app/workshop-views.tsx,
app/api/workshop/route.ts, db/storage.ts, and db/schema.ts.

## Current working implementation

- React/Vinext on Vite, TypeScript, accessible Radix UI primitives.
- Neon PostgreSQL connected using its HTTP serverless driver. Credentials are
  already in the ignored .env file and configured as a secret in Sites.
- Initial PostgreSQL migration applied successfully. No D1/SQLite database.
- Spotlight/queue: four active pieces, FIFO admission, rotation at three critiques.
- Credits: five starting, two per spotlight review, one outside, five to publish.
- Private drafts; editor and publish confirmation; 4,000-word limit; genre/type/
  draft-stage/content-note fields; focused feedback requests.
- Manuscript reader, structured feedback, selected-passage comments, writer-only
  helpful marks, feedback inbox and critique history.
- Bookmarks, search, genre filtering, sort, credit history, profiles and JSON export.
- Writing circles with memberships, creation, and persistent discussions.
- Withdrawal keeps author feedback. Reports are stored for operator review.
- Original starter stories are labeled Example; the authors are fictional.
- MIT license in LICENSE. No payment features or paid credit packs.

UI: navy fixed sidebar, white reading surfaces, Georgia serif manuscript and
headings, restrained orange buttons, generous whitespace. Keep the style coherent.
CSS and all major views have desktop and mobile layouts.

## Verification completed

43 integration assertions passed against the actual PostgreSQL database, in an
isolated temporary schema. They cover draft privacy, ownership, CSRF origins,
critique length, reward amounts, duplicate critiques, concurrent publishing,
concurrent reviews, queue rotation, bookmarks, circles, profiles, reports, and
withdrawal. These tests do not change live workshop content.

TypeScript checks passed. A final production build is part of the publication
workflow. Browser checks covered genre filtering, sign-in, and the signed-in draft
editor. The real preview API returns six works and three circles from Neon.

## Start / test / build

```sh
npm ci
npm run db:migrate
npm run dev
npm run typecheck
npm test
npm run build
```

Keep the existing .env; do not replace it with .env.example and do not print or
commit its contents. .env.example documents the required DATABASE_URL key.

On this Windows machine, the stock npm.cmd wrapper can resolve its npm scripts
relative to the project directory incorrectly. The reliable direct command is:

```powershell
node 'C:/Users/tenant/nodejs/node_modules/npm/bin/npm-cli.js' run dev
```

Or bypass npm for the relevant operation:

```powershell
node scripts/run-framework.mjs dev
node node_modules/typescript/bin/tsc --noEmit
node tests/workshop.integration.mjs
node node_modules/drizzle-kit/bin.cjs migrate
node scripts/run-framework.mjs build
```

The current dev URL is http://127.0.0.1:5173. Start another instance only after
stopping the existing preview. Local sign-in uses a development-only mock identity
at /signin-with-chatgpt?return_to=/; it is excluded from production.

## Important implementation decisions

1. All application SQL uses bound parameters. Database queries are server-side.
2. Exchange mutations use atomic transactions and a short PostgreSQL advisory
   lock. Keep the guarded debit, ledger insert, review insert and queue promotion
   together. Do not replace these with client-side balance updates.
3. Every query/transaction uses SET LOCAL search_path TO public. This is essential
   with pooled Neon connections: session-level SET leaked schema settings during
   early tests. Tests override the local schema in their transport adapter.
4. Unique indexes enforce one critique per work/reader/version, one bookmark per
   user/work, and one membership per user/circle.
5. API identity and ownership checks protect private drafts independently of UI.
6. Published manuscripts are immutable. New revision creates a separate private
   work and preserves the previous text and feedback; no version diff UI exists.
7. Session storage recovers unsaved editor/critique text only. It is not the
   authoritative database. Do not replace Neon state with localStorage.
8. Authentication currently uses Sites gateway identity through app/chatgpt-auth.ts.
   ChatGPT is only the sign-in provider; there are no AI product features.
9. For independent deployment, replace the auth adapter and sign-in/out links with
   a standalone provider. Do not accept arbitrary identity headers from clients.
10. Cloudflare Worker code cannot use normal raw PostgreSQL TCP connections. Neon
    HTTP works; Supabase/other providers need a compatible adapter or Node hosting.

## Remaining work / recommended next milestones

This is a functional first release of the core critique workshop. It is not every
feature on Scribophile. Prioritize these before an independent public launch:

- Standalone email/social authentication and complete account deletion/export UX.
- Operator moderation console for reports, abuse controls and rate limits.
- Direct messages and notifications with read/unread state.
- Dedicated beta-reader/full-manuscript exchanges.
- Pagination and narrower server queries for larger communities.
- Per-paragraph multiple annotations, revision history/diffs, critique replies.
- More extensive mobile accessibility and contrast audits.

The platform deployment starts owner-private. Do not make it public or change
sharing without the user's direction. Use the existing Site identity in
.openai/hosting.json for further publication. A new host can be used if the user
chooses one; preserve Neon and the PostgreSQL schema.

## Source / deployment notes

The repository includes the bundled build and runtime helpers and vendored UI
components. Preserve licenses and package-lock.json. Runtime secret values do not
belong in .openai/hosting.json. The hosting manifest contains the Site project id
and null D1/R2 bindings only. Source archives omit .env, .git, node_modules, build
output, .wrangler and .sites-runtime. README.md explains independent setup and
limitations. OpenDraft-source.zip is the portable source delivery beside the
checkout once packaged.
