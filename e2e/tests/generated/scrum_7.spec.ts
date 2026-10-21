/**
 * SCRUM-7: Product search by keyword (home page)
 *
 * Login is only a precondition, so it runs in the `setup` project (tests/setup/auth.setup.ts)
 * and this spec loads the saved admin session.
 *
 * Exploration findings (2026-10-21, see e2e/logs/SCRUM-7.md):
 * - Observed: the search field (data-test="search-query") and the Search button
 *   (data-test="search-submit") sit in the left filter panel; clicking the button submits.
 * - Observed: results replace the product list on the same page; the URL stays "/". The
 *   results are identified by the heading data-test="search-caption" ("Searched for: hammer")
 *   with data-test="search-term", and data-test="search-result-count".
 * - Observed: the field label, the button text and the "no results" message are translated
 *   (DE: "Suche", "Es wurden keine passenden Produkte gefunden."), so elements are located by
 *   test ID and the English message text is not asserted.
 * - Observed: search matches product names only, not descriptions.
 * - Observed: the page calls QUERY /products/search {q}; Swagger documents
 *   GET /products/search?q=<term>&page=<n>, which returns the same order as the page.
 */
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE, API_URL } from '../../playwright.config';

test.use({ storageState: ADMIN_STATE });

const KEYWORD = 'hammer';
const NONSENSE_KEYWORD = 'zzzzqqqq';

/** Starts waiting for the search API response. Call before clicking Search. */
function waitForSearchResponse(page: Page) {
  return page.waitForResponse((res) => new URL(res.url()).pathname === '/products/search' && res.ok());
}

test('SCRUM-7: search products by keyword and show a no-results state', async ({ page, request }) => {
  const searchField = page.getByTestId('search-query');
  const searchButton = page.getByTestId('search-submit');
  const searchTerm = page.getByTestId('search-term');
  // Product names inside the search results area only.
  const resultNames = page.getByTestId('search_completed').getByTestId('product-name');
  let searchResponse: ReturnType<typeof waitForSearchResponse> | undefined;
  let firstThree: string[] = [];

  await test.step('Step 1: Open the home page while signed in', async () => {
    await page.goto('/');

    // Precondition check: the saved session is active (account menu shown).
    await expect(page.getByTestId('nav-menu')).toBeVisible();
    // AC1: the search field is visible on the home page.
    await expect(searchField).toBeVisible();
    await expect(searchField).toBeEditable();
  });

  await test.step('Step 2: Enter the keyword "hammer" in the search field', async () => {
    await searchField.fill(KEYWORD);

    // AC1: the search field accepts text.
    await expect(searchField).toHaveValue(KEYWORD);
  });

  await test.step('Step 3: Submit the search', async () => {
    searchResponse = waitForSearchResponse(page);
    await searchButton.click();
  });

  await test.step('Step 4: Wait for the results to load', async () => {
    await searchResponse;

    // AC2: the results are identified as search results for "hammer".
    await expect(page.getByTestId('search-caption')).toBeVisible();
    await expect(searchTerm).toHaveText(KEYWORD);
    await expect(page.getByTestId('search-result-count')).toBeVisible();
  });

  await test.step('Step 5: Read the product names in display order', async () => {
    // AC3: at least three products are listed.
    await expect(resultNames.nth(2)).toBeVisible();

    // AC4: each of the first three names contains "hammer" (case-insensitive).
    for (let i = 0; i < 3; i++) {
      await expect(resultNames.nth(i), `AC4: product ${i + 1} name contains "${KEYWORD}"`).toHaveText(
        new RegExp(KEYWORD, 'i'),
      );
    }

    firstThree = (await resultNames.allTextContents()).slice(0, 3).map((name) => name.trim());
  });

  await test.step('Step 6: Print the first three names', async () => {
    // AC5: printed as a numbered list to the console and attached to the report.
    const list = firstThree.map((name, i) => `${i + 1}. ${name}`).join('\n');
    console.log(`First three search results for "${KEYWORD}":\n${list}`);
    await test.info().attach('first-three-search-results', { body: list, contentType: 'text/plain' });

    expect(list.split('\n')).toEqual([
      expect.stringMatching(/^1\. \S/),
      expect.stringMatching(/^2\. \S/),
      expect.stringMatching(/^3\. \S/),
    ]);
    expect(test.info().attachments.map((a) => a.name)).toContain('first-three-search-results');
  });

  await test.step('AC7 (optional): first three names match the products API in the same order', async () => {
    const res = await request.get(`${API_URL}/products/search`, { params: { q: KEYWORD } });
    expect(res.ok(), `GET /products/search?q=${KEYWORD} status ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as { data: { name: string }[] };
    const apiFirstThree = body.data.slice(0, 3).map((product) => product.name.trim());

    expect(apiFirstThree).toEqual(firstThree);
  });

  await test.step('Step 7: Search again with the keyword "zzzzqqqq" and check the result', async () => {
    const nonsenseResponse = waitForSearchResponse(page);
    await searchField.fill(NONSENSE_KEYWORD);
    await searchButton.click();
    await nonsenseResponse;

    await expect(searchTerm).toHaveText(NONSENSE_KEYWORD);
    // AC6: a "no results" message is shown (text is translated, so only check it is not empty)...
    const noResults = page.getByTestId('no-results');
    await expect(noResults).toBeVisible();
    await expect(noResults).toHaveText(/\S/);
    // ...and no product cards.
    await expect(page.getByTestId('product-name')).toHaveCount(0);
  });
});
