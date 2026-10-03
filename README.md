# OpenDraft

A free, MIT-licensed writing workshop for **human writing and human critique**.
An original implementation inspired by reciprocal critique communities, with a
literary reading experience, focused feedback requests, and a fair spotlight queue.
Human writing and critique are the workshop norm. Honest process disclosures
replace unreliable AI-authorship detection; reviewers must personally read and
stand behind every point they submit. Profile pictures use Google Cloud Vision
SafeSearch. Authors can separately consent to optional Jev scoring through Vercel
AI Gateway for operator-assisted showcase selection; public ratings and final
showcase choices remain human.

## What works

- Four rotating spotlight places per genre with a FIFO queue. Two critiques release a
  place; published work remains available for further feedback.
- Five starting credits, one credit for a 175-word spotlight critique and 0.005
  per extra word; other critiques earn half. Publishing costs five credits for
  two reviewers, plus two credits per additional requested reviewer (up to five).
  Credits are earned, never sold.
- Private autosaved drafts with saved/offline/conflict status and browser recovery,
  a 4,000-word posting limit, genre and stage metadata,
  sensitive-content notes, and focused questions for reviewers.
- A readable manuscript view and structured critique editor: strengths,
  suggestions, overall impression, and a comment anchored to a selected passage.
- Short critiques are welcome without credits; 175 words is the earning threshold,
  with 0.5 extra credits per additional 100 words in the reading room. One critique per reader per version;
  no self-critiques. Recipient ratings cover usefulness, specificity, and actionability.
- Bookmarks, search, genre filters, sorting, feedback inbox, critique history,
  an auditable credit ledger, and a profile with a complete JSON data export.
- Writing circles, persistent membership, circle discussions, and circle creation.
- Owner bulletins delivered to current circle members' message inboxes, with
  separate read receipts. Incoming-message badges and alerts check once a minute
  while the tab is visible and when returning to it.
- Cursor pagination for writing, search results, critiques, line notes, circles,
  discussions, message conversations and history, credit history, author profiles,
  analytics, and operator lists. Dashboard totals count the complete collection.
- Indexed full-text prefix search across writing, pen names, and circles. Rich
  manuscript paste accepts bold, italic, and underline and removes active HTML.
- Search has a shared navbar query and centered, keyboard-accessible results.
  Profile pictures support a circular crop preview, dragging, keyboard positioning,
  zoom, replacement, and removal back to initials. Every saved crop passes SafeSearch.
  A full-width sign-out button stays at the bottom of the workshop sidebar.
- Google or verified email/password sign-in and automatic signup, account linking
  by verified email, one-time verification/reset links, a split message inbox with unread filtering,
  reply drafts per conversation, paginated history, and confirmed sent/read state,
  line annotations, author analytics, private critique visibility, activity streaks,
  and an operator dashboard for reports and user feedback.
- Work withdrawal preserves the author's feedback and line notes. Moderation is human,
  with retained report decisions, archived feedback, and a paginated action audit.
- Six clearly labeled original example pieces demonstrate the exchange. These
  are fictional authors, not fabricated community activity.

- Friends with request/accept/decline/cancel/remove controls, incoming request badges on both the sidebar and Requests tab,
  blocking, friends-only messaging, and private message reports with retained evidence.
- Human reviewer reputation: recipient-only 1–5 votes across three dimensions,
  a combined critique-card score and three profile bars. Public scores require ten
  counted ratings from five distinct writers in the last twelve months, counting
  one vote per writer/reviewer pair per fixed 30-day period. Edits allow seven days;
  removal stays available. Ratings never change credits.
- Revision-family comparison with paragraph differences and version-specific feedback.
- One opt-in daily showcase (UTC), picked by the operator with a 30-day author
  cooldown and genre rotation when alternatives exist. Reading earns no credits.
- Account export/deletion, old-session revocation, current policy acceptance, private
  contact/copyright requests, and operator case decisions and evidence-retention controls.

## Technology

React 19, TypeScript, Vinext / Vite, Cloudflare Workers, Drizzle PostgreSQL schema,
Neon PostgreSQL, and the `@neondatabase/serverless` HTTP driver. The UI uses the
bundled accessible Radix primitives and Lucide icons. PostgreSQL is the only
application database; there is no SQLite/D1 or browser-storage database fallback.
Unsynced draft changes are backed up in browser local storage per writer and draft,
with an explicit recovery prompt. Reply and critique drafts use tab-scoped session
storage. These copies contain writing; use a trusted browser on shared computers.
The production deployment uses Next.js 16 on Vercel; Vinext remains the local
development and alternate Worker build path.

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

The former ChatGPT-hosted Site was permanently deleted by the owner on
2026-10-02. The independent production host is
https://opendraft-workshop.vercel.app. Do not create or publish a replacement ChatGPT Site.

Google sign-in uses `/api/auth/login` and `/api/auth/callback`; `/api/auth/logout`
clears the session. The first verified Google sign-in creates a profile with five
credits; subsequent sign-ins keep the same profile, balance, and saved drafts.
Identity is keyed to Google's stable subject ID, not to a changeable email address.
New members complete a three-step profile setup before reaching the dashboard.
Only a pen name is required; it starts blank and never copies the Google real
name or picture. An introduction, location, and writing interests
are optional and public. Completion is stored in PostgreSQL, so returning members
go straight to the dashboard. Existing profiles complete the setup once after
the onboarding migration; their writing and credits are preserved.

Create a **Web application** client in Google Auth Platform > Clients, and put
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and a random
32+ character `AUTH_SECRET` into the ignored `.env`. Register the exact callback
URL, normally `http://127.0.0.1:5173/api/auth/callback`. Sign-in moves to the
configured callback host before setting cookies, including when visiting localhost.
Use only `openid email profile` scopes. The flow checks browser-bound state,
PKCE, nonce, token signature, issuer, audience, expiry, and verified email.
OAuth cookies expire after ten minutes; signed HttpOnly sessions after thirty days.
Production cookies require HTTPS. Never prefix secrets with `NEXT_PUBLIC_`.

Email/password authentication uses `/api/auth/password` and `/api/auth/verify`.
Passwords require at least 12 characters and are stored only as unique-salt
PBKDF2-SHA-256 hashes (600,000 iterations). Verification links expire after 24
hours; reset links expire after 30 minutes and can be used once. In production,
set `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and the canonical `AUTH_APP_URL`.
Resend receives only the address and transactional message. Development without
Resend exposes the one-time URL in the auth dialog; production never does.
Successful password reset revokes older sessions. If a verified Google and
password account share an email, both methods resolve to the same OpenDraft profile.

The public source repository is https://github.com/T-Lind/OpenDraft. Set
`SOURCE_REPOSITORY_URL` to that URL in each deployment environment. OpenDraft then
shows it on the landing page, signed-in footer, and About dialog; the application
does not guess a repository URL from a local Git checkout.

When both Google credentials are absent, **loopback development only** supports
a shared local preview account through `/signin-with-chatgpt?return_to=/`.
Production rejects legacy identity headers and never falls back to the preview.
Set `ADMIN_EMAILS` explicitly to grant operator access; its default is empty.

Optional profile pictures use `GOOGLE_VISION_API_KEY`, restricted to the Cloud
Vision API in a project with billing and `vision.googleapis.com` enabled.
The browser crops uploads to 256×256 PNG and strips metadata. Only pictures that
pass SafeSearch are stored in PostgreSQL and served by `/api/avatar`; LIKELY or
VERY_LIKELY adult, racy, or violent content is rejected. Unknown results and
screening failures prevent publishing. Each account may request one scan per
thirty seconds. Pictures are public; the upload control explains that Google
receives the image. The default is a circle with two pen-name initials.
See [Google's SafeSearch documentation](https://docs.cloud.google.com/vision/docs/detecting-safe-search).

While composing a line comment, its passage stays blue. Escape cancels the draft;
Add comment saves it in the temporary critique. Share your critique stores it in
PostgreSQL. Saved and temporary line notes remain visible in a right-hand margin,
aligned with their paragraph; on narrow screens they flow directly below that
paragraph. Click a note or marked passage to synchronize focus. Remove an unsent
note from its card. Undo/Redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, or Ctrl+Y)
cover annotation changes. Text fields keep their normal undo behavior. Unsent
notes and critique text recover from session storage per writer, work, and version.

The editor includes focus mode, plain-text/Markdown import, text export, collapsed
submission settings, process disclosure, and private autosave. A revision created
from a published work opens a workspace containing the prior version's line notes;
the writer can mark each open, resolved, kept as written, or deferred to another
draft and add a private response. Review submission requires a human-judgment
attestation and either a human-only or assistive-tools disclosure. OpenDraft does
not use an automated AI detector for enforcement; suspected misuse is reported
and reviewed by a person.

Optional Jev assistance uses model `typesafe-ai/jev` through Vercel AI Gateway's
`/v1/evaluate` endpoint. Production uses server-only `AI_GATEWAY_API_KEY` when configured, with Vercel
request OIDC as fallback. Local operators may also set the server-only key. Evaluation requires separate
per-work consent and uses a fixed clarity/craft/distinctiveness rubric. Requests
restrict the provider to TypeSafe and disallow prompt training. Provider retention
still follows its terms; Gateway zero-retention routing requires a paid plan and
is not enabled on this Hobby deployment. Scores are private to the operator, cached
for 24 hours, and limited to five evaluations per day across the workshop. Human
selection still works when Gateway authentication or evaluation is unavailable.

The operator is Tiernan Lindauer, an individual in Texas, United States. Terms,
privacy, ownership, and a private contact/copyright form are published at
`/terms`, `/privacy`, `/rights`, and `/contact`. No personal contact email is
published. Deletion removes personal profiles, pictures, manuscripts, and the
member's critiques; content-free references preserve other writers' feedback.
Reported evidence and decisions remain restricted until the operator's retention
review. Resolved evidence can be removed while preserving the case reference and
decision history. Incoming blocks survive a fresh signup to prevent evasion.

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

Reads use transactions without the exchange's advisory write lock. List endpoints
return at most 50 records (20 by default); manuscripts load separately with the
same privacy checks. Exports stream full records in batches of 50. Search uses
PostgreSQL GIN indexes and ranks title and pen-name prefixes ahead of body matches.

Rate limits are atomic PostgreSQL counters, shared across server instances:

| Action | Limit |
| --- | --- |
| All account writes | 120 per minute |
| Direct messages | 20 per minute, 20 per hour, 100 per day; 5 per recipient per minute |
| Circle bulletins | 3 per hour |
| Circle discussions | 10 per minute |
| Circle creation | 3 per day |
| Publishing / critiques | 8 / 15 per hour |
| Draft saving | 60 per minute |
| Bug or feature feedback / work reports | 5 / 10 per hour |
| Picture scans | 20 per day, at least 30 seconds apart |
| Full exports | 3 per hour |
| Community writes / friend requests | 60 per minute / 10 per day |
| Private contact requests | 3 per hour per hashed IP |
| Jev showcase evaluations | 5 per day across the workshop; 24-hour score cache |
| Search / sign-in attempts | 90 per minute / 20 per 10 minutes per hashed IP on Vercel |
| Email/password actions | 20 per 10 minutes per hashed IP; 8 per email per 15 minutes |
| Revoke all sessions | 5 per day |

Other account actions allow 30 per minute. Limit responses use HTTP 429 and
`Retry-After`; old buckets receive bounded cleanup. Existing message heuristics
reject obvious spam. Human operators handle work reports and community concerns.

The Worker uses Neon's HTTP driver rather than TCP sockets. Other PostgreSQL
providers require an HTTP-compatible proxy or a Node server adapter; a plain
Supabase/TCP URL is not interchangeable with Neon in this Worker distribution.

## Check the app

```sh
npm run typecheck
npm test
npm run build
```

Browser end-to-end checks use Playwright:

```sh
npm run db:migrate
npm run test:e2e
```

The browser suite completes onboarding through the real UI, persists and reloads
a private draft, checks the policy pages, and verifies the 390px mobile landing
layout has no horizontal overflow. It writes test accounts and drafts, so point
`DATABASE_URL` only at a disposable database. GitHub Actions provisions a fresh
PostgreSQL service for every run, installs Chromium, and retains traces, screenshots,
and video when a browser check fails. No repository database secret is required.

Authentication tests use generated signing keys and mocked Google endpoints to
check state, PKCE, token validation, replay rejection, cookies, and logout without
signing into a real Google account. PostgreSQL integration tests use
`TEST_DATABASE_URL`, falling back to `DATABASE_URL`, and
create an isolated `opendraft_test_<random>` PostgreSQL schema. They exercise the
actual API handlers and all checked-in migrations using a test session adapter and
PostgreSQL transport. They cover ownership, draft privacy, rewards, duplicate
reviews, concurrent publishing, spotlight rotation, circle membership, discussion,
reports, withdrawal, signup, direct messages, and private feedback/annotations.
The test schema is removed in `finally`. Live workshop
content is not edited by these tests.

## Deploy

Production domain: **https://opendraft-workshop.vercel.app**. The owner registered
`https://opendraft-workshop.vercel.app/api/auth/callback` on the Google Web client.

**Vercel:** select the directory containing this `package.json` as the project
root (use `opendraft` if importing its parent directory). The included
`vercel.json` selects Next.js and `npm run build:vercel`. Set these server-only
Production environment variables in Vercel, then redeploy:

- `DATABASE_URL`: the existing pooled Neon PostgreSQL URL.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: your Web application credentials.
- `GOOGLE_REDIRECT_URI`: `https://YOUR-STABLE-DOMAIN/api/auth/callback`.
- `AUTH_SECRET`: a separate random production secret of at least 32 characters.
- `ADMIN_EMAILS`: comma-separated verified Google emails for operators.
- `GOOGLE_VISION_API_KEY`: Cloud Vision restricted key for picture screening.

Add the same HTTPS callback URI to the Google client's Authorized redirect URIs.
Review Google Auth Platform's branding and audience settings before public
launch. Use a stable domain for authentication; changing Vercel preview URLs
need their own registered callback and matching Preview environment variables.
Run `npm run db:migrate` once against the target database before opening the app.
The build does not migrate or reset your database. Locally, verify the Vercel
build with `npm run build:vercel` and run it with `npx next start`.

`npm run build` still emits the existing Cloudflare Worker under `dist/server/`
and browser assets under `dist/client/` for the local Vinext workflow. The former
`.openai/hosting.json` registration has been removed. No ChatGPT hosting is used.
Keep `.env`, `.wrangler`, `.sites-runtime`, and `node_modules` out
of source archives. Source code is free; hosting and database costs depend on
where you run it.

## Project map

- `app/workshop.tsx`: navigation, state, listings, credit history, and dialog shell.
- `app/workshop-views.tsx`: manuscript reader, editor, feedback, profiles, and circles.
- `app/api/workshop/route.ts`: authenticated workshop operations.
- `app/api/community/route.ts`: friendships, ratings, showcase, account lifecycle, and cases.
- `app/api/contact/route.ts`: private contact and copyright requests.
- `components/community.tsx`, `components/showcase.tsx`, `components/revision-compare.tsx`: community controls.
- `lib/member.ts`, `lib/account-deletion.ts`, `lib/reputation.ts`, `lib/jev.ts`: policy and server logic.
- `app/data.ts`: shared types and original example writing.
- `app/globals.css`: visual system and responsive styles.
- `db/schema.ts`, `db/storage.ts`, `drizzle/`: PostgreSQL schema, queries, migrations.
- `tests/workshop.integration.mjs`: PostgreSQL integration suite.

## Scope and next steps

The exchange remains free, with human feedback and writer ownership. See
[LICENSE](LICENSE), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). GitHub issue, pull-request, and CI
templates are included; database CI needs a `TEST_DATABASE_URL` repository secret.

Draft autosave and recovery, split messaging, moderation history, reviewer ratings,
friendships, revision comparison, daily showcase, ownership policies, and account
deletion are implemented. Future work can evaluate feedback-quality rewards and
queue-aware economics once there is enough real activity. Monitor production
usage; large bulletin fanouts may eventually need a background queue. Full beta
reading exchanges are outside this pass.
