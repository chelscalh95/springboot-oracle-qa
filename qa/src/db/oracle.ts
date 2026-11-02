import oracledb from 'oracledb';
import { getOracleConfig } from '../config';

// Rows come back as objects keyed by the (quoted) column aliases used in sql/validation-queries.sql.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

export type Binds = oracledb.BindParameters;

/**
 * One Oracle connection (node-oracledb "Thin" mode: pure JavaScript, no Oracle Client install needed).
 * autoCommit=true  -> fixtures: committed immediately so the application (a different session) can see them.
 * autoCommit=false -> constraint tests: statements are never committed; callers roll back in `finally`.
 */
export class OracleSession {
  private constructor(
    private readonly connection: oracledb.Connection,
    private readonly autoCommit: boolean,
  ) {}

  static async open(options: { autoCommit?: boolean } = {}): Promise<OracleSession> {
    const config = getOracleConfig();
    try {
      const connection = await oracledb.getConnection({
        user: config.user,
        password: config.password,
        connectString: config.connectString,
      });
      return new OracleSession(connection, options.autoCommit ?? true);
    } catch (error) {
      throw new Error(
        `Cannot connect to Oracle at "${config.connectString}" as "${config.user}": ${(error as Error).message}\n` +
          'Check that the database is running and healthy and that ORACLE_USER / ORACLE_PASSWORD / ORACLE_CONNECT_STRING are correct.',
      );
    }
  }

  async query<T = Record<string, unknown>>(statement: string, binds: Binds = {}): Promise<T[]> {
    const result = await this.connection.execute<T>(statement, binds, { autoCommit: this.autoCommit });
    return result.rows ?? [];
  }

  async execute(statement: string, binds: Binds = {}): Promise<oracledb.Result<unknown>> {
    return this.connection.execute(statement, binds, { autoCommit: this.autoCommit });
  }

  async rollback(): Promise<void> {
    await this.connection.rollback();
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

/** Oracle error number of a failed statement (e.g. 1400 for ORA-01400), if the error carries one. */
export function oracleErrorNumber(error: unknown): number | undefined {
  return (error as { errorNum?: number }).errorNum;
}
