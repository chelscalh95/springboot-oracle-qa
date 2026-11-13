import { test, expect } from '../../src/fixtures';
import { sql } from '../../src/db/sqlLibrary';

// Pure Oracle SQL checks: no API involved. Statements and their rationale: sql/validation-queries.sql
test.describe('Oracle validation: schema and data integrity of PERSON', () => {
  test('TC-DB-001 PERSON columns match the documented DDL', async ({ db }) => {
    const rows = await db.session.query<{ columnName: string; dataType: string; charLength: number; nullable: string }>(
      sql('DQ-02'),
    );
    const byName = Object.fromEntries(rows.map((row) => [row.columnName, row]));

    expect(Object.keys(byName).sort(), 'PERSON must have exactly these columns').toEqual([
      'BIRTH_DATE',
      'FIRST_NAME',
      'ID',
      'LAST_NAME',
    ]);
    expect(byName.ID).toMatchObject({ dataType: 'NUMBER', nullable: 'N' });
    expect(byName.FIRST_NAME).toMatchObject({ dataType: 'VARCHAR2', charLength: 255, nullable: 'N' });
    expect(byName.LAST_NAME).toMatchObject({ dataType: 'VARCHAR2', charLength: 255, nullable: 'N' });
    expect(byName.BIRTH_DATE).toMatchObject({ dataType: 'DATE', nullable: 'N' });
  });

  test('TC-DB-002 ID is the primary key and a generated identity; no foreign keys exist', async ({ db }) => {
    const primaryKey = await db.session.query<{ columnName: string }>(sql('DQ-03'));
    expect(primaryKey.map((row) => row.columnName), 'primary-key columns').toEqual(['ID']);

    const identity = await db.session.query(sql('DQ-04'));
    expect(identity, 'identity columns').toEqual([{ columnName: 'ID', generationType: 'BY DEFAULT' }]);

    const foreignKeys = await db.session.query(sql('DQ-05'));
    expect(foreignKeys, 'PERSON has no relationships, so referential-integrity checks are not applicable').toEqual([]);
  });

  test('TC-DB-003 no two rows share a primary-key value', async ({ db }) => {
    const duplicates = await db.session.query(sql('DQ-06'));
    expect(duplicates, `duplicate ids: ${JSON.stringify(duplicates)}`).toEqual([]);
  });

  test('TC-DB-004 no mandatory column contains NULL', async ({ db }) => {
    const [result] = await db.session.query<{ rowsWithNulls: number }>(sql('DQ-07'));
    expect(result.rowsWithNulls, 'rows with a NULL in a mandatory column').toBe(0);
  });

  test('TC-DB-005 no first or last name is blank (empty or whitespace only)', async ({ db }) => {
    const blanks = await db.session.query(sql('DQ-08'));
    expect(blanks, `ids with blank names: ${JSON.stringify(blanks)}`).toEqual([]);
  });

  test('TC-DB-006 no birth date lies in the future', async ({ db }) => {
    const future = await db.session.query(sql('DQ-09'));
    expect(future, `future birth dates: ${JSON.stringify(future)}`).toEqual([]);
  });

  test('TC-DB-007 BIRTH_DATE holds calendar dates only (no time of day)', async ({ db }) => {
    const withTime = await db.session.query(sql('DQ-10'));
    expect(withTime, `birth dates with a time component: ${JSON.stringify(withTime)}`).toEqual([]);
  });

  test('TC-DB-008 sample rows from data.sql are present', async ({ db }) => {
    const rows = await db.session.query<{ firstName: string; lastName: string; birthDate: string; occurrences: number }>(
      sql('DQ-11'),
    );
    const seeds = rows
      .map(({ firstName, lastName, birthDate }) => ({ firstName, lastName, birthDate }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
    expect(
      seeds,
      'Seed rows missing. data.sql runs when the application starts (spring.sql.init.mode=always); ' +
        'start the application against this schema at least once.',
    ).toEqual([
      { firstName: 'Ross', lastName: 'Smith', birthDate: '1994-05-15' },
      { firstName: 'Martin', lastName: 'Taylo', birthDate: '1974-08-22' },
    ]);
  });

  test('TC-DB-009 no two persons are identical in first name, last name and birth date', async ({ db }) => {
    const duplicates = await db.session.query(sql('DQ-12'));
    expect(
      duplicates,
      `Duplicate identities: ${JSON.stringify(duplicates)}. Typical cause: data.sql re-ran at an application ` +
        'restart (candidate defect DEF-006). Passes only on a database the application has started against once.',
    ).toEqual([]);
  });
});
