# Latest workshop changes (October 7, 2026)

Writing, story reading, and critique reading share focus mode: surrounding navigation, header, footer, feedback buttons, and metadata disappear, while manuscript tools and an always-visible Exit focus mode control remain. A user click requests browser fullscreen when supported; denial falls back to the same clean layout. Button exit, Escape, browser fullscreen exit, and leaving the view restore the layout. Draft text and autosaving remain intact. Story focus displays the whole manuscript. Run npm run test:focus for fullscreen lifecycle and fallback checks.

Posts are capped at 3,500 words on publishing; larger private drafts still autosave so writers do not lose text. Attach existing or new posts to a larger-work title and numbered part; parts are scoped to their author and ordered in the reader. Apply migration 0023_larger-works before deployment. Critique drafts and their version-specific reading checks persist in browser local storage, with a resume/discard list in My critiques. They do not sync between devices.

Terms version 2026-10-06.2 explains automatic focused visibility checks. All twelve regions must have at least three seconds of observed visibility; all four quality categories must be at least 2/4 and their raw average above 2/4; at least 175 words and reading-room status are also required for credits. Visibility cannot prove comprehension. Failed or missing checks prompt revision; explicitly confirming withoutCredits permits zero-credit submission and skips paid evaluation. Outside-room submissions always earn zero; the transaction checks current status. Server quality evaluation remains authoritative. Composer checks run after five seconds. Public interface uses OpenDraft and no pilot label. The 100-word amount is explicitly the per-word conversion, never an additional bonus.

The reader has no Reading checks section or region progress map. Reading measurements still run privately for credit eligibility; submission feedback asks the reviewer to read more carefully when needed. OPENDRAFT_PAID_CHECKS_ENABLED=true restores Jev (typesafe-ai/jev) through AI Gateway in production, preview, and development, as requested by the owner. Setting false remains an emergency pause for every evaluator, including OIDC fallback. Vercel hosting remains on active Hobby: the daily cron uses included function usage, and exceeding free hosting limits pauses service instead of charging overages. AI Gateway usage is separately authorized and consumes its prepaid balance; auto-reload remains disabled. Earlier policy notes below are historical where they conflict with this section.

Work reminders and subscriptions are implemented in migration 0021. Reading & updates on a published work stores private, version-specific read markers, reminders, and separate feed/email subscriptions. Inbox → Work updates covers feedback, revisions, queue promotion, and requested-critique completion. Migration 0022 also covers completion while a work is still queued. Authors follow their own work in the feed by default. Marking read clears reminders; this never proves reading or changes credits. Account export/deletion includes the new records.

Email infrastructure uses Resend with verified recipients, per-work opt-in, signed one-click unsubscribe, durable event deduplication, delivery leases, bounded retries, and provider idempotency keys. No manuscript or critique text is emailed. Email stays unavailable without RESEND_API_KEY and AUTH_EMAIL_FROM; neither is configured yet. CRON_SECRET protects /api/cron/work-updates. Vercel cron runs daily at 12:00 UTC; active notification/feed requests materialize reminders and drain pending mail as well. Offline reminders are a daily fallback, not exact-time alarms. Real mail delivery remains unverified until a sender is configured. Run `npm run test:work-updates` for the focused database and mocked-mail checks.

Displayed evaluation copy uses “quality checks” without provider model branding. The provider/model identifiers remain in server code and private credit audit metadata.

# Current workshop policy (October 6, 2026)

Starting the critique page automatically acquires an available reading-room spot, once per entry. Holds expire after a fixed 30 minutes regardless of writing activity; reloads and repeated claims retain the existing deadline. After expiry, the draft remains in tab storage and the reviewer can explicitly reserve again if the work is still in the reading room and capacity is available. Polling never reacquires or renews a hold. Legacy renewal requests return 409. Migration 0020 caps existing deadlines and removes reservations outside the reading room. The previous notes about voluntary holds and ninety-minute renewal are superseded.

Jev processing is authorized by the current workshop terms, accepted once by writer and reviewer. Critique checks run after 2 seconds without edits, no more than once per 2 seconds. Four 0–4 categories are always visible; changed feedback clears old scores. The v2 rubric uses dimension-specific criteria. New earning critiques require at least 175 words, a fresh server Jev average strictly above 2/4, and grounding/usefulness each at least 2/4. Raw scores determine eligibility; client scores never do. Low-scoring feedback shares without credits; provider failure preserves the draft for retry. Migration 0019 stores private final credit decisions and text fingerprints, exported to the reviewer and deleted with either participant. Prior credit balances are unchanged. No per-work or per-check Jev consent controls remain. Critiques must be human-written; there is no AI process selector. Optional reading telemetry remains a separate voluntary pilot and never affects rewards.

Queued works show a database-derived genre queue position and a broad estimate until all requested critiques. Migration 0018 records actual queue-to-room and room-to-completed transitions, excludes examples and administrative status changes without completed feedback, and starts a real observation window. Forecasts require at least a day of observation and three recent events at each stage; otherwise the UI says an estimate is unavailable. The previous notes below describe earlier iterations where they conflict with this section. Production Neon is migrated through 0022_notify-queued-completion (October 6, 2026).

V2 live calibration covered 116 synthetic examples on 17 works, plus ten selected cases repeated three times. Final eligibility matched all 111 supplied quality expectations and repeated decisions were stable. This is development/regression evidence, not held-out accuracy: the corpus informed a correction for useful feedback buried in filler. `tests/fixtures/critique-eval-broad-results.json` records raw scores, comparisons, limitations, rubric snapshots, source hashes and reproduction commands. Automated financial tests mock only the workshop route's model call and exercise the production credit policy and PostgreSQL transaction. Live evaluation never submits member critiques or mutates balances.

Verification for the credit gate: 381 full PostgreSQL integration assertions and 25 focused financial assertions passed. TypeScript, full/focused lint, production vinext build, queue suites, critique timing/policy/provider/rendered UI suites, 35 authentication assertions, and 33 avatar/history assertions passed. The isolated preview was refreshed on port 5182; its boundary-score and outage API checks passed without changing fixture balance/reviews. GPT-6 Luna opened the preview but browser automation lost its connection before interactions, so this pass's interactive browser verification is incomplete. No live schema migration or deployment was performed.

# OpenCode handoff — OpenDraft

Date: 2026-10-04

## Local review quality pilot — October 6, 2026

Additive migration `0017_loving_jasper_sitwell` adds `critique_evidence` and
`works.ai_critique_consent` (off by default). It has not been applied to the live
Neon schema and this code has not been deployed. The in-memory platform preview
on port 5182 includes simulated Jev scores and private operator summaries.

Reviewers explicitly start session-only telemetry: focused active time,
manuscript-visible time, and twelve coarse word-region dwell counters. Hidden,
unfocused, idle (>60s), and suspended (>2.5s interval) time is excluded. These are
untrusted observations, not evidence of reading completion. Stop/discard removes
the summary; only opted-in critique submission stores it atomically with a
server-derived deterministic structure check. It is isolated from public review
queries and recipient exports, available to the operator in a paginated pilot
list and in the reviewer export. Either participant's account deletion removes it.

Browser structure checks include exact repeated sentences, text-validated anchors
distributed by word position, and rudimentary redline rationale hints. No automatic
quality score, rewards change, or punishment is enabled. A short global critique
and focused comments remain valid. Future reward decisions need a calibrated rubric,
human review, reviewer explanation/appeal, and protection against genre/accessibility
bias. Prefer revision opportunity, then withholding only a confirmed unearned reward;
repeated confirmed abuse could justify temporary earning restrictions.

Optional Jev checks require new writer permission for each published work, separate
from showcase consent, plus fresh reviewer consent for each request. The server
loads the permitted manuscript, validates version and anchors, and sends only it,
the writer request, critique, and line notes to existing TypeSafe-only/no-training
Gateway routing. Fixed 0–4 rubric: grounding, relevance, rationale, usefulness.
Provider failures and invalid scores leave critique submission available; rate
limits are 5/member/day and 25 globally/day. Results are composer-only and invalidate
on edits, without being persisted as moderation evidence. New revisions start off.

Verification: TypeScript and full lint passed, Next production build passed,
348 isolated PostgreSQL assertions passed (including pilot opt-in, admin-only
access, reviewer/recipient export separation, unchanged rewards, and deletion).
Focused timing and server-boundary suites additionally cover hidden/idle/suspended
tabs, text anchors, two-party consent, profile-field rejection, and provider errors.
GPT-6 Luna verified recording/discard, repetition hints, simulated Jev result
invalidation, inline comments, private operator summary, zero-credit short feedback,
and desktop/390px layout without console errors. No real Jev accuracy or hardware
mobile-device coverage is claimed. The preview uses visibly labeled simulated scores.

## Current pass: approval-only circles, portable settings, and human safety review

Migration `0016_mature_sabretooth` adds `reading_preferences`, `circle_requests`,
and circle access (`open` by default). Review/apply it before deploying this code.
Both new user tables use active-member INSERT guards. Preferences use optimistic
timestamps; account export and deletion include new user records.

Reading settings remain browser-persistent, with explicit private account defaults.
Defaults load on first use of an account in a browser; local adjustments survive
reload. Explicit load/save/remove controls and conflicts protect other-device copies.
Approval-only briefs and discussions are projected/filter-checked in detail, list,
snapshot, and posts APIs. Owners approve/decline requests and remove members.
Opening requires explicit exposure confirmation. Membership changes preserve
published-manuscript visibility; this is not private draft/manuscript sharing.

Admin account triage uses only unresolved work/message reports and existing message
flags within 30 days, with distinct reporters and case references. It is not an
offender verdict or automatic enforcement mechanism. Existing human case decisions
remain authoritative. No private-draft scanning or AI-authorship detection was added.

Optional editor theme checks call `/api/content-check`, sending only current text
after per-request consent. Jev uses fixed theme rubrics. Checks are limited to 5 per
member/day and 25 globally/day; results are ephemeral, edit-invalidated, advisory,
and never required for publishing. Author applies suggested notes explicitly.
Provider/model output is validated and is not copied to moderation records. Routing
requires TypeSafe + no prompt training; no compatible provider means unavailable,
not a fallback that silently weakens privacy. Do not claim zero provider retention.

GitHub browser jobs now cover desktop Chromium, Android-style touch Chromium, and
iPhone-style WebKit on separate disposable PostgreSQL services. No hardware-device
coverage is claimed. The isolated fixture on 5182 must be restarted after edits.

Observed owner setup links: GitHub Vercel installation
https://github.com/settings/installations/55539351 then project Git settings
https://vercel.com/tiernan-lindauers-projects/opendraft-workshop/settings/git .
The project is unconnected, and OpenDraft is absent from its GitHub repo picker.
Project data preferences at
https://vercel.com/tiernan-lindauers-projects/opendraft-workshop/settings#data-preferences
currently show code/chat model-training opt-in checked (read-only inspection;
not changed). This is distinct from per-request AI Gateway no-training routing.
Email/password production still needs an owner-verified Resend sender domain.

## Previous pass: mobile reading, workshops, and critique reservations

Migration `0015_outstanding_black_panther` adds owner-managed workshop brief fields
to circles, `circle_readings`, and `critique_reservations`. It is applied to the
production Neon database. The new insert guards use the existing active-member database
function; account deletion removes these records and clears owned-circle briefs.
The repository is now connected to https://github.com/T-Lind/OpenDraft on `main`.
GitHub CI runs code quality, PostgreSQL integration, and Playwright browser flows
against disposable databases. Older entries below saying “no remote” or describing
right-hand annotation cards are historical and no longer describe the current UI.
Production is https://opendraft-workshop.vercel.app; Vercel deployments remain
manual until the owner grants the Vercel GitHub App repository access.

Mobile navigation is now a separate five-item bottom bar, with a More dialog for
circles, friends, saved works, critiques, account, analytics, help, and admin.
Phone-sized annotation tools are labeled and sit above the bottom bar; comment
entry tracks the visual viewport to avoid the on-screen keyboard. Settings and
dialogs use 44px touch controls. Desktop navigation remains intact.

`components/reading-preferences.tsx` persists sanitized reading/accessibility
settings in `opendraft:reading-preferences:v1` localStorage and synchronizes tabs.
Manuscript font, size, spacing, and line length apply to reading and the settings
preview. Higher contrast, link underlines, reduced motion, and single-key shortcut
preferences apply platform-wide. OS reduced motion is always respected. Theme
continues to use next-themes' `theme` key. Settings are per-browser, not account
synced. Reader and story pages include reading focus and easy settings access.

`components/circle-workshop.tsx` shows a pinned prompt, agenda, UTC meeting/deadline
times localized for each member, shareable circle link, and a maximum 24 published
readings. Only owners edit the brief; members add readings, and the adder or owner
may remove them. No private drafts can be attached. Reading-list metadata requires
membership; circle briefs/discussion remain open to signed-in workshop members.

`lib/critique-reservations.ts` and `components/critique-reservation.tsx` implement
explicit 30-minute holds, active-edit renewal up to 90 minutes, one hold per member,
and release. Claim and submit use the same existing PostgreSQL exchange lock. The
review INSERT atomically respects other live holds and computes rewards from the
current server work status, not a stale client estimate. A failed/expired claim
does not delete sessionStorage critique text. Extra critiques after requested
feedback are still permitted at the existing half rate. No cron is required:
expiry is evaluated in every capacity check, and stale rows are cleaned on claim.

Tests add actual API reservation races, expiry/cap/release, privacy, owner/member
permissions, and a mobile Playwright flow covering persisted settings, navigation,
circle schedule/reading-list creation, and reload. The isolated fixture runs on
http://127.0.0.1:5182 and must be restarted after code edits; it never writes live data.

## Previous pass: mobile critique, revision loop, auth, and AI policy

Migration `0014_faulty_living_mummy` is applied to the production Neon database.
It adds verified email/password account
credentials, provider identities, one-time auth tokens, writing/review process
disclosures, reviewer attestation, and writer-private line-note status/response.
Passwords use unique-salt PBKDF2-SHA-256 at 600,000 iterations. Verification
links expire after 24 hours and reset links after 30 minutes; reset and the new
“sign out on every device” control revoke older sessions. Google identities link
to an existing verified-password profile by normalized verified email. Resend is
the production transactional-email provider; local development exposes the
one-time link without making an external email request.

Saved and temporary line annotations render as always-visible cards aligned to
their paragraph in a right margin. On narrow screens the card flows immediately
below the passage, while the selection tool becomes a bottom toolbar and the
comment composer becomes a bottom sheet. The phone layout uses a horizontally
scrollable bottom navigation. The editor now has focus mode, `.txt`/Markdown
import, export, collapsed submission settings, simpler publish copy, and a
revision workspace where the writer can resolve, keep, reopen, or defer prior
line notes with a private response.

The policy deliberately does not use automated AI-authorship detection. Human
writing and critique remain the norm; AI-assisted manuscripts are discouraged
but transparently disclosed, and reviewers must attest that they read the work
and personally stand behind every point. Public policy pages and the in-product
guide explain disclosure, reports, and human moderation. Jev remains a separate,
explicit per-work showcase evaluation and is not an authorship detector.

`SOURCE_REPOSITORY_URL` adds an HTTPS source link to the landing page, signed-in
footer, and About dialog. The local checkout still has no Git remote, so no URL
was invented and no source push was claimed. Set it after creating the public
repository. Production `AUTH_APP_URL` is configured for the stable Vercel domain.
`RESEND_API_KEY` and `AUTH_EMAIL_FROM` are not configured yet, so email/password
controls stay hidden in production until transactional email is available;
Google sign-in remains configured. Secrets remain server-only.

Verification for this pass: full lint and TypeScript passed; Vercel/Next and
Vinext builds completed; 35 authentication, 33 avatar/history, and 242 isolated
PostgreSQL assertions passed, including email registration/verification/reset,
revision-note ownership, session revocation, concurrency, moderation, and
deletion. A fresh release review fixed the replacement-session timestamp after a
password reset, upgraded Next.js from 16.3.4 to 16.3.8 for the critical
`ImageResponse` advisory, and left the production dependency audit at zero known
vulnerabilities. Deployment `dpl_BL5tQS5wQghAsDUq5YBHyEs63fR3` is READY and
aliased to `https://opendraft-workshop.vercel.app`. The checkout still has no Git
remote, so the release was deployed directly through Vercel and no source push
was performed.

## Current pass: community, lifecycle, legal, and showcase

The following supersedes the historical release notes below.

Follow-up: the owner's supplied AI Gateway key is configured only in ignored
local `.env` and Vercel's sensitive Production `AI_GATEWAY_API_KEY`. Values are
trimmed before use; do not print or commit credentials. A synthetic Jev request
passed using this key. Request badges now appear on Friends → Requests and the
operator's Message reports / Contact & legal tabs, as well as navigation.
Counts share the existing visible-tab notification poll; handled requests clear
their originating badge. Pending counts exclude sent requests; operator counts
are not exposed to ordinary members. Nine focused PostgreSQL assertions passed.

Short nonempty critiques (including line-note-only feedback) are allowed below
175 words with zero credits and no credit-earning ledger entry. At 175 words the
existing base reward starts; every additional 100 words earns 0.5 reading-room
credits (0.005/word), or 0.25 outside the room. UI status, submit tooltips, guide,
earnings table and dashboard explain this and discourage padding. Empty and
duplicate critiques remain rejected. Eleven focused credit-boundary assertions,
TypeScript, and changed-file lint passed. No Jev critique-credit gate is enabled:
current AI consent is for showcase manuscripts, and public ratings remain human.
Deployment `dpl_Hc5TJm2z3o1WaQCJk863pB2NqxQV` is READY and aliased to
`https://opendraft-workshop.vercel.app`; the production build passed.

Operator: Tiernan Lindauer, individual side project in Texas, United States; no
company. Contact email remains undecided and unpublished. Public terms/privacy/
rights/contact pages and versioned acceptance are implemented. Contact and
copyright complaints go privately to the operator inbox, with signed good-faith
statements for copyright requests, not a claim of registered DMCA-agent status.

New features: canonical-pair friendship requests and decisions; blocks and
friends-only messages; reported-message evidence and reasoned moderation history;
resolved-case evidence removal; export/deletion with old-session revocation;
paginated version comparison plus version-specific critiques; recipient-only
useful/specific/actionable ratings with combined critique scores and profile bars.
Public ratings need ten counted votes from five distinct writers in twelve months
with one vote per pair per fixed 30-day bucket. No credit rewards are attached.

Daily showcase is per-work opt-in, human picked for one UTC day, with author
cooldowns and genre rotation when eligible alternatives exist. Separate optional
Jev consent allows Vercel AI Gateway evaluation only; scores stay operator-private.
Model typesafe-ai/jev, three fixed criteria, 24-hour cache, five global requests/day.
No-training routing and TypeSafe-only provider allowlisting are enabled. Real
Gateway scoring passed with a synthetic passage. Zero-data-retention routing was
rejected on the Hobby plan (requires Pro/Enterprise); it is not enabled or promised.
Production uses the Vercel request OIDC token, local optional AI_GATEWAY_API_KEY.
No new Google Cloud configuration is needed.

Migrations 0012 and 0013 are applied to the existing Neon database. Active-member
INSERT guards lock/check profiles so deletion cannot be bypassed by concurrent
writes. Deletion retains content-free work references and others' feedback,
restricted report evidence, session barriers and incoming blocks; fresh verified
signup does not restore deleted writing or prior private message history.

Verification: TypeScript and full lint passed; 215 main isolated PostgreSQL
assertions plus 13 targeted lifecycle/retention/genre assertions passed; OAuth
31 and avatar/history 33 assertions passed. GPT-6 Luna alone performed focused
UI checks for friends/messages/reports/ratings/compare/showcase/account controls,
with an in-memory fixture. Tailwind source discovery is now explicit, resolving
the previous spurious binary selector warning. Deployment
`dpl_HWpiwke8CbP1fraiNu1d2FwvRs8J` is READY and aliased to
`https://opendraft-workshop.vercel.app`. The production Next build passed.
Git has no remote; the owner was asked for a
repository URL. Do not claim a source push until a remote is provided and succeeds.

## Historical: autosave, messages, moderation history, and rights

Private drafts now autosave after 1.5s idle with a 10s minimum interval. Saves
accept incomplete title/request/content, return only ID and confirmation time,
and spend no credits. The saved `created_at` timestamp is a compare-and-set token;
stale tab/device writes are rejected. Publication locks the draft and validates
the same timestamp before charging credits. Unsynced copies remain in per-user,
per-draft local storage with an explicit recovery prompt. Saved untitled titles
are canonicalized in the comparison; unchanged rich-editor blur events do not
produce a spurious backup. Status, retry, recovery, close handling, and a local
plain-text download are exposed in the editor. Reloading `#Editor` falls back to
Your writing rather than rendering without an editor object.

Messages use a desktop conversation list and thread, mobile back navigation,
server-filtered unread pages, date separators, paginated earlier messages with
scroll preservation, per-conversation tab-scoped reply drafts, and confirmed
sent/read indicators. Quiet read receipts return a small unread count without a
full workshop snapshot. Existing once-per-minute visible-tab notifications remain.
Compose/send errors preserve text. Paged-list refresh callbacks are now stable.

Migration `0011_burly_captain_marvel` adds report status/resolution/time and
`admin_actions`. Applied successfully to Neon. Human moderation decisions require
reasons where appropriate; dismissed reports retain context and feedback can be
archived. Audit action requests include actor, time, target, reason, and small
status/amount details, without copying manuscript/message bodies. Failed requests
are logged too. Credit adjustments cannot make balances negative. Administrative
withdrawal/restoration uses the shared reading-room promotion SQL and protects
private drafts. Open/history filters and all lists are paginated.

`/rights` explains retained user ownership, separation from MIT software licensing,
the narrow operating permission, visibility, withdrawal/export, and copyright
notices. It is an ownership explanation, not finalized operator terms. Formal
terms/privacy/copyright contact and account deletion remain needed. Helpful marks
are labeled as author appreciation rather than a star rating. The README records
proposed reviewer rubric safeguards, opt-in daily curation, and Jev evaluation;
no AI scoring, external manuscript transmission, or daily showcase was enabled.

TypeScript and full ESLint passed. 138 isolated PostgreSQL integration assertions
passed, including autosave conflicts and moderation history. All computer use was
delegated only to GPT-6 Luna as the owner's standing preference requires. Luna
verified incomplete autosave, Save now, reopen, no-credit charge, thread pagination,
per-recipient draft preservation and send, unread filtering, and retained/centered
search. The false untitled recovery prompt was fixed and its short recheck passed.
The UI fixture writes only in memory; database tests use a temporary schema.
This checkout still has no Git remote, so deployment is available but repository
push needs an actual remote configured by the owner.

Deployment `dpl_9uGRPTgSU5YpKSYEAcvByhyUyaAB` is READY and aliased to
`https://opendraft-workshop.vercel.app`. Vercel's production build and TypeScript
checks passed. The homepage and `/rights` return HTTP 200; production styles
include the draft-save status and split messaging interface. The known Tailwind
warning about a spurious binary-looking attribute selector is nonblocking and
should be addressed by narrowing source discovery in a future maintenance pass.

## Account and search polish

The navbar now accepts and retains the shared search query. Search uses a dedicated
top dialog placement with horizontal insets and auto margins; it no longer inherits
Tailwind's centered-dialog translate utilities. The production optimizer removed
the earlier `translate: none` override, leaving the input above the viewport.
The isolated platform fixture now uses Lightning CSS minification and confirmed
the results dialog and input remain below the header, centered exactly on the viewport.
Results reset keyboard selection when a query resolves so Enter opens the first match.

Account pictures are clickable and open a crop editor with a circular preview,
dragging/touch, arrow-key positioning, a zoom slider, reset, replacement, and removal.
The 256px PNG output still goes through the existing server SafeSearch and rate limits.
Existing pictures can be zoomed/cropped further; wider framing requires the original
file again because only the approved final crop is retained. Object URLs and bitmaps
are released, and stale image loads cannot resurrect a closed dialog. The sidebar
has a large, sticky bottom sign-out action with an icon-only layout on small screens.
Focused isolated UI checks covered selecting a synthetic picture, zoom and position,
saving, reopening, removing, and restoring initials. No real profile was modified.
TypeScript, full lint, and focused lint passed. Deployment
`dpl_47uXPsXJVFwQWP1iojb27PYG1nAJ` is READY and aliased to the production domain.
The production URL returned HTTP 200 and its CSS contains the inset-based search,
photo editor, and sidebar sign-out styles. This Git checkout has no configured
remote; no repository push was made.

## Vercel and platform continuation

The owner requested production deployment through the Vercel CLI. The project is
`opendraft-workshop` in `tiernan-lindauers-projects`, with the production domain
`https://opendraft-workshop.vercel.app`. The owner confirmed registering its
Google callback `/api/auth/callback`. Server-only Production variables were
configured via CLI without printing credentials. Production uses a separate
session signing secret. The existing local `.env` and callback are preserved.
Deployment `dpl_Buc5kAK2CudwLzzhUvt2UN2RFmM4` is READY. The production address
returns HTTP 200; the workshop API reports Google configured, anonymous reads
contain no account data, forged legacy identity headers are rejected, and login
uses the registered HTTPS callback with a Secure HttpOnly OAuth cookie. The
temporary beta hostname was removed. No ChatGPT hosting is used.

TypeScript and lint passed; 31 OAuth and 33 avatar/history checks passed. The
existing 81 database checks passed, and expanded pagination/export checks reached
the new bulletin path, exposing a timestamp type error. That was fixed with an
explicit bigint cast and verified by six focused real-handler database checks.
At the owner's request, broader UI testing was stopped and the app was deployed.

Migrations 0009 and 0010 add durable rate counters, owner circle bulletins with
per-member delivery/read state, cursor indexes, and GIN full-text search indexes.
They are applied to the existing database. All list views have bounded cursor
pages, dashboard totals use SQL aggregates, manuscript details enforce ownership,
and full exports stream batches. Read transactions no longer take the exchange's
global advisory lock. Notifications check tiny unread status once a minute while
the tab is visible and on focus. README lists exact rate limits.

Draft Edit now opens its full manuscript in the editor, and private drafts omit
withdrawal and reader-stat controls. Search input is controlled separately from
the command palette's selected item, and the modal uses one positioning transform.
Dark mode uses shared text and surface tokens; message previews sit beneath the
sender. Rich paste/drop strips active elements and attributes, preserving only
bold, italic, underline, paragraphs and line breaks. Reader notes accept general
context. Twelve genres cover fiction, nonfiction, poetry, drama and other writing.

The repository already contained MIT LICENSE; package metadata, contributor and
security guides, conduct rules, issue/PR templates, and GitHub checks are added.
Feedback-quality rewards are deliberately left for the owner's future work.

## Profile pictures and line-note continuation

The owner explicitly authorized Google Cloud Vision SafeSearch for profile-picture
screening, as a narrow exception to the older no-AI moderation rule. Billing is
linked, Vision is enabled in `opendraft-workshop`, and its API-restricted key is
only in ignored `.env`. Set `GOOGLE_VISION_API_KEY` on Vercel. Migration
`0008_profile_pictures.sql` adds screened PNG storage and scan/update timestamps.
New public identities use "Writer" until the member explicitly enters a pen name;
onboarding never copies a Google name or picture. Fictional authors are excluded
from message recipients, and send failures now show the actual error.
Line comments keep a blue selection while typing, Escape cancels, and unsent
annotation edits support undo/redo and session recovery. Clicking a saved note
opens its text; a local unsent note also explains double-click removal.

## Authentication continuation (2026-10-02)

Google OAuth is now implemented in `lib/auth.ts` and `app/api/auth/`. The owner
created a Web application client in the existing `opendraft-workshop` Google
Cloud project. Its credentials are saved only in the ignored `.env`. Never print
or commit them. Local callback: `http://127.0.0.1:5173/api/auth/callback`.
The flow uses browser-bound state, PKCE, nonce and verified Google JWTs; signed
HttpOnly sessions last thirty days. First sign-in creates a five-credit profile.
Login begins on the configured callback host so localhost/127.0.0.1 aliases
cannot lose OAuth cookies. Default successful sign-in opens `/#Dashboard`.
First-time profile setup lives in `app/onboarding.tsx`, with a PostgreSQL
`onboarding_completed` flag added by `0007_profile_onboarding.sql`. Only a display
name is required. The flag is saved atomically with profile updates and persists
across sign-ins. The additive migration has been applied to the local Neon DB.
Production rejects the old identity headers. Loopback development can still use
the legacy preview only when both Google credentials are absent.

The owner plans to deploy to **Vercel**. `vercel.json` uses the Next.js build
(`npm run build:vercel`); the existing Vinext development and Worker build remain
available. The owner subsequently requested Vercel deployment; see the section
above. README documents the Vercel
root directory, server environment variables and the matching HTTPS Google
callback URL. `ADMIN_EMAILS` must be explicitly set to grant admin access.

`tests/auth.integration.mjs` tests authentication with generated keys and mocked
Google endpoints. The workshop integration suite now applies every checked-in
migration and uses a session adapter. Its expectations reflect the newer credit
economy and per-genre spotlight rules. Withdrawal retains reviews and annotations
for their author; private feedback and messages have privacy regression checks.
The later sections below describe the earlier baseline; use README and current
code for the latest feature set and economics.

## Read this first

The user wants an original, free, open-source alternative to Scribophile, centered
on spotlight rotation, reciprocal critique, writing, and community. Use judgment
and design sense; this should feel like a modern literary workshop, not a copy.
The user explicitly requires **PostgreSQL**, prefers **Neon**, and explicitly
wants **no AI-centric or AI features**. Keep critique, feedback, recommendations,
and moderation human. No model API keys or AI calls exist in this app.

**Hosting constraint:** the owner permanently deleted the ChatGPT-hosted Site on
2026-10-02. The Sites connector subsequently confirmed "Sites project not found".
The local hosting registration is removed. Do not recreate or publish a ChatGPT
Site. This is a local source handoff; use an independent provider for any future
deployment. Read AGENTS.md for the persistent project constraints.

Project checkout:
`C:\Users\tenant\source\repos\OpenDraft\opendraft`

Start with README.md, then app/workshop.tsx, app/workshop-views.tsx,
app/api/workshop/route.ts, db/storage.ts, and db/schema.ts.

## Current working implementation

- React/Vinext on Vite, TypeScript, accessible Radix UI primitives.
- Neon PostgreSQL connected using its HTTP serverless driver. Credentials are
  already in the ignored .env file. The former remote Site secret was removed
  before the owner deleted the Site. Preserve the local connection and database.
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

TypeScript checks and production build passed. Browser checks covered genre
filtering, sign-in, and the signed-in draft
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
8. The legacy authentication adapter in app/chatgpt-auth.ts remains for local
   preview compatibility. There is no active ChatGPT-hosted deployment. The
   preview uses a development-only mock; there are no AI product features.
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

There is no active platform deployment. The owner explicitly rejected ChatGPT
hosting and deleted the old Site. Do not restore its identity or register a new
one. Preserve Neon and the PostgreSQL schema when configuring independent hosting.

## Source / deployment notes

The repository includes the bundled build and runtime helpers and vendored UI
components. Preserve licenses and package-lock.json. The hosting manifest was
removed; Vite no longer imports it, and the build helper tolerates its absence.
Bundled local preview helpers remain; they do not automatically deploy anything.
Source archives omit .env, .git, node_modules, build
output, .wrangler and .sites-runtime. README.md explains independent setup and
limitations. OpenDraft-source.zip is the portable source delivery beside the
checkout once packaged.
