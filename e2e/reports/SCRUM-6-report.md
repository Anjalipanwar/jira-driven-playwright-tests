# SCRUM-6 report

| | |
|---|---|
| Ticket | SCRUM-6: Test: Hand Tools - print the first 3 tools after login |
| Run mode | **REAL** (JIRA_DRY_RUN unset for all Jira writes) |
| Date | 2026-10-21 |
| Branch | SCRUM-6 |
| Spec | e2e/tests/generated/scrum_6.spec.ts |
| Account | Demo admin only (TOOLSHOP_ADMIN_EMAIL / TOOLSHOP_ADMIN_PASSWORD from .env) |
| Final Jira status | Erledigt (category done) |

## Result

First three Hand Tools, in display order:

1. Combination Pliers
2. Pliers
3. Bolt Cutters

## Acceptance criteria

| AC | Covered by | Result |
|---|---|---|
| 1 Login succeeds | Test 1, step 1: user menu (`nav-menu`) visible, `login-form` hidden | PASSED |
| 2 Categories menu contains Hand Tools | Test 1, step 2 | PASSED |
| 3 Hand Tools page: URL and heading | Test 1, step 3: `/category/hand-tools`, H2 "Category: Hand Tools" | PASSED |
| 4 At least three products | Test 1, step 4: third product name visible | PASSED |
| 5 First three names, non-empty, display order | Test 1, step 5 | PASSED |
| 6 Names printed and attached | Test 1, step 6: console + `first-three-hand-tools` attachment | PASSED |
| 7 (optional) Names match the products API | Test 2: `GET /products?by_category_slug=hand-tools&page=1` | PASSED |

## Test runs

Run with `--repeat-each=3` (the run policy in CLAUDE.md at the time of the run).

| Test | Run 1 | Run 2 | Run 3 | Outcome |
|---|---|---|---|---|
| print the first 3 Hand Tools after login (AC1-AC6) | 3499 ms | 3006 ms | 3004 ms | PASSED 3/3 |
| first 3 Hand Tools match the products API (AC7) | 2334 ms | 2799 ms | 2671 ms | PASSED 3/3 |

Totals: 6 expected, 0 unexpected, 0 flaky, 0 fix attempts.

Confirmation run at 2026-10-21T15:44:55Z, after restoring the spec file name (see Notes):

| Test | Run 1 | Run 2 | Run 3 | Outcome |
|---|---|---|---|---|
| print the first 3 Hand Tools after login (AC1-AC6) | 2829 ms | 2792 ms | 2795 ms | PASSED 3/3 |
| first 3 Hand Tools match the products API (AC7) | 2936 ms | 2914 ms | 2900 ms | PASSED 3/3 |

## Findings

All Observed during exploration (evidence in e2e/logs/SCRUM-6.md).

1. The admin account lands on `/admin/dashboard` after login. The Categories menu is still in
   the main menu there, so no deviation from the ticket steps was needed.
2. Categories opens on click, not hover. Hand Tools is one entry (answers ticket open question 2).
3. Product order was stable across all page loads and API calls (answers open question 3).
4. `getByLabel('Password')` matches two elements (the "Forgot your Password?" link has
   "Password" in its aria-label). The spec uses `getByLabel(/^Password/)`.
5. API documentation gap: the page loads products with `QUERY /products` and the filter
   `by_category_slug`, which is not documented in Swagger. The documented `by_category`
   filter returns 0 products for Hand Tools because its products live in subcategories.
   The page sends no `sort`, so the default order was compared.

## Jira actions

| # | Action | Mode | Outcome | HTTP | Read-back | Time (UTC) |
|---|---|---|---|---|---|---|
| 1 | Move to In Progress (`moveTask('SCRUM-6','indeterminate')`, status from JIRA_STATUS_ID_IN_PROGRESS) | REAL | SUCCESS | POST 204 | In Bearbeitung, category indeterminate | 2026-10-21T15:41:19Z |
| 2 | Append note (`updateDescription`) | REAL | SUCCESS | PUT 204 | Old text unchanged; note appended once at the end | 2026-10-21T15:41:32Z |
| 3 | Move to Done (`moveTask('SCRUM-6','done')`, status from JIRA_STATUS_ID_DONE) | REAL | SUCCESS | POST 204 | Erledigt, category done | 2026-10-21T15:41:42Z |

Appended note:

> Automation test created: e2e/tests/generated/scrum_6.spec.ts (passed 3/3 on 2026-10-21).
> Coverage: only the demo admin account was tested; customer accounts were not covered.

## Notes

- At about 15:31Z, outside this workflow, the spec was renamed to `scrum.spec.ts` (test titles
  "SCRUM: ...") and the run log was moved to `logs/SCRUM.md`. The test logic was unchanged.
  The CLAUDE.md names were restored (`scrum_6.spec.ts`, `logs/SCRUM-6.md`), so the file named
  in the Jira note exists. The restored file passed the confirmation run above.

## Not covered

- Customer accounts (only the demo admin account was tested).
- Out of scope per the ticket: cart, checkout, sorting and filtering, other categories,
  account changes, pagination beyond the first page.
