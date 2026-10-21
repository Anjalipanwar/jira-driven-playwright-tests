import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Load the repo-root .env, resolved from this file's folder (not the current working directory).
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

export const API_URL = process.env.API_URL || 'https://api.practicesoftwaretesting.com';

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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
