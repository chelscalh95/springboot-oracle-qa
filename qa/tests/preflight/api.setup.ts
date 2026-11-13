import { test, expect } from '../../src/fixtures';
import { expectStatus } from '../../src/api/assertions';
import { apiBaseUrl } from '../../src/config';

// Setup project "preflight-api": proves the application is up AND writes to the Oracle schema the tests query.
test.describe('Preflight: application', () => {
  test('PF-03 Application is reachable and serves GET /data-app/individuals', async ({ api }) => {
    const response = await api.list().catch((error: Error) => {
      throw new Error(
        `Application not reachable at ${apiBaseUrl}: ${error.message}\n` +
          'Start it as described in the README ("Start the application") and check API_BASE_URL.',
      );
    });
    await expectStatus(response, 200, 'GET /data-app/individuals');
  });

  test('PF-04 A record created through the API is stored in the Oracle schema under test', async ({ api, db, data }) => {
    await expectStatus(await api.create(data.person()), 201, 'POST /data-app/individuals');

    const rows = await db.findByMarker(data.marker);

    expect(
      rows,
      `The API answered 201 but no row with marker ${data.marker} exists in the Oracle schema the tests are ` +
        'connected to. Likely causes: the application runs with the "local" (H2) profile, or it is connected to a ' +
        'different database, schema or PDB. Check the application start-up log ("profile is active") and the ' +
        'SPRING_DATASOURCE_* variables.',
    ).toHaveLength(1);
  });
});
