import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OracleSession, oracleErrorNumber } from '../src/db/oracle';

/** Creates table PERSON from sql/00_schema.sql if it does not exist yet. Never drops or alters anything. */
async function main(): Promise<void> {
  const ddl = readFileSync(path.resolve(__dirname, '../sql/00_schema.sql'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
    .replace(/;\s*$/, '');

  const session = await OracleSession.open();
  try {
    await session.execute(ddl);
    console.log('Created table PERSON.');
  } catch (error) {
    if (oracleErrorNumber(error) === 955) {
      console.log('Table PERSON already exists - nothing to do.');
    } else {
      throw error;
    }
  } finally {
    await session.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
