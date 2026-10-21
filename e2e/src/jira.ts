/**
 * Small Jira Cloud REST API v3 client.
 *
 * Env vars (loaded from the repo-root .env):
 *   JIRA_BASE_URL   e.g. https://your-site.atlassian.net
 *   JIRA_EMAIL      Atlassian account email
 *   JIRA_API_TOKEN  Atlassian API token
 *   JIRA_DRY_RUN    optional; "true" makes write functions log instead of sending
 *
 * Never log the Authorization header, the token, or the base64 credentials.
 */
import axios, { type AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

const ENV_PATH = path.resolve(__dirname, '../../.env');
dotenv.config({ path: ENV_PATH, quiet: true });

const REQUIRED_ENV = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] as const;
const TIMEOUT_MS = 15_000;
const MAX_429_RETRIES = 2;
const DEFAULT_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

const PROJECT_KEY_RE = /^[A-Z][A-Z0-9_]+$/;
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;

// ---------- Types ----------

export interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  marks?: AdfMark[];
}

export interface AdfDoc extends AdfNode {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}

export interface JiraTask {
  key: string;
  summary: string;
  description: string;
  labels: string[];
  status: string;
  /** Language-independent status group: 'new' | 'indeterminate' | 'done'. */
  statusCategory: string;
}

/** Jira's language-independent status groups. */
export type StatusCategoryKey = 'new' | 'indeterminate' | 'done';
const STATUS_CATEGORY_KEYS: readonly string[] = ['new', 'indeterminate', 'done'];

export interface JiraTransition {
  id: string;
  name: string;
  to?: { id: string; name: string; statusCategory?: { key: string; name?: string } };
}

interface JiraIssueFields {
  summary?: string;
  description?: AdfDoc | null;
  labels?: string[];
  status?: { name: string; statusCategory?: { key: string } };
}

interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

interface SearchJqlResponse {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

interface TransitionsResponse {
  transitions?: JiraTransition[];
}

type HttpMethod = 'GET' | 'POST' | 'PUT';

// ---------- Errors ----------

export class JiraError extends Error {
  readonly status?: number;
  readonly errorMessages: string[];
  readonly errors: Record<string, string>;

  constructor(
    message: string,
    status?: number,
    errorMessages: string[] = [],
    errors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'JiraError';
    this.status = status;
    this.errorMessages = errorMessages;
    this.errors = errors;
  }
}

// ---------- HTTP client ----------

let client: AxiosInstance | undefined;

function getClient(): AxiosInstance {
  if (client) return client;

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new JiraError(`Missing env var(s): ${missing.join(', ')} (expected in ${ENV_PATH})`);
  }

  const baseURL = process.env.JIRA_BASE_URL!.trim().replace(/\/+$/, '');
  const credentials = Buffer.from(
    `${process.env.JIRA_EMAIL!.trim()}:${process.env.JIRA_API_TOKEN!.trim()}`,
  ).toString('base64');

  client = axios.create({
    baseURL,
    timeout: TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  return client;
}

function isDryRun(): boolean {
  return process.env.JIRA_DRY_RUN?.trim().toLowerCase() === 'true';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry-After may be seconds or an HTTP date. */
function retryAfterMs(header: unknown): number {
  if (typeof header !== 'string' && typeof header !== 'number') return DEFAULT_RETRY_MS;
  const value = String(header).trim();
  const seconds = Number(value);
  let ms = value !== '' && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  if (Number.isNaN(ms)) ms = DEFAULT_RETRY_MS;
  return Math.min(Math.max(ms, 0), MAX_RETRY_MS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Builds a JiraError from Jira's errorMessages/errors fields.
 * The original axios error is not attached because its config holds the auth header.
 */
function toJiraError(err: unknown, method: HttpMethod, url: string): JiraError {
  if (err instanceof JiraError) return err;
  const where = `Jira ${method} ${url} failed`;

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const body: unknown = err.response?.data;
    const errorMessages: string[] = [];
    const errors: Record<string, string> = {};

    if (isRecord(body)) {
      if (Array.isArray(body.errorMessages)) {
        for (const m of body.errorMessages) if (typeof m === 'string' && m) errorMessages.push(m);
      }
      if (isRecord(body.errors)) {
        for (const [field, msg] of Object.entries(body.errors)) errors[field] = String(msg);
      }
    }

    const parts = [...errorMessages, ...Object.entries(errors).map(([f, m]) => `${f}: ${m}`)];
    if (parts.length === 0 && isRecord(body) && typeof body.message === 'string') parts.push(body.message);
    const detail = parts.length > 0 ? parts.join('; ') : err.message;

    return new JiraError(`${where}${status ? ` (${status})` : ''}: ${detail}`, status, errorMessages, errors);
  }

  return new JiraError(`${where}: ${err instanceof Error ? err.message : String(err)}`);
}

function logCall(method: HttpMethod, url: string, status: number | string, startedAt: number): void {
  console.log(`[jira] ${method} ${url} -> ${status} (${Date.now() - startedAt} ms)`);
}

/** High-level log for each exported action (never includes credentials). */
function logAction(message: string): void {
  console.log(`[jira] ${message}`);
}

/** Every Jira call goes through here: logging, 429 retries, error conversion. */
async function jiraRequest<T>(
  method: HttpMethod,
  url: string,
  options: { params?: Record<string, string | number>; data?: unknown } = {},
): Promise<T> {
  let http: AxiosInstance;
  try {
    http = getClient();
  } catch (err) {
    throw toJiraError(err, method, url);
  }

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    try {
      const res = await http.request<T>({ method, url, params: options.params, data: options.data });
      logCall(method, url, res.status, startedAt);
      return res.data;
    } catch (err) {
      const response = axios.isAxiosError(err) ? err.response : undefined;
      logCall(method, url, response?.status ?? 'ERR', startedAt);

      if (response?.status === 429 && attempt < MAX_429_RETRIES) {
        const waitMs = retryAfterMs(response.headers['retry-after']);
        console.warn(`[jira] rate limited; retry ${attempt + 1}/${MAX_429_RETRIES} in ${waitMs} ms`);
        await sleep(waitMs);
        continue;
      }
      throw toJiraError(err, method, url);
    }
  }
}

// ---------- Validation ----------

function assertProjectKey(projectKey: string): void {
  if (!PROJECT_KEY_RE.test(projectKey)) {
    throw new JiraError(`Invalid project key "${projectKey}" (expected uppercase, e.g. "ABC")`);
  }
}

function assertIssueKey(issueKey: string): void {
  if (!ISSUE_KEY_RE.test(issueKey)) {
    throw new JiraError(`Invalid issue key "${issueKey}" (expected e.g. "ABC-123")`);
  }
}

function issuePath(issueKey: string): string {
  return `/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
}

function getIssue(issueKey: string, fields: string[]): Promise<JiraIssue> {
  return jiraRequest<JiraIssue>('GET', issuePath(issueKey), { params: { fields: fields.join(',') } });
}

// ---------- ADF -> plain text ----------

function renderChildren(node: AdfNode): string {
  return Array.isArray(node.content) ? node.content.map(renderNode).join('') : '';
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

/** Puts `marker` before the item's first line and indents the rest to line up under it. */
function renderListItems(items: AdfNode[], markerFor: (item: AdfNode, index: number) => string): string {
  return items
    .map((item, i) => {
      const marker = markerFor(item, i);
      const pad = ' '.repeat(marker.length);
      const lines = renderChildren(item).replace(/\n+$/, '').split('\n');
      return lines.map((line, j) => (j === 0 ? marker + line : line ? pad + line : line)).join('\n') + '\n';
    })
    .join('');
}

function renderTable(node: AdfNode): string {
  const rows = node.content ?? [];
  return rows
    .map((row) => {
      const cells = (row.content ?? []).map((cell) => renderChildren(cell).replace(/\s*\n\s*/g, ' ').trim());
      return cells.join(' | ') + '\n';
    })
    .join('');
}

function renderNode(node: AdfNode): string {
  if (!isRecord(node)) return '';
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  const items = Array.isArray(node.content) ? node.content : [];

  switch (node.type) {
    case 'text': {
      const text = node.text ?? '';
      const link = node.marks?.find((m) => m.type === 'link');
      const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : '';
      return href && href !== text ? `${text} (${href})` : text;
    }
    case 'hardBreak':
      return '\n';
    case 'mention': {
      const text = typeof attrs.text === 'string' ? attrs.text : 'unknown';
      return text.startsWith('@') ? text : `@${text}`;
    }
    case 'emoji':
      return String(attrs.text ?? attrs.shortName ?? '');
    case 'status':
      return String(attrs.text ?? '');
    case 'date': {
      const date = new Date(Number(attrs.timestamp));
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    }
    case 'inlineCard':
    case 'blockCard':
    case 'embedCard':
      return typeof attrs.url === 'string' ? attrs.url : '';
    case 'paragraph':
    case 'heading':
    case 'codeBlock':
      return ensureTrailingNewline(renderChildren(node));
    case 'bulletList':
      return renderListItems(items, () => '- ');
    case 'orderedList': {
      const start = Number(attrs.order ?? 1);
      const first = Number.isFinite(start) ? start : 1;
      return renderListItems(items, (_, i) => `${first + i}. `);
    }
    case 'taskList':
      return renderListItems(items, (item) => (item.attrs?.state === 'DONE' ? '- [x] ' : '- [ ] '));
    case 'decisionList':
      return renderListItems(items, () => '- ');
    case 'blockquote':
      return renderChildren(node)
        .replace(/\n+$/, '')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n') + '\n';
    case 'rule':
      return '---\n';
    case 'table':
      return renderTable(node);
    default:
      // Unknown node: use its own text, then its children's text.
      return (node.text ?? '') + renderChildren(node);
  }
}

/** Converts an Atlassian Document Format (ADF) document to plain text. */
export function adfToPlainText(doc: AdfNode | null | undefined): string {
  if (!doc || !isRecord(doc)) return '';
  return renderNode(doc)
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
}

function textToParagraph(text: string): AdfNode {
  const content: AdfNode[] = [];
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((line, i) => {
      if (i > 0) content.push({ type: 'hardBreak' });
      if (line) content.push({ type: 'text', text: line });
    });
  return { type: 'paragraph', content };
}

// ---------- Public API ----------

/** All issues in the project with status "To Do". */
export async function getTodoTasks(projectKey: string): Promise<JiraTask[]> {
  assertProjectKey(projectKey);
  const jql = `project = "${projectKey}" AND status = "To Do"`;
  logAction(`getTodoTasks: searching ${jql}`);
  const tasks: JiraTask[] = [];
  let nextPageToken: string | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params: Record<string, string | number> = {
      jql,
      fields: 'summary,description,labels,status',
      maxResults: PAGE_SIZE,
    };
    if (nextPageToken) params.nextPageToken = nextPageToken;

    const res = await jiraRequest<SearchJqlResponse>('GET', '/rest/api/3/search/jql', { params });
    logAction(`getTodoTasks: page ${page} returned ${res.issues?.length ?? 0} issue(s)`);
    for (const issue of res.issues ?? []) {
      const f = issue.fields ?? {};
      tasks.push({
        key: issue.key,
        summary: f.summary ?? '',
        description: adfToPlainText(f.description),
        labels: f.labels ?? [],
        status: f.status?.name ?? '',
        statusCategory: f.status?.statusCategory?.key ?? '',
      });
    }

    if (res.isLast === true || !res.nextPageToken) {
      logAction(`getTodoTasks: found ${tasks.length} To Do task(s) in ${projectKey}`);
      return tasks;
    }
    nextPageToken = res.nextPageToken;
  }

  console.warn(`[jira] getTodoTasks(${projectKey}): stopped at ${MAX_PAGES} pages; results may be incomplete`);
  logAction(`getTodoTasks: found ${tasks.length} To Do task(s) in ${projectKey}`);
  return tasks;
}

/** The issue's description as plain text ("" if empty). */
export async function getTaskDescription(issueKey: string): Promise<string> {
  assertIssueKey(issueKey);
  logAction(`getTaskDescription: fetching ${issueKey}`);
  const issue = await getIssue(issueKey, ['description']);
  const text = adfToPlainText(issue.fields?.description);
  logAction(`getTaskDescription: ${issueKey} description is ${text ? `${text.length} chars` : 'empty'}`);
  return text;
}

/**
 * Moves the issue. `transitionName` is matched case-insensitively, in this order:
 * transition name, target status name, then target status category key
 * ('new' | 'indeterminate' | 'done').
 */
export async function moveTask(issueKey: string, transitionName: string): Promise<void> {
  assertIssueKey(issueKey);
  const wanted = transitionName.trim().toLowerCase();
  if (!wanted) throw new JiraError('moveTask: transitionName must not be empty');
  logAction(`moveTask: ${issueKey} -> '${transitionName}'${isDryRun() ? ' (dry run)' : ''}`);

  const transitionsUrl = `${issuePath(issueKey)}/transitions`;
  const [issue, res] = await Promise.all([
    getIssue(issueKey, ['status']),
    jiraRequest<TransitionsResponse>('GET', transitionsUrl),
  ]);
  const transitions = res.transitions ?? [];

  const describe = (t: JiraTransition): string =>
    `'${t.name}' (to ${t.to?.name ?? '?'}, category ${t.to?.statusCategory?.key ?? '?'})`;
  const available = transitions.map(describe).join(', ') || 'none';

  let match =
    transitions.find((t) => t.name.toLowerCase() === wanted) ??
    transitions.find((t) => t.to?.name.toLowerCase() === wanted);

  if (!match && STATUS_CATEGORY_KEYS.includes(wanted)) {
    const byCategory = transitions.filter((t) => t.to?.statusCategory?.key.toLowerCase() === wanted);
    if (byCategory.length > 1) {
      throw new JiraError(
        `${issueKey}: ${byCategory.length} transitions lead to category '${wanted}', so the choice is ambiguous: ` +
          `${byCategory.map(describe).join(', ')}. Pass the transition name instead.`,
      );
    }
    match = byCategory[0];
  }

  if (!match) {
    throw new JiraError(`${issueKey}: no transition matches '${transitionName}'. Available: ${available}`);
  }

  const from = issue.fields?.status?.name ?? 'unknown';
  const to = match.to?.name ?? match.name;
  const body = { transition: { id: match.id } };

  if (isDryRun()) {
    console.log(`[jira] DRY RUN: would POST ${transitionsUrl} ${JSON.stringify(body)}`);
    console.log(`[jira] DRY RUN: ${issueKey}: ${from} -> ${to} via '${match.name}'`);
    return;
  }

  await jiraRequest<unknown>('POST', transitionsUrl, { data: body });
  console.log(`[jira] ${issueKey}: ${from} -> ${to} via '${match.name}'`);
}

/** Appends one paragraph to the end of the description. Existing content is kept as-is. */
export async function updateDescription(issueKey: string, appendText: string): Promise<void> {
  assertIssueKey(issueKey);
  if (!appendText.trim()) throw new JiraError('updateDescription: appendText must not be empty');
  logAction(`updateDescription: ${issueKey} appending ${appendText.length} chars${isDryRun() ? ' (dry run)' : ''}`);

  const issue = await getIssue(issueKey, ['description']);
  const current = issue.fields?.description;
  if (!current) logAction(`updateDescription: ${issueKey} has no description; starting a new one`);
  const base: AdfDoc = current && isRecord(current) ? current : { type: 'doc', version: 1, content: [] };
  const description: AdfDoc = {
    ...base,
    content: [...(Array.isArray(base.content) ? base.content : []), textToParagraph(appendText)],
  };
  const body = { fields: { description } };

  if (isDryRun()) {
    console.log(`[jira] DRY RUN: would PUT ${issuePath(issueKey)} ${JSON.stringify(body)}`);
    return;
  }

  await jiraRequest<unknown>('PUT', issuePath(issueKey), { data: body });
  console.log(`[jira] ${issueKey}: appended a paragraph to the description`);
}
