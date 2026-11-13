import { test, expect } from '../../src/fixtures';
import { sql } from '../../src/db/sqlLibrary';

// Setup project "preflight-db": if this fails, no database or API test runs (reported as "did not run").
test.describe('Preflight: Oracle Database', () => {
  test('PF-01 Oracle Database is reachable and identified as Oracle', async ({ db }, testInfo) => {
    const [product] = await db.session.query<{ product: string; version: string }>(sql('ENV-01'));
    expect(
      product,
      'ENV-01 returned no row: the connected database does not look like an Oracle Database.',
    ).toBeDefined();
    expect(product.product).toMatch(/^Oracle/);

    const [session] = await db.session.query<{ sessionUser: string; container: string; service: string }>(
      sql('ENV-02'),
    );
    const environment = { ...product, ...session };
    // Evidence in the HTML/JUnit report of what the run actually connected to (no secrets).
    await testInfo.attach('oracle-environment', {
      body: JSON.stringify(environment, null, 2),
      contentType: 'application/json',
    });
    testInfo.annotations.push({
      type: 'oracle',
      description: `${product.product} ${product.version} | schema ${session.sessionUser} | container ${session.container}`,
    });
  });

  test('PF-02 PERSON table exists in the connected schema', async ({ db }) => {
    const rows = await db.session.query(sql('DQ-01'));
    expect(
      rows,
      'Table PERSON was not found in the connected schema. Run "npm run db:init" (creates it from sql/00_schema.sql) ' +
        'or apply the DDL from the application README.',
    ).toHaveLength(1);
  });
});
