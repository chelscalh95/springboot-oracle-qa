import { existsSync } from 'node:fs';
import path from 'node:path';

// Optional local settings file (git-ignored). Variables already set in the shell win.
const envFile = path.resolve(__dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Context path of the application under test (@RequestMapping on PersonController). */
export const API_PREFIX = '/data-app';
export const INDIVIDUALS_PATH = `${API_PREFIX}/individuals`;

export const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

/** Output folder for HTML / JUnit reports and raw Playwright artifacts. */
export const reportDir = process.env.QA_REPORT_DIR ?? 'reports';

export interface OracleConfig {
  user: string;
  password: string;
  connectString: string;
}

/**
 * Read lazily so that `playwright test --list` and type-checking work without secrets.
 * The password has no default on purpose: credentials must never live in source control.
 */
export function getOracleConfig(): OracleConfig {
  const password = process.env.ORACLE_PASSWORD;
  if (!password) {
    throw new Error(
      'ORACLE_PASSWORD is not set. Copy qa/.env.example to qa/.env (git-ignored) or set it in your shell. ' +
        'Oracle credentials are intentionally never stored in source control.',
    );
  }
  return {
    user: process.env.ORACLE_USER ?? 'SPRINGORCL',
    password,
    connectString: process.env.ORACLE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1',
  };
}
