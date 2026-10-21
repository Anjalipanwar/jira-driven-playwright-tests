/**
 * Login precondition (Run policy in CLAUDE.md): signs in once with the demo admin account
 * and saves the session to e2e/.auth/admin.json (gitignored, contains the session token).
 * Specs that need a signed-in user load it with test.use({ storageState: ADMIN_STATE }).
 *
 * Locators were observed during SCRUM-6 exploration (see e2e/logs/SCRUM-6.md).
 */
import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE } from '../../playwright.config';

setup('sign in as the demo admin', async ({ page }) => {
  const email = process.env.TOOLSHOP_ADMIN_EMAIL;
  const password = process.env.TOOLSHOP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set TOOLSHOP_ADMIN_EMAIL and TOOLSHOP_ADMIN_PASSWORD in the repo-root .env');
  }

  await page.goto('/auth/login');
  await page.getByLabel('Email address').fill(email);
  // getByLabel('Password') also matches the "Forgot your Password?" link.
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  // Signed in: the account menu is shown and the login form is gone.
  await expect(page.getByTestId('nav-menu')).toBeVisible();
  await expect(page.getByTestId('login-form')).toBeHidden();

  await page.context().storageState({ path: ADMIN_STATE });
});
