import { randomBytes } from 'node:crypto';

// "type" (not "interface") so these shapes are assignable to the Record<string, unknown> that expect().toMatchObject() takes.
export type PersonInput = {
  firstName: string;
  lastName: string;
  /** ISO calendar date, yyyy-mm-dd (the format the API serialises LocalDate to) */
  birthDate: string;
};

export type Person = PersonInput & { id: number };

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomToken(length: number): string {
  return Array.from(randomBytes(length), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/**
 * Every test gets its own marker ("QA-" + 10 lowercase alphanumerics). It is embedded in the names
 * of every record the test creates, so that
 *   - assertions can find "my" rows without depending on ids or on the rest of the table, and
 *   - cleanup deletes only rows carrying this marker, never unrelated data.
 * The format is also what SQL entries FX-04/FX-05 (npm run db:cleanup) look for.
 */
export class TestData {
  readonly marker = `QA-${randomToken(10)}`;
  private counter = 0;

  /** A valid person payload whose last name carries the marker. */
  person(overrides: Partial<PersonInput> = {}): PersonInput {
    this.counter += 1;
    return {
      firstName: 'New',
      lastName: `Tester-${this.marker}-${this.counter}`,
      birthDate: '1990-01-15',
      ...overrides,
    };
  }

  /** A name field value (e.g. for a payload where the other name is deliberately invalid). */
  name(prefix: string): string {
    return `${prefix}-${this.marker}`;
  }

  /** A string of exactly `length` characters that still starts with the marker. */
  padded(length: number): string {
    return `${this.marker}${'x'.repeat(length)}`.slice(0, length);
  }
}

/** Today's date shifted by `days`, as yyyy-mm-dd (UTC calendar date). */
export function isoDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
