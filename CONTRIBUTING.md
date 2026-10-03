# Contributing to OpenDraft

OpenDraft is a free workshop for human writing and thoughtful human feedback.
The source is licensed under MIT. Members' submissions remain their authors' work.

For a bug, include the steps, expected behavior, browser, and a small example.
Remove personal information and credentials from screenshots and logs. For a
feature, describe the problem it solves for a writer or reader. Discuss major
changes in an issue before investing in them.

Use Node.js 22.13 or newer. Follow README.md to configure an ignored `.env`, run
the PostgreSQL migrations, and start the local preview. Read AGENTS.md and
OPENCODE_HANDOFF.md for project constraints. Preserve the existing database and
keep all credentials on the server. Use synthetic writing and fictional accounts
in tests; never copy a member's private draft into a fixture.

Before submitting a pull request, run:

```sh
npm run typecheck
npm run lint
node tests/auth.integration.mjs
node tests/avatar-history.test.mjs
npm run build:vercel
```

Run `node tests/workshop.integration.mjs` for database or permission changes. Set
`TEST_DATABASE_URL` to a test PostgreSQL database with schema-creation permission;
the suite uses and removes an isolated schema. Review generated SQL migrations.
Do not run destructive schema resets against the workshop database.

Keep changes focused. Explain the problem, resulting behavior, and relevant
validation in the pull request. Use the existing design tokens, accessible
controls, cursor pagination, parameterized SQL, and ownership checks. Add
meaningful regression tests for security, credits, and data integrity changes.

Writing, critique, recommendations, and quality judgments remain human. The
current automated image check is the explicitly approved Google Vision
SafeSearch screen for profile pictures. Feedback-quality rewards are future work.
