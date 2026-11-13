import { test, expect } from '../../src/fixtures';
import { expectStatus } from '../../src/api/assertions';
import type { Person } from '../../src/data/testData';
import { sql } from '../../src/db/sqlLibrary';

// Each test: controlled data -> API call -> assertion on the API response AND on Oracle -> automatic cleanup.
test.describe('Integration: REST API <-> Oracle', () => {
  test('TC-INT-001 create, read and delete are reflected in Oracle at every step', async ({ api, db, data }) => {
    const person = data.person({ birthDate: '1985-03-20' });
    let id = 0;

    await test.step('POST returns 201', async () => {
      await expectStatus(await api.create(person), 201, 'POST /data-app/individuals');
    });
    await test.step('Oracle holds exactly one row with the submitted values', async () => {
      const rows = await db.findByMarker(data.marker);
      expect(rows, 'rows persisted for this POST').toHaveLength(1);
      expect(rows[0]).toMatchObject(person);
      expect(rows[0].id).toBeGreaterThan(0);
      id = rows[0].id;
    });
    await test.step('GET by id returns the record Oracle holds', async () => {
      const response = await api.get(id);
      await expectStatus(response, 200, `GET /data-app/individuals/${id}`);
      expect(await response.json()).toEqual({ id, ...person });
    });
    await test.step('GET list contains the record', async () => {
      const body: Person[] = await (await api.list()).json();
      expect(body).toContainEqual({ id, ...person });
    });
    await test.step('DELETE returns 204', async () => {
      await expectStatus(await api.delete(id), 204, `DELETE /data-app/individuals/${id}`);
    });
    await test.step('Oracle no longer holds the row', async () => {
      expect(await db.findById(id), `row ${id} still exists after DELETE`).toBeUndefined();
    });
    await test.step('GET list no longer contains the record', async () => {
      const body: Person[] = await (await api.list()).json();
      expect(body.map((p) => p.id)).not.toContain(id);
    });
  });

  test('TC-INT-002 GET list returns exactly the records stored in the PERSON table', async ({ api, db, data }) => {
    await db.insert(data.person()); // guarantees a non-empty table
    const fromApi: Person[] = await (await api.list()).json();
    const fromDb = await db.listAll();

    expect(
      [...fromApi].sort((a, b) => a.id - b.id),
      'API list differs from the PERSON table (assumes no other writer during the run)',
    ).toEqual(fromDb);
  });

  for (const birthDate of ['1970-01-01', '1994-05-15', '2000-02-29', '1900-01-01']) {
    test(`TC-INT-003 birthDate ${birthDate} is stored as the same calendar date and returned unchanged`, async ({
      api,
      db,
      data,
    }) => {
      await expectStatus(await api.create(data.person({ birthDate })), 201, `POST birthDate=${birthDate}`);

      const [row] = await db.findByMarker(data.marker);
      expect(row, 'row not found in Oracle').toBeDefined();
      expect(row.birthDate, 'calendar date stored in Oracle').toBe(birthDate);
      const [stored] = await db.session.query<{ storedValue: string }>(sql('DQ-21'), { id: row.id });
      expect(stored.storedValue, 'stored value including time of day').toBe(`${birthDate} 00:00:00`);
      const response = await api.get(row.id);
      expect((await response.json()).birthDate, 'birthDate returned by the API').toBe(birthDate);
    });
  }

  for (const special of ["O'Brien", 'Zoë Müller-Łukasiewicz', '山田 太郎', "Robert'); DROP TABLE person;--"]) {
    test(`TC-INT-004 special characters are stored literally and returned unchanged: ${special}`, async ({
      api,
      db,
      data,
    }) => {
      const person = data.person({ firstName: special, lastName: `${special}-${data.marker}` });

      await expectStatus(await api.create(person), 201, 'POST with special characters');

      const [row] = await db.findByMarker(data.marker);
      expect(row, 'row not found in Oracle').toBeDefined();
      expect(row).toMatchObject(person);
      expect(await (await api.get(row.id)).json()).toEqual({ id: row.id, ...person });
      expect(await db.session.query(sql('DQ-01')), 'PERSON table must still exist').toHaveLength(1);
    });
  }

  test('TC-INT-005 a batch of API-created records is verified with SQL filters and aggregates', async ({
    api,
    db,
    data,
  }) => {
    const batch = [
      data.person({ birthDate: '1970-01-01' }),
      data.person({ birthDate: '1985-06-30' }),
      data.person({ birthDate: '2001-12-31' }),
    ];
    for (const person of batch) {
      await expectStatus(await api.create(person), 201, `POST ${person.lastName}`);
    }

    const [aggregate] = await db.session.query<{ count: number; oldest: string; youngest: string }>(sql('DQ-18'), {
      marker: data.marker,
    });
    expect(aggregate).toEqual({ count: 3, oldest: '1970-01-01', youngest: '2001-12-31' });

    const inRange = await db.session.query<{ birthDate: string }>(sql('DQ-19'), {
      marker: data.marker,
      dateFrom: '1980-01-01',
      dateTo: '1999-12-31',
    });
    expect(inRange.map((row) => row.birthDate)).toEqual(['1985-06-30']);

    const [oldest] = await db.session.query<{ lastName: string }>(sql('DQ-20'), { marker: data.marker });
    expect(oldest.lastName).toBe(batch[0].lastName);
  });

  test('TC-INT-006 DELETE of a non-existent id is not successful and changes nothing in Oracle', async ({
    api,
    db,
    data,
  }) => {
    const control = data.person();
    const controlId = await db.insert(control);
    const missingId = await db.unusedId();
    const before = await db.countAll();

    const response = await api.delete(missingId);

    // The exact status code (404 vs 500) is asserted in TC-DEF-002; here only "not successful" + DB state.
    expect(response.status(), 'DELETE of a non-existent id must not succeed').toBeGreaterThanOrEqual(400);
    expect(await db.countAll(), 'row count changed').toBe(before);
    expect(await db.findById(controlId), 'unrelated record was affected').toEqual({ id: controlId, ...control });
  });

  test('TC-INT-007 DELETE removes exactly the targeted row', async ({ api, db, data }) => {
    const doomed = data.person();
    const keeper = data.person({ birthDate: '1975-07-07' });
    const doomedId = await db.insert(doomed);
    const keeperId = await db.insert(keeper);

    await expectStatus(await api.delete(doomedId), 204, `DELETE /data-app/individuals/${doomedId}`);

    expect(await db.findById(doomedId), 'targeted row still exists').toBeUndefined();
    expect(await db.findById(keeperId), 'other row was affected').toEqual({ id: keeperId, ...keeper });
  });
});
