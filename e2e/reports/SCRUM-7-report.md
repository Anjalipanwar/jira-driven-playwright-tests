# SCRUM-7 report

| | |
|---|---|
| Ticket | SCRUM-7: Product search by keyword (home page) |
| Run mode | **REAL** (JIRA_DRY_RUN unset for all Jira writes) |
| Workflow mode | SUPERVISED (both checkpoints approved) |
| Date | 2026-10-21 |
| Branch | SCRUM-7 |
| Spec | e2e/tests/generated/scrum_7.spec.ts |
| Login | Precondition only -> `setup` project (e2e/tests/setup/auth.setup.ts), session saved to e2e/.auth/admin.json (gitignored) |
| Account | Demo admin only (TOOLSHOP_ADMIN_EMAIL / TOOLSHOP_ADMIN_PASSWORD from .env) |
| Final Jira status | Erledigt (id 10003, category done) |

## What was built

- `e2e/tests/generated/scrum_7.spec.ts`: one test with the 7 ticket steps as `test.step()` (same wording) plus an AC7 step.
- `e2e/tests/setup/auth.setup.ts`: signs in once and saves the session.
- `e2e/playwright.config.ts`: new `setup` project; `chromium` depends on it; exports `ADMIN_STATE`.
  Only specs that call `test.use({ storageState: ADMIN_STATE })` use the session (SCRUM-6 still logs in itself).

## Result

First three search results for "hammer", in display order:

1. Claw Hammer with Shock Reduction Grip
2. Hammer
3. Claw Hammer

## Acceptance criteria

| AC | Check | Result |
|---|---|---|
| 1 | `search-query` visible and editable; holds "hammer" after fill | PASSED |
| 2 | `search-caption` visible, `search-term` = "hammer", `search-result-count` visible | PASSED |
| 3 | 3rd result name visible (at least 3 results) | PASSED |
| 4 | Each of the first 3 names matches /hammer/i | PASSED |
| 5 | Numbered list via console.log and test.info().attach (`first-three-search-results`) | PASSED |
| 6 | "zzzzqqqq": `no-results` visible and not empty, 0 `product-name` | PASSED |
| 7 (optional) | First 3 names equal first 3 of `GET /products/search?q=hammer`, same order | PASSED |

## Test results (from test-results/results.json, run 2026-10-21T16:02:17Z, total 4448 ms)

| Test | Attempts | Final outcome | Duration per attempt |
|---|---|---|---|
| [setup] sign in as the demo admin | 1 | PASSED | #1: 1938 ms |
| [chromium] SCRUM-7: search products by keyword and show a no-results state | 1 | PASSED | #1: 1200 ms |

No retries, no fix attempts.

## Findings (exploration)

- Observed: search box (`data-test="search-query"`) and button (`search-submit`) are in the left filter panel; clicking the button submits.
- Observed: results replace the list on the same page; URL stays `/`. No URL change to assert.
- Observed: label, button and "no results" text are translated (EN "There are no products found.", DE "Es wurden keine passenden Produkte gefunden."). The test uses test IDs and doesn't assert the English text. The "Searched for:" caption is currently not translated.
- Observed: search matches product names only (20 products have "handle" only in their description; searching "handle" returns 1 product).
- Observed: the page uses `QUERY /products/search {q}`; Swagger (`/docs?api-docs.json`) documents `GET /products/search?q=&page=`. Same order as the UI.
- Inferred: the search panel works the same signed in as signed out (explored as guest so no credentials went through the browser tool; confirmed by the signed-in test run).

## Not covered

- Filters, sorting, pagination, cart, checkout, account data (out of scope).
- Searches with more than one page of results (hammer has 6, page size 9).
- Other languages: the test runs in the default EN locale.
- Other browsers: only Chromium.

## Jira actions

| # | Action | Call | Result |
|---|---|---|---|
| 1 | Read ticket | getTaskDescription / getIssueStatus | 200; status Zu erledigen (10000) |
| 2 | Move to In Progress | moveTask('SCRUM-7', 'indeterminate') | 204; In Bearbeitung (10001) |
| 3 | Append note | updateDescription('SCRUM-7', ...) | 204; appended, original text kept |
| 4 | Move to Done | moveTask('SCRUM-7', 'done') | 204; Erledigt (10003) |

Appended note:

> Automation test created: e2e/tests/generated/scrum_7.spec.ts (passed on first attempt on 2026-10-21)
