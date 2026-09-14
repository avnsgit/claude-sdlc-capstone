# claude-sdlc-capstone

Node.js CommonJS automation pipeline scaffold with Playwright end-to-end tests and Claude Code customizations.

## Claude Code Layout

- `CLAUDE.md` holds the workspace instructions.
- `.claude/agents/` contains the SDLC workflow agents.
- `.claude/skills/` contains reusable workflow skills.
- `.claude/hooks/` contains the secret guard and documentation guard hooks.

## Scripts

- `npm start` runs the sync pipeline entry point.
- `npm test` runs the Node.js unit tests.
- `npm run test:e2e` runs the Playwright smoke tests.

## Environment

- `ATLASSIAN_HOST`
- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`
- `PLAYWRIGHT_BASE_URL`
- `VERIFY_RESULTS_PATH`
- `JIRA_PROJECT_KEY`
- `JIRA_ISSUE_KEY`
- `CONFLUENCE_SPACE_KEY`
