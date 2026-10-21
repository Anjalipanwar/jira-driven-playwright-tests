/**
 * The one place that loads the repo-root .env and reads settings from it.
 * Never log the values read here.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';

/** Repo-root .env (one level above e2e/). */
export const ENV_PATH = path.resolve(__dirname, '../../.env');
dotenv.config({ path: ENV_PATH, quiet: true });

export const API_URL = process.env.API_URL || 'https://api.practicesoftwaretesting.com';

/** Saved admin session from the `setup` project (gitignored: contains the session token). */
export const ADMIN_STATE = path.resolve(__dirname, '../.auth/admin.json');

/** Demo admin login from TOOLSHOP_ADMIN_EMAIL / TOOLSHOP_ADMIN_PASSWORD. */
export function adminCredentials(): { email: string; password: string } {
  const email = process.env.TOOLSHOP_ADMIN_EMAIL;
  const password = process.env.TOOLSHOP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(`Set TOOLSHOP_ADMIN_EMAIL and TOOLSHOP_ADMIN_PASSWORD in ${ENV_PATH}`);
  }
  return { email, password };
}
