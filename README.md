# OpenDraft

A free, MIT-licensed writing workshop for **human writing and human critique**.
An original implementation inspired by reciprocal critique communities, with a
literary reading experience, focused feedback requests, and a fair spotlight queue.
There are no AI writing, grading, moderation, or recommendation features.

## What works

- Four rotating spotlight places with a FIFO queue. Three critiques release a
  place; published work remains available for further feedback.
- Five starting credits, two credits for a spotlight critique, one for other work,
  and five credits to publish. Credits are earned, never sold.
- Private saved drafts, a 4,000-word posting limit, genre and stage metadata,
  sensitive-content notes, and focused questions for reviewers.
- A readable manuscript view and structured critique editor: strengths,
  suggestions, overall impression, and a comment anchored to a selected passage.
- A minimum 100-word critique; one rewarded critique per reader per version;
  no self-critiques. Writer-controlled helpful marks.
- Bookmarks, search, genre filters, sorting, feedback inbox, critique history,
  an auditable credit ledger, and a profile with a complete JSON data export.
- Writing circles, persistent membership, circle discussions, and circle creation.
- Work withdrawal preserves the author's feedback. Reports are saved for operator
  review; there is no automated moderation or operator moderation UI yet.
- Six clearly labeled original example pieces demonstrate the exchange. These
  are fictional authors, not fabricated community activity.

## Technology

React 19, TypeScript, Vinext / Vite, Cloudflare Workers, Drizzle PostgreSQL schema,
Neon PostgreSQL, and the `@neondatabase/serverless` HTTP driver. The UI uses the
bundled accessible Radix primitives and Lucide icons. PostgreSQL is the only
application database; there is no SQLite/D1 or browser-storage database fallback.
Browser session storage is used only for temporary recovery of unsaved text.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
cp .env.example .env
# Set DATABASE_URL to your Neon project's pooled PostgreSQL URL.
npm run db:migrate
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if desired.
The development URL is printed by the server, normally http://127.0.0.1:5173.
The `.env` file is ignored by Git. Never use a `NEXT_PUBLIC_` prefix for credentials.

The current hosted distribution uses platform-owned Sign in with ChatGPT solely
for authentication. It does not call any AI API. Loopback development provides
an isolated local sign-in through `/signin-with-chatgpt?return_to=/` and a sign-out
through `/signout-with-chatgpt?return_to=/`. This development identity is excluded
from the production build.

For an independent deployment, connect an authentication provider at
`app/chatgpt-auth.ts` and update the corresponding sign-in and sign-out links.
Its contract is a stable `userId`, display name, and email. The existing hosted
adapter reads trusted gateway headers; never trust user-supplied identity headers
on an unprotected self-hosted server. The current gateway adapter is intended for
Sites hosting. A standalone authentication provider is not included yet.

## Database and migrations

```sh
npm run db:generate # after editing db/schema.ts
npm run db:migrate  # apply reviewed PostgreSQL migrations
```

Schema is in `db/schema.ts`; generated migration SQL is in `drizzle/`. Migrations
are applied explicitly, never as runtime DDL. Examples are seeded idempotently on
first workshop load. The HTTP storage boundary is in `db/storage.ts`; all SQL
values are bound parameters and all database access is server-side.

Exchange operations run in atomic PostgreSQL transactions under a short advisory
lock so simultaneous submissions cannot overspend credits, double-reward a
critique, or overfill the spotlight. Unique indexes enforce one review per
work/reader/version and one bookmark or membership per pair. Every transaction
sets its schema locally to avoid leaking session settings through pooled
connections. Published pieces are immutable; a new revision creates a new private
draft with its own review cycle, preserving the earlier version and its feedback.

The server checks identity and ownership on every write. Private drafts and
withdrawn work are excluded from other readers' snapshots. Origin checks protect
write endpoints. These checks are independent of what controls the UI shows.

The Worker uses Neon's HTTP driver rather than TCP sockets. Other PostgreSQL
providers require an HTTP-compatible proxy or a Node server adapter; a plain
Supabase/TCP URL is not interchangeable with Neon in this Worker distribution.

## Check the app

```sh
npm run typecheck
npm test
npm run build
```

Integration tests use `TEST_DATABASE_URL`, falling back to `DATABASE_URL`, and
create an isolated `opendraft_test_<random>` PostgreSQL schema. They exercise the
actual API handlers and production SQL using a test authentication adapter and
PostgreSQL transport. They cover ownership, draft privacy, rewards, duplicate
reviews, concurrent publishing, spotlight rotation, circle membership, discussion,
reports, and withdrawal. The test schema is removed in `finally`. Live workshop
content is not edited by these tests.

## Deploy

The included build emits a Cloudflare Worker under `dist/server/` and browser
assets under `dist/client/`. Configure `DATABASE_URL` as a runtime secret and apply
migrations before publishing. `.openai/hosting.json` identifies this Sites instance;
remove its `project_id` when registering a separate deployment. It declares no D1
or R2 binding. Keep `.env`, `.wrangler`, `.sites-runtime`, and `node_modules` out
of source archives. Source code is free; hosting and database costs depend on
where you run it.

## Project map

- `app/workshop.tsx`: navigation, state, listings, credit history, and dialog shell.
- `app/workshop-views.tsx`: manuscript reader, editor, feedback, profiles, and circles.
- `app/api/workshop/route.ts`: authenticated workshop operations.
- `app/data.ts`: shared types and original example writing.
- `app/globals.css`: visual system and responsive styles.
- `db/schema.ts`, `db/storage.ts`, `drizzle/`: PostgreSQL schema, queries, migrations.
- `tests/workshop.integration.mjs`: PostgreSQL integration suite.

## Scope and next steps

This is a working first release, not feature parity with every Scribophile service.
Direct messages, dedicated full-manuscript beta-reading exchanges, a moderation
console, account deletion, and large-community pagination/rate limiting are not
implemented. An operator should complete those controls and connect standalone
authentication before opening an independently hosted public community.

Contributions should keep the software free, the exchange transparent, writing
ownership with authors, and feedback human. See LICENSE for the MIT terms.
