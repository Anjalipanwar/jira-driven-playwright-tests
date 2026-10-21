# jira-driven-playwright-tests

A QA automation practice project: Jira tickets go in, Playwright UI tests come out.

Each test is written from a Jira ticket in the `SCRUM` project. The workflow reads the
ticket, explores the real app to find stable locators, writes one Playwright spec per
ticket, runs it once under a strict retry policy, and updates the ticket (note + status
move) only after a clean pass. Every step is logged and every ticket gets a report.

**App under test:** [Toolshop](https://practicesoftwaretesting.com/), a public demo shop for
testing practice (API: <https://api.practicesoftwaretesting.com>).

## What's in here

```text
CLAUDE.md                     the full workflow and safety rules (used with Claude Code)
.env                          secrets, repo root, gitignored (names in e2e/.env.example)
e2e/
  playwright.config.ts        retries: 2, trace on first retry, data-test as test ID, setup project
  src/
    env.ts                    loads .env once: API_URL, ADMIN_STATE, adminCredentials()
    report.ts                 printNumberedList(): console.log + report attachment
    jira.ts                   small Jira Cloud client (the only way the project talks to Jira)
  scripts/run-summary.ts      short pass/flaky/fail summary from test-results/results.json
  tests/
    setup/auth.setup.ts       logs in once with the demo admin, saves the session to e2e/.auth/
    generated/                one spec per ticket (scrum_6.spec.ts, scrum_7.spec.ts, ...)
  logs/<ticket>.md            step-by-step run log per ticket
  reports/                    final report per ticket, plus separate findings
```

Tests depend on `src/`, never the other way round, and specs never import from
`playwright.config.ts`. New specs reuse `env.ts` and `report.ts` instead of copying code.

## Tickets automated so far

| Ticket | What it checks | Spec | Report |
|---|---|---|---|
| SCRUM-6 | Hand Tools category: print the first 3 tools after login | [scrum_6.spec.ts](e2e/tests/generated/scrum_6.spec.ts) | [report](e2e/reports/SCRUM-6-report.md) |
| SCRUM-7 | Product search by keyword, plus a "no results" state | [scrum_7.spec.ts](e2e/tests/generated/scrum_7.spec.ts) | [report](e2e/reports/SCRUM-7-report.md) |

Separate finding: [the category filter the UI uses is not in the API docs](e2e/reports/finding-api-by-category-slug.md) (from SCRUM-6).

## Setup

Requirements: Node.js 20+, and a Jira Cloud site with a `SCRUM` project if you want the
Jira part.

```bash
cd e2e
npm install
npx playwright install chromium
```

Create a `.env` file in the **repo root** (not in `e2e/`). The variable names are listed in
[e2e/.env.example](e2e/.env.example):

| Variable | Used for |
|---|---|
| `TOOLSHOP_ADMIN_EMAIL`, `TOOLSHOP_ADMIN_PASSWORD` | demo admin login for the Toolshop app |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Jira Cloud access |
| `JIRA_PROJECT_KEY` | Jira project key (`SCRUM`) |
| `JIRA_STATUS_ID_IN_PROGRESS`, `JIRA_STATUS_ID_DONE` | target status IDs for ticket moves |
| `JIRA_DRY_RUN` | optional; `true` logs Jira writes instead of sending them |
| `API_URL` | optional; defaults to the Toolshop API |

`.env`, `e2e/.auth/` (saved login session), test results and reports from Playwright are
gitignored. Never commit them.

## Running the tests

```bash
cd e2e
npm test -- tests/generated/scrum_7.spec.ts   # one ticket
npm test                                      # everything
npm run summary                               # short summary of the last run
npm run report                                # HTML report
npm run typecheck                             # TypeScript check, no test run
```

The login setup runs automatically first. If it fails, the tests that depend on it don't run.

`npm run summary` exits with `0` when everything passed on the first attempt, `2` when a test
was flaky, and `1` when something failed.

## How the ticket workflow works

The workflow is written down in [CLAUDE.md](CLAUDE.md) and is run with
[Claude Code](https://claude.com/claude-code) by saying `pick up SCRUM-<n>`. In short:

1. Fetch the ticket and list its steps and acceptance criteria (AC).
2. **Checkpoint:** show the plan and wait for approval.
3. Create a git branch named after the ticket and move the ticket to In Progress.
4. Explore the real app and pick locators (`getByRole` → `getByLabel` → `getByPlaceholder` →
   `getByTestId`; no XPath). Each finding is tagged Observed / Inferred / Assumed.
5. Write the spec: every ticket step is a `test.step()` with the ticket's wording, and every
   AC is at least one web-first `expect`. No fixed sleeps.
6. Run once. Up to 2 retries only happen after a failure:
   - **Passed on the first attempt:** clean pass.
   - **Flaky** (passed only on a retry): a finding, not a pass. A human decides what happens.
   - **Failed** all attempts: stop and report; the ticket stays In Progress.
7. **Checkpoint:** show the Jira note, then append it to the ticket and move it to Done.
8. Write the report.

Rules that always apply:

- Only the Toolshop app, its API and the Jira site (through `e2e/src/jira.ts`) are contacted.
- Demo accounts only; credentials come from environment variables and are never printed.
- Jira status moves use status IDs from the environment, never status names (the project's
  statuses are stored in German). `moveTask` only accepts `'indeterminate'` (In Progress)
  and `'done'`.
- If the app contradicts an acceptance criterion, that's reported as a finding. Assertions
  are never weakened to make a test pass.
