import oracledb from 'oracledb';
import type { Person, PersonInput } from '../data/testData';
import type { OracleSession } from './oracle';
import { sql } from './sqlLibrary';

/** Named operations on the PERSON table. All statements live in sql/validation-queries.sql. */
export class PersonDb {
  constructor(readonly session: OracleSession) {}

  /** Insert directly into Oracle (bypassing the API) and return the generated id. */
  async insert(person: PersonInput): Promise<number> {
    const result = await this.session.execute(sql('FX-01'), {
      firstName: person.firstName,
      lastName: person.lastName,
      birthDate: person.birthDate,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    });
    return (result.outBinds as { id: number[] }).id[0];
  }

  async findById(id: number): Promise<Person | undefined> {
    const rows = await this.session.query<Person>(sql('DQ-13'), { id });
    return rows[0];
  }

  findByMarker(marker: string): Promise<Person[]> {
    return this.session.query<Person>(sql('DQ-14'), { marker });
  }

  async countByMarker(marker: string): Promise<number> {
    const [row] = await this.session.query<{ count: number }>(sql('DQ-15'), { marker });
    return row.count;
  }

  async countAll(): Promise<number> {
    const [row] = await this.session.query<{ count: number }>(sql('DQ-16'));
    return row.count;
  }

  listAll(): Promise<Person[]> {
    return this.session.query<Person>(sql('DQ-17'));
  }

  async unusedId(): Promise<number> {
    const [row] = await this.session.query<{ unusedId: number }>(sql('DQ-22'));
    return row.unusedId;
  }

  async deleteById(id: number): Promise<void> {
    await this.session.execute(sql('FX-03'), { id });
  }

  /** Test teardown: deletes only rows carrying this test's unique marker. */
  async deleteByMarker(marker: string): Promise<number> {
    const result = await this.session.execute(sql('FX-02'), { marker });
    return result.rowsAffected ?? 0;
  }
}
