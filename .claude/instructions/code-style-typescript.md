# Code Quality and Architecture Standards

## 1. Code Architecture
- Prefer small, modular files under `src/`.
- Keep API adapters, workflow orchestration, and configuration parsing in separate modules.
- Use clear function names that describe intent.

## 2. Error Handling and Resilience
- Do not allow uncaught promise rejections or unhandled runtime exceptions.
- Gracefully handle network errors, missing configuration, and invalid input.
- Log meaningful context without leaking headers, tokens, or raw secrets.

## 3. DRY and Clean Code
- Avoid duplicate logic.
- Extract shared HTTP or filesystem behavior into reusable modules.
- Keep new helpers small and testable.
