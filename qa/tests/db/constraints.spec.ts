import { test, expect } from '../../src/fixtures';
import { OracleSession, oracleErrorNumber } from '../../src/db/oracle';
import { sql } from '../../src/db/sqlLibrary';

/** Runs `work` on its own connection and always rolls back, so a constraint that is NOT enforced leaves no data behind. */
async function inRolledBackTransaction(work: (session: OracleSession) => Promise<void>): Promise<void> {
  const session = await OracleSession.open({ autoCommit: false });
  try {
    await work(session);
  } finally {
    await session.rollback();
    await session.close();
  }
}

async function expectOracleError(statement: () => Promise<unknown>, code: number, what: string): Promise<Error> {
  const ora = `ORA-${String(code).padStart(5, '0')}`;
  try {
    await statement();
  } catch (error) {
    expect(oracleErrorNumber(error), `expected ${ora} (${what}) but got: ${(error as Error).message}`).toBe(code);
    return error as Error;
  }
  throw new Error(`Expected ${ora} (${what}) but the statement succeeded: the database did not enforce the constraint.`);
}

// The database must protect its own integrity, whatever the application validates.
test.describe('Oracle validation: constraints are enforced by the database', () => {
  for (const [entry, column] of [
    ['NEG-01', 'FIRST_NAME'],
    ['NEG-02', 'LAST_NAME'],
    ['NEG-03', 'BIRTH_DATE'],
  ] as const) {
    test(`TC-DB-010 NOT NULL is enforced on ${column} (ORA-01400)`, async () => {
      await inRolledBackTransaction(async (session) => {
        const error = await expectOracleError(() => session.execute(sql(entry)), 1400, `NULL ${column}`);
        expect(error.message, 'the error should name the offending column').toContain(column);
      });
    });
  }

  test('TC-DB-011 a duplicate primary key is rejected (ORA-00001)', async ({ db }) => {
    const id = await db.unusedId();
    await inRolledBackTransaction(async (session) => {
      await session.execute(sql('NEG-04'), { id }); // first insert is accepted (and rolled back at the end)
      await expectOracleError(() => session.execute(sql('NEG-04'), { id }), 1, `duplicate id ${id}`);
    });
  });

  test('TC-DB-012 a 256-character first name is rejected by the VARCHAR2(255) column (ORA-12899)', async () => {
    await inRolledBackTransaction(async (session) => {
      const error = await expectOracleError(
        () => session.execute(sql('NEG-05'), { firstName: 'x'.repeat(256) }),
        12899,
        '256 characters into VARCHAR2(255)',
      );
      expect(error.message, 'maximum column width reported by Oracle').toContain('maximum: 255');
    });
  });
});
