# Project constraints

- Do not create, register, restore, or publish a ChatGPT Sites deployment. The
  owner permanently deleted the former hosted Site on 2026-10-02 and explicitly
  rejected ChatGPT hosting. Continue development locally. Any future hosting
  should use an independent provider selected by the owner.
- Use PostgreSQL. Preserve the existing Neon database and ignored `.env` file;
  never print or commit credentials.
- No AI features: writing, critiques, recommendations, and moderation are human.
- Read `README.md` and `OPENCODE_HANDOFF.md` before changing the app. Existing
  starter helpers and the legacy authentication adapter remain to preserve the
  working local preview. They are not permission to publish through Sites.
- Replace the legacy authentication adapter before independent production
  deployment; never trust caller-supplied identity headers on a standalone host.
