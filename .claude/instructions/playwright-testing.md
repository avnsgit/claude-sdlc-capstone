# Playwright CLI Testing Guidelines

## 1. Execution Mode
- Run all Playwright verification in headless CLI mode only.
- Do not require interactive browser inspection or manual visual confirmation.
- On Windows, invoke Playwright through Bash or cmd, not PowerShell.

## 2. Headless Configuration
- Keep Playwright configured with `headless: true`.
- Use `screenshot: 'only-on-failure'` and `trace: 'retain-on-failure'` for diagnostics.
