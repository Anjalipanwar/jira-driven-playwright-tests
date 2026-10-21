/**
 * SCRUM-6: Test: Hand Tools - print the first 3 tools after login
 *
 * Exploration findings (2026-10-21, see e2e/logs/SCRUM-6.md):
 * - Observed: the admin account lands on /admin/dashboard after login, and the Categories
 *   menu is still in the main menu there, so no home-link fallback is needed.
 * - Observed: Categories opens on click (not hover). Hand Tools is a single link to
 *   /category/hand-tools.
 * - Observed: getByLabel('Password') also matches the "Forgot your Password?" link, so the
 *   password field uses getByLabel(/^Password/).
 * - Observed: the user menu (data-test="nav-menu") shows the account holder's name, which is
 *   data-driven, so it is located by test ID rather than by its text.
 * - Observed: the page loads products with QUERY /products {page: 1, by_category_slug:
 *   "hand-tools"} and no sort. The Swagger docs say GET takes the same keys. The documented
 *   by_category filter returns 0 products for Hand Tools (its products live in
 *   subcategories); by_category_slug is undocumented but is what the page uses.
 */
import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.API_URL || 'https://api.practicesoftwaretesting.com';

function adminCredentials(): { email: string; password: string } {
  const email = process.env.TOOLSHOP_ADMIN_EMAIL;
  const password = process.env.TOOLSHOP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set TOOLSHOP_ADMIN_EMAIL and TOOLSHOP_ADMIN_PASSWORD in the repo-root .env');
  }
  return { email, password };
}

/** Ticket steps 1-5 with AC1-AC5. Returns the first three product names in display order. */
async function loginAndReadFirstThreeHandTools(page: Page): Promise<string[]> {
  const mainMenu = page.getByRole('menubar', { name: 'Main menu' });
  const productNames = page.getByTestId('product-name');

  await test.step('Step 1: Open the home page and log in with the demo admin account', async () => {
    const { email, password } = adminCredentials();
    await page.goto('/');
    await mainMenu.getByRole('link', { name: 'Sign in' }).click();
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    // AC1: signed in (account menu visible) and the login form is no longer shown.
    await expect(page.getByTestId('nav-menu')).toBeVisible();
    await expect(page.getByTestId('login-form')).toBeHidden();
  });

  const handToolsLink = mainMenu.getByRole('link', { name: 'Hand Tools', exact: true });

  await test.step('Step 2: Open the Categories menu in the main navigation', async () => {
    await mainMenu.getByRole('button', { name: 'Categories' }).click();

    // AC2: the Categories menu opens and contains a Hand Tools entry.
    await expect(handToolsLink).toBeVisible();
  });

  await test.step('Step 3: Choose Hand Tools from the dropdown', async () => {
    await handToolsLink.click();

    // AC3: the URL and heading identify the Hand Tools category.
    await page.waitForURL('**/category/hand-tools', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/category\/hand-tools$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Category: Hand Tools' })).toBeVisible();
  });

  await test.step('Step 4: Read the product list on the category page', async () => {
    // AC4: at least three products are listed (the third one is visible).
    await expect(productNames.nth(2)).toBeVisible();
  });

  return test.step('Step 5: Take the names of the first three products, in the order they are displayed', async () => {
    // AC5: each of the first three names is non-empty text.
    for (let i = 0; i < 3; i++) {
      await expect(productNames.nth(i)).toHaveText(/\S/);
    }
    const names = (await productNames.allTextContents()).slice(0, 3).map((name) => name.trim());
    expect(names).toHaveLength(3);
    return names;
  });
}

test('SCRUM-6: print the first 3 Hand Tools after login (AC1-AC6)', async ({ page }) => {
  const names = await loginAndReadFirstThreeHandTools(page);

  await test.step('Step 6: Print the three names', async () => {
    // AC6: numbered list to the console and attached to the report.
    const list = names.map((name, i) => `${i + 1}. ${name}`).join('\n');
    console.log(`First three Hand Tools:\n${list}`);
    await test.info().attach('first-three-hand-tools', { body: list, contentType: 'text/plain' });
  });
});

test('SCRUM-6: first 3 Hand Tools match the products API (AC7)', async ({ page, request }) => {
  const names = await loginAndReadFirstThreeHandTools(page);

  await test.step('AC7: The three names match the first three products returned by the products API', async () => {
    // Same filter and (default) order the page uses, as a read-only GET.
    const response = await request.get(`${API_URL}/products`, {
      params: { by_category_slug: 'hand-tools', page: 1 },
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data?: { name: string }[] };
    const apiNames = (body.data ?? []).slice(0, 3).map((product) => product.name.trim());

    const comparison = names.map((name, i) => `${i + 1}. page: ${name} | api: ${apiNames[i] ?? '(missing)'}`).join('\n');
    console.log(`Page vs API (Hand Tools, page 1, default order):\n${comparison}`);
    await test.info().attach('page-vs-api', { body: comparison, contentType: 'text/plain' });

    expect(apiNames).toEqual(names);
  });
});
