const { test, expect } = require('@playwright/test');

test('smoke page loads in Playwright', async ({ page }) => {
  await page.goto('data:text/html,<title>claude-sdlc-capstone</title><h1>Ready</h1>');

  await expect(page).toHaveTitle('claude-sdlc-capstone');
  await expect(page.getByRole('heading', { name: 'Ready' })).toBeVisible();
});
