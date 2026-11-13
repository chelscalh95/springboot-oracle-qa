import { test, expect } from '../../src/fixtures';
import { expectStatus } from '../../src/api/assertions';

/**
 * EXPECTED behaviour for candidate defects found by static analysis of the application source
 * (docs/defects/candidate-defects.md). Assertions are deliberately NOT weakened: while a defect is
 * present its test fails, and the failure message names the defect. When the application is fixed
 * the same test becomes the regression guard.
 * The expectations (404 for unknown ids, 400 for invalid input, create-only POST, ...) are test
 * assumptions TA-01..TA-05 - the repository has no requirements document.
 */
test.describe('Known-defect checks (run with: npm run test:defects)', () => {
  for (const candidate of [0, -1, 'above the current maximum'] as const) {
    test(`TC-DEF-001 [DEF-001] GET of an unknown id returns 404 Not Found: id ${candidate}`, async ({ api, db }) => {
      const id = typeof candidate === 'number' ? candidate : await db.unusedId();

      const response = await api.get(id);

      await expectStatus(response, 404, `GET /data-app/individuals/${id} (DEF-001: unknown id)`);
    });
  }

  test('TC-DEF-002 [DEF-002] DELETE of an unknown id returns 404 Not Found and changes nothing', async ({ api, db }) => {
    const id = await db.unusedId();
    const before = await db.countAll();

    const response = await api.delete(id);

    await expectStatus(response, 404, `DELETE /data-app/individuals/${id} (DEF-002: unknown id)`);
    expect(await db.countAll(), 'row count changed').toBe(before);
  });

  test('TC-DEF-003 [DEF-003] 201 Created identifies the new resource (Location header or id in the body)', async ({
    api,
    data,
  }) => {
    const response = await api.create(data.person());
    await expectStatus(response, 201, 'POST /data-app/individuals');

    const location = response.headers()['location'];
    let bodyId: unknown;
    try {
      bodyId = JSON.parse(await response.text()).id; // an empty body makes JSON.parse throw
    } catch {
      bodyId = undefined;
    }

    expect(
      location !== undefined || typeof bodyId === 'number',
      'DEF-003: the 201 response has neither a Location header nor an id in the body, so the client cannot find the record it created',
    ).toBe(true);
  });

  test('TC-DEF-004 [DEF-004] POST with the id of an existing record must not overwrite that record', async ({
    api,
    db,
    data,
  }) => {
    const original = data.person({ birthDate: '1980-02-02' });
    const id = await db.insert(original);

    // Status deliberately not asserted: rejecting (4xx) or creating a separate record are both acceptable.
    await api.create({ id, firstName: 'Overwritten', lastName: data.name('Overwritten'), birthDate: '2000-01-01' });

    expect(
      await db.findById(id),
      `DEF-004: POST with id=${id} modified an existing record (create endpoint behaved like an update)`,
    ).toEqual({ id, ...original });
  });

  test('TC-DEF-005 [DEF-005] names longer than the column (256 characters) are rejected with 400, not a server error', async ({
    api,
    db,
    data,
  }) => {
    const response = await api.create(data.person({ firstName: data.padded(256) }));

    await expectStatus(response, 400, 'POST with a 256-character firstName (DEF-005)');
    expect(await db.countByMarker(data.marker), 'a row was persisted').toBe(0);
  });
});
