# Zero-Trust Security and Credentials Guidelines

## 1. Environment Variables
- Fetch all secrets, tokens, and credentials from local `.env` values or `process.env`.
- Never hardcode API keys, token values, or placeholder credentials in source code, config, or docs.

## 2. Pre-Commit Hooks
- Before staging or committing code changes, run `.claude/hooks/scripts/pre-commit-secret-guard.sh`.
- Abort the action immediately if a secret pattern is detected.

## 3. Git Exclusion
- Confirm that `.env`, `node_modules/`, and test output logs are listed in `.gitignore`.
