import { expect } from '@playwright/test';
import type { APIResponse } from '@playwright/test';

/** Status assertion whose failure message shows what was called and what the server answered. */
export async function expectStatus(response: APIResponse, expected: number, what: string): Promise<void> {
  if (response.status() === expected) return;
  const body = (await response.text()).slice(0, 500);
  throw new Error(
    `${what}: expected HTTP ${expected} but received ${response.status()} ${response.statusText()} ` +
      `(${response.url()})\nResponse body: ${body || '<empty>'}`,
  );
}

/** Contract of a Person as returned by the API: exactly these four fields with these types. */
export function expectValidPerson(person: unknown): void {
  expect(person).toEqual({
    id: expect.any(Number),
    firstName: expect.any(String),
    lastName: expect.any(String),
    birthDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });
  expect(Number.isInteger((person as { id: number }).id), 'id must be an integer').toBe(true);
}
