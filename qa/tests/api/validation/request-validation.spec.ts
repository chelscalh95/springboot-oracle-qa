import { test, expect } from '../../../src/fixtures';
import { expectStatus } from '../../../src/api/assertions';
import { isoDateOffset, type TestData } from '../../../src/data/testData';

const VALID_DATE = '1990-01-15';

interface PayloadCase {
  name: string;
  body: (data: TestData) => Record<string, unknown>;
}

// Whichever name stays valid carries the marker, so "nothing persisted" can be proven per test.
const mandatoryFieldCases: PayloadCase[] = [
  { name: 'firstName missing', body: (d) => ({ lastName: d.name('Last'), birthDate: VALID_DATE }) },
  { name: 'firstName null', body: (d) => ({ firstName: null, lastName: d.name('Last'), birthDate: VALID_DATE }) },
  { name: 'firstName empty string', body: (d) => ({ firstName: '', lastName: d.name('Last'), birthDate: VALID_DATE }) },
  { name: 'firstName whitespace only', body: (d) => ({ firstName: '   ', lastName: d.name('Last'), birthDate: VALID_DATE }) },
  { name: 'lastName missing', body: (d) => ({ firstName: d.name('First'), birthDate: VALID_DATE }) },
  { name: 'lastName null', body: (d) => ({ firstName: d.name('First'), lastName: null, birthDate: VALID_DATE }) },
  { name: 'lastName empty string', body: (d) => ({ firstName: d.name('First'), lastName: '', birthDate: VALID_DATE }) },
  { name: 'lastName whitespace only', body: (d) => ({ firstName: d.name('First'), lastName: '   ', birthDate: VALID_DATE }) },
  { name: 'birthDate missing', body: (d) => ({ firstName: d.name('First'), lastName: d.name('Last') }) },
  { name: 'birthDate null', body: (d) => ({ firstName: d.name('First'), lastName: d.name('Last'), birthDate: null }) },
];

// +2 days keeps the case "in the future" for any time-zone difference between runner and server.
const birthDateCases: { name: string; value: string }[] = [
  { name: 'in the future (+2 days)', value: isoDateOffset(2) },
  { name: 'wrong format dd-MM-yyyy', value: '15-05-1994' },
  { name: 'wrong format MM/dd/yyyy', value: '05/15/1994' },
  { name: 'impossible calendar date', value: '1994-02-30' },
  { name: 'not a date', value: 'not-a-date' },
];

const malformedCases: { name: string; body: string | undefined; contentType: string; status: number }[] = [
  { name: 'malformed JSON', body: '{"firstName": "A", "lastName": ', contentType: 'application/json', status: 400 },
  { name: 'empty body', body: undefined, contentType: 'application/json', status: 400 },
  { name: 'JSON array instead of object', body: '[]', contentType: 'application/json', status: 400 },
  { name: 'unsupported media type (text/plain)', body: 'firstName=A&lastName=B', contentType: 'text/plain', status: 415 },
];

const invalidIds = ['abc', '1.5', '2147483648', '1 OR 1=1'];

const unsupportedMethods = [
  { name: 'PUT on a record', method: 'PUT', onRecord: true },
  { name: 'PATCH on a record', method: 'PATCH', onRecord: true },
  { name: 'PUT on the collection', method: 'PUT', onRecord: false },
  { name: 'DELETE on the collection', method: 'DELETE', onRecord: false },
];

test.describe('API validation: POST /data-app/individuals', () => {
  for (const testCase of mandatoryFieldCases) {
    test(`TC-VAL-001 rejects a missing or blank mandatory field with 400 and persists nothing: ${testCase.name}`, async ({
      api,
      db,
      data,
    }) => {
      const response = await api.create(testCase.body(data));

      await expectStatus(response, 400, `POST with ${testCase.name}`);
      expect(
        await db.countByMarker(data.marker),
        `a row was persisted although the request was invalid (${testCase.name})`,
      ).toBe(0);
    });
  }

  for (const testCase of birthDateCases) {
    test(`TC-VAL-002 rejects an invalid birthDate with 400 and persists nothing: ${testCase.name}`, async ({
      api,
      db,
      data,
    }) => {
      const response = await api.create(data.person({ birthDate: testCase.value }));

      await expectStatus(response, 400, `POST with birthDate "${testCase.value}"`);
      expect(
        await db.countByMarker(data.marker),
        `a row was persisted although birthDate was invalid (${testCase.name})`,
      ).toBe(0);
    });
  }

  for (const testCase of malformedCases) {
    test(`TC-VAL-003 rejects a malformed request and leaves the table unchanged: ${testCase.name}`, async ({ api, db }) => {
      const before = await db.countAll();

      const response = await api.createRaw(testCase.body, testCase.contentType);

      await expectStatus(response, testCase.status, `POST with ${testCase.name}`);
      expect(await db.countAll(), 'row count changed although the request was rejected').toBe(before);
    });
  }

  test('TC-VAL-005 names of exactly 255 characters (the column width) are accepted and stored intact', async ({
    api,
    db,
    data,
  }) => {
    const person = data.person({ firstName: data.padded(255), lastName: data.padded(255) });

    await expectStatus(await api.create(person), 201, 'POST with 255-character names');

    const rows = await db.findByMarker(data.marker);
    expect(rows, 'rows persisted').toHaveLength(1);
    expect(rows[0]).toMatchObject(person);
    expect(rows[0].firstName).toHaveLength(255);
  });
});

test.describe('API validation: path variable and HTTP methods', () => {
  for (const id of invalidIds) {
    test(`TC-VAL-004 GET and DELETE reject a non-integer id with 400: "${id}"`, async ({ api, db }) => {
      const before = await db.countAll();

      await expectStatus(await api.get(id), 400, `GET /individuals/${id}`);
      await expectStatus(await api.delete(id), 400, `DELETE /individuals/${id}`);

      expect(await db.countAll(), 'row count changed although the id was invalid').toBe(before);
    });
  }

  for (const testCase of unsupportedMethods) {
    test(`TC-VAL-006 ${testCase.name} is not allowed (405) and changes nothing`, async ({ api, db, data }) => {
      const original = data.person();
      const id = await db.insert(original);
      const before = await db.countAll();

      const response = await api.send(testCase.method, testCase.onRecord ? `/${id}` : '', {
        ...original,
        firstName: 'Changed',
      });

      await expectStatus(response, 405, `${testCase.method} ${testCase.onRecord ? '/individuals/{id}' : '/individuals'}`);
      expect(await db.findById(id), 'record changed although the method is not allowed').toEqual({ id, ...original });
      expect(await db.countAll(), 'row count changed although the method is not allowed').toBe(before);
    });
  }
});
