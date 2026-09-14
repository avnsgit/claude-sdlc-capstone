---
name: playwright-verifier
description: This skill should be used when the user wants to run Playwright verification in headless CLI mode and capture the results.
version: 0.1.0
---

# Playwright Verifier Skill

Use this skill to run Playwright tests from the terminal in headless mode and record the results in `verify-results.txt` when needed.

## Workflow
1. Ensure Playwright and the browser binaries are installed.
2. Run `npx playwright test` in CLI mode only.
3. Do not rely on a browser GUI or manual inspection.
4. Capture the terminal output in the verification evidence file when requested.
5. Report the final status clearly.

## Output
- Commands run
- Test results
- Failures or warnings
- Verification status
