import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildSqlReference } from './lib/sql-reference';

const target = path.resolve(__dirname, '../docs/sql-reference.md');
writeFileSync(target, buildSqlReference());
console.log(`Wrote ${target}`);
