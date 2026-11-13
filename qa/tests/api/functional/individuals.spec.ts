import { test, expect } from '../../../src/fixtures';
import { expectStatus, expectValidPerson } from '../../../src/api/assertions';

// Test data is created directly in Oracle (fixture) so each read is checked against a known record.
test.describe('API functional: /data-app/individuals', () => {
  test('TC-API-001 GET list returns 200 and a JSON array of well-formed persons', async ({ api, db, data }) => {
    const id = await db.insert(data.person());

    const response = await api.list();

    await expectStatus(response, 200, 'GET /data-app/individuals');
    expect(response.headers()['content-type']).toContain('application/json');
    const body: unknown[] = await response.json();
    expect(Array.isArray(body), 'response body must be a JSON array').toBe(true);
    expect(body.length).toBeGreaterThan(0);
    body.forEach((person) => expectValidPerson(person));
    expect(body.map((person) => (person as { id: number }).id)).toContain(id);
  });

  test('TC-API-002 GET by id returns 200 and exactly the stored record', async ({ api, db, data }) => {
    const person = data.person({ birthDate: '1984-11-23' });
    const id = await db.insert(person);

    const response = await api.get(id);

    await expectStatus(response, 200, `GET /data-app/individuals/${id}`);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expectValidPerson(body);
    expect(body).toEqual({ id, ...person });
  });

  test('TC-API-003 POST with valid data returns 201 Created', async ({ api, data }) => {
    const response = await api.create(data.person());

    await expectStatus(response, 201, 'POST /data-app/individuals');
  });

  test('TC-API-004 DELETE of an existing record returns 204 with no body', async ({ api, db, data }) => {
    const id = await db.insert(data.person());

    const response = await api.delete(id);

    await expectStatus(response, 204, `DELETE /data-app/individuals/${id}`);
    expect(await response.text()).toBe('');
  });
});
