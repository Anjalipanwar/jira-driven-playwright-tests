import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Load the repo-root .env, resolved from this file's folder (not the current working directory).
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

export const API_URL = process.env.API_URL || 'https://api.practicesoftwaretesting.com';

/** Saved admin session from the setup project (gitignored: contains the session token). */
export const ADMIN_STATE = path.resolve(__dirname, '.auth/admin.json');

export default defineConfig({
  testDir: './tests/generated',
  // Run policy (CLAUDE.md): one run, up to 2 retries only after a failure.
  retries: 2,
  reporter: [
    ['dot'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'https://practicesoftwaretesting.com/',
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
  },
  projects: [
    // Login precondition: saves the admin session to .auth/. Follows the same retry policy;
    // if it fails after retries, the dependent tests don't run.
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Only specs that call test.use({ storageState: ADMIN_STATE }) use the saved session.
      dependencies: ['setup'],
    },
  ],
});
