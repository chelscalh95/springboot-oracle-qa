import { defineConfig } from '@playwright/test';
import { apiBaseUrl, reportDir } from './src/config';

/**
 * Projects are organised by purpose. Both "preflight" projects are setup projects: if one fails,
 * everything that depends on it is reported as "did not run" instead of as a wall of misleading
 * application failures. That is how environment problems are separated from application defects.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: `${reportDir}/test-results`,
  fullyParallel: false,
  workers: 1, // all tests share one Oracle schema; serial runs keep table-level checks deterministic
  retries: 0, // no silent retries: a flaky test must be investigated, not hidden
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `${reportDir}/html` }],
    ['junit', { outputFile: `${reportDir}/junit.xml` }],
  ],
  use: {
    baseURL: apiBaseUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  projects: [
    { name: 'preflight-db', testDir: './tests/preflight', testMatch: /db\.setup\.ts/ },
    {
      name: 'preflight-api',
      testDir: './tests/preflight',
      testMatch: /api\.setup\.ts/,
      dependencies: ['preflight-db'],
    },
    { name: 'db-validation', testDir: './tests/db', dependencies: ['preflight-db'] },
    { name: 'api-functional', testDir: './tests/api/functional', dependencies: ['preflight-api'] },
    { name: 'api-validation', testDir: './tests/api/validation', dependencies: ['preflight-api'] },
    { name: 'integration', testDir: './tests/integration', dependencies: ['preflight-api'] },
    // Encodes EXPECTED behaviour for candidate defects (see docs/defects). Kept apart so the
    // release gate (npm run test:core) is not mixed with known, tracked failures.
    { name: 'known-defects', testDir: './tests/known-defects', dependencies: ['preflight-api'] },
  ],
});
