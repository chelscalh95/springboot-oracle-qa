import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { sqlEntries } from '../src/db/sqlLibrary';
import { buildSqlReference } from './lib/sql-reference';

// Keeps documentation and tests from drifting apart. Run: npm run docs:check
const root = path.resolve(__dirname, '..');
const ID = /\b(TC-[A-Z]+-\d{3}|PF-\d{2})\b/g;
const errors: string[] = [];

function idsIn(text: string): Set<string> {
  return new Set(text.match(ID) ?? []);
}

function filesUnder(dir: string, extension: string): string[] {
  return readdirSync(path.join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith(extension))
    .map((name) => path.join(root, dir, name));
}

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, embedded newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// 1. Test cases (CSV) vs automated tests
const csvPath = path.join(root, 'docs', 'test-cases.csv');
const [header, ...records] = parseCsv(readFileSync(csvPath, 'utf8'));
const idColumn = header.indexOf('Test Case ID');
const statusColumn = header.indexOf('Execution Status');
if (idColumn < 0 || statusColumn < 0) errors.push('docs/test-cases.csv: missing "Test Case ID" or "Execution Status" column');
const csvIds = new Set(records.map((r) => r[idColumn]));
const testIds = new Set<string>();
for (const file of filesUnder('tests', '.ts')) idsIn(readFileSync(file, 'utf8')).forEach((id) => testIds.add(id));

for (const id of testIds) if (!csvIds.has(id)) errors.push(`${id} is in a test title but not in docs/test-cases.csv`);
for (const id of csvIds) if (!testIds.has(id)) errors.push(`${id} is in docs/test-cases.csv but no automated test carries it`);
for (const r of records) {
  if (/pass/i.test(r[statusColumn]) && !process.env.QA_ALLOW_PASSED_STATUS) {
    errors.push(`${r[idColumn]}: status "${r[statusColumn]}" - record PASS only from a real run (set QA_ALLOW_PASSED_STATUS=1 after executing)`);
  }
}

// 2. Every ID mentioned in docs or SQL metadata must exist
const referenced = [...filesUnder('docs', '.md'), path.join(root, 'README.md')].filter(existsSync);
for (const file of referenced) {
  for (const id of idsIn(readFileSync(file, 'utf8'))) {
    if (!csvIds.has(id)) errors.push(`${path.relative(root, file)} mentions unknown test case ${id}`);
  }
}
for (const entry of sqlEntries()) {
  for (const id of idsIn(entry.usedBy)) if (!csvIds.has(id)) errors.push(`SQL ${entry.id} "@used-by" names unknown test case ${id}`);
}

// 3. Traceability matrix covers every test case
const matrixIds = idsIn(readFileSync(path.join(root, 'docs', 'traceability-matrix.md'), 'utf8'));
for (const id of csvIds) if (!matrixIds.has(id)) errors.push(`${id} is not in docs/traceability-matrix.md`);

// 4. Generated SQL reference is current
const sqlRefPath = path.join(root, 'docs', 'sql-reference.md');
if (!existsSync(sqlRefPath) || readFileSync(sqlRefPath, 'utf8') !== buildSqlReference()) {
  errors.push('docs/sql-reference.md is stale: run "npm run docs:sql"');
}

if (errors.length) {
  console.error(`docs:check FAILED (${errors.length}):\n - ${errors.join('\n - ')}`);
  process.exit(1);
}
console.log(`docs:check OK - ${csvIds.size} test cases, ${testIds.size} IDs in tests, ${sqlEntries().length} SQL entries.`);
