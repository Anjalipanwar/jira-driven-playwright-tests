/**
 * Prints a short summary of the last Playwright run from test-results/results.json,
 * so nobody has to read the full test output (see Run policy in CLAUDE.md).
 *
 * Usage: cd e2e && npx tsx scripts/run-summary.ts [path/to/results.json]
 * Exit code: 0 = all passed on the first attempt, 1 = something failed, 2 = flaky only.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface PwResult {
  status: string;
  duration: number;
  retry: number;
  errors?: { message?: string }[];
  error?: { message?: string };
}
interface PwTest {
  status: string; // expected | unexpected | flaky | skipped
  results: PwResult[];
}
interface PwSpec {
  title: string;
  file: string;
  tests: PwTest[];
}
interface PwSuite {
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  stats: { startTime: string; duration: number; expected: number; unexpected: number; flaky: number; skipped: number };
  suites: PwSuite[];
}

const OUTCOME: Record<string, string> = { expected: 'PASSED', unexpected: 'FAILED', flaky: 'FLAKY', skipped: 'SKIPPED' };

function firstLine(text: string | undefined): string {
  // Strip ANSI colours and keep only the first line, capped, so output stays short.
  return (text ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 200);
}

function collect(suite: PwSuite, out: PwSpec[]): void {
  out.push(...(suite.specs ?? []));
  for (const child of suite.suites ?? []) collect(child, out);
}

const file = path.resolve(process.argv[2] ?? path.join(__dirname, '..', 'test-results', 'results.json'));
if (!fs.existsSync(file)) {
  console.error(`No results file at ${file}. Run the tests first.`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(file, 'utf8')) as PwReport;
const s = report.stats;
console.log(
  `Run ${s.startTime} (${Math.round(s.duration)} ms): passed ${s.expected}, failed ${s.unexpected}, ` +
    `flaky ${s.flaky}, skipped ${s.skipped}`,
);

const specs: PwSpec[] = [];
report.suites.forEach((suite) => collect(suite, specs));
for (const spec of specs) {
  for (const t of spec.tests) {
    const attempts = t.results.map((r) => `#${r.retry + 1} ${r.status} ${r.duration} ms`).join(', ');
    console.log(`- ${OUTCOME[t.status] ?? t.status}: ${spec.title} [${t.results.length} attempt(s): ${attempts}]`);
    for (const r of t.results) {
      if (r.status !== 'passed' && r.status !== 'skipped') {
        const msg = firstLine(r.error?.message ?? r.errors?.[0]?.message);
        console.log(`    attempt #${r.retry + 1} error: ${msg || '(no message)'}`);
      }
    }
  }
}

process.exit(s.unexpected > 0 ? 1 : s.flaky > 0 ? 2 : 0);
