# Project constraints

- The owner requires any computer/browser-use work to be delegated only to a
  `gpt-6-luna` subagent (GPT-6 Luna), to control computer-use costs. Do not perform
  browser/computer interactions in the main agent or other-model subagents.
  This preference applies to future turns as well as the current task.

- Do not create, register, restore, or publish a ChatGPT Sites deployment. The
  owner permanently deleted the former hosted Site on 2026-10-02 and explicitly
  rejected ChatGPT hosting. Continue development locally. Any future hosting
  should use an independent provider selected by the owner.
- Use PostgreSQL. Preserve the existing Neon database and ignored `.env` file;
  never print or commit credentials.
- Writing, critiques, and recommendations remain human. The owner explicitly authorized Google Cloud Vision SafeSearch for profile-picture screening on 2026-10-02; all other moderation remains human. On 2026-10-03 the owner authorized optional Jev assistance through Vercel AI Gateway for showcase evaluation. On 2026-10-06 the owner replaced per-work/per-request Jev consent with explicit acceptance of updated workshop terms (writer and reviewer), and requested automatic critique evaluation after edits. Generative AI may not compose or rewrite critiques; Jev only evaluates them. public reviewer ratings and final showcase choices remain human.
- Read `README.md` and `OPENCODE_HANDOFF.md` before changing the app. Existing
  starter helpers and the legacy authentication adapter remain to preserve the
  working local preview. They are not permission to publish through Sites.
- Replace the legacy authentication adapter before independent production
  deployment; never trust caller-supplied identity headers on a standalone host.
