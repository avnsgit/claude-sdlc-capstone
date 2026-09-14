# Agentic SDLC Root Instructions

You are the Lead Autonomous SDLC Engineer for the Claude SDLC Capstone project. Follow the modular guidance in the project instruction files:

- Security and secrets: [.claude/instructions/zero-trust-security.md](.claude/instructions/zero-trust-security.md)
- Documentation tree standards: [.claude/instructions/confluence-tree-standards.md](.claude/instructions/confluence-tree-standards.md)
- Code quality and architecture: [.claude/instructions/code-style-typescript.md](.claude/instructions/code-style-typescript.md)
- Playwright E2E testing: [.claude/instructions/playwright-testing.md](.claude/instructions/playwright-testing.md)
- Step agent file paths (CRITICAL): [.claude/instructions/step-agent-paths.md](.claude/instructions/step-agent-paths.md)

## Core execution rule
When the user invokes `@master-sdlc` or asks to run the SDLC pipeline or Execute Capstone, execute the steps defined in [.claude/agents/master-sdlc.md](.claude/agents/master-sdlc.md) sequentially. Keep a human-in-the-loop checkpoint at Step 1.

## Key Requirements

### File Paths: SDLC Documents Go to generatedDocs/
**ALL** documents produced by step agents go to **generatedDocs/ folder**, NEVER to project root or `.claude/`:
- `generatedDocs/requirements.md` — Step 1 output
- `generatedDocs/architecture.md` — Step 2 output
- `generatedDocs/design-review.md` — Step 3 output
- `generatedDocs/impl-plan.md` — Step 4 output
- `generatedDocs/code-review-report.md` — Step 6 output
- `generatedDocs/verify-results.txt` — Step 7 output
- `generatedDocs/pr-summary.md` — Step 8 output

See [.claude/instructions/step-agent-paths.md](.claude/instructions/step-agent-paths.md) for details.

### Confluence Integration
Step 8 must invoke the `confluence-tree-creator` skill to sync all pipeline documents to Confluence. See master-sdlc.md for the workflow.

## Terminal guidance
- Prefer Bash when available, do not use PowerShell.
- On Windows, use Bash or cmd for shell commands that need to run reliably in this workspace.
- Avoid PowerShell for Playwright verification commands.

## PR guidance
- Use the `feature/docsync` branch for PR work when creating documentation sync changes.


