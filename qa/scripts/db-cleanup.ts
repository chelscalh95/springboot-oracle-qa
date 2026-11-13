import { OracleSession } from '../src/db/oracle';
import { sql } from '../src/db/sqlLibrary';

/** Removes leftover rows created by this suite (names containing a QA marker). Dry run unless --yes is given. */
async function main(): Promise<void> {
  const apply = process.argv.includes('--yes');
  const session = await OracleSession.open();
  try {
    const rows = await session.query<{ id: number; firstName: string; lastName: string }>(sql('FX-04'));
    if (rows.length === 0) {
      console.log('No leftover QA rows found.');
      return;
    }
    console.table(rows);
    if (!apply) {
      console.log(`Dry run: ${rows.length} row(s) carry a QA marker. Re-run with "npm run db:cleanup -- --yes" to delete them.`);
      return;
    }
    const result = await session.execute(sql('FX-05'));
    console.log(`Deleted ${result.rowsAffected ?? 0} row(s).`);
  } finally {
    await session.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
