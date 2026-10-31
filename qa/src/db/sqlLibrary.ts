import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface SqlEntry {
  id: string;
  title: string;
  kind: string;
  purpose: string;
  expect: string;
  objects: string;
  usedBy: string;
  sql: string;
}

export const SQL_LIBRARY_FILE = path.resolve(__dirname, '../../sql/validation-queries.sql');

const REQUIRED = ['title', 'kind', 'purpose', 'expect', 'objects', 'used-by'] as const;

/** Parse the annotated .sql file (format described at the top of the file) into entries. */
export function parseSqlLibrary(text: string): SqlEntry[] {
  const entries: SqlEntry[] = [];
  let meta: Record<string, string> | undefined;
  let lastKey = '';
  let body: string[] = [];
  let inBody = false;

  const flush = (): void => {
    if (!meta) return;
    for (const key of REQUIRED) {
      if (!meta[key]) throw new Error(`SQL entry ${meta.id} is missing "@${key}:"`);
    }
    const sql = body.join('\n').trim().replace(/;\s*$/, '');
    if (!sql) throw new Error(`SQL entry ${meta.id} has no statement`);
    if (entries.some((e) => e.id === meta!.id)) throw new Error(`Duplicate SQL entry id ${meta.id}`);
    entries.push({
      id: meta.id,
      title: meta.title,
      kind: meta.kind,
      purpose: meta.purpose,
      expect: meta.expect,
      objects: meta.objects,
      usedBy: meta['used-by'],
      sql,
    });
  };

  for (const line of text.split(/\r?\n/)) {
    const start = /^--\s*@id:\s*(\S+)\s*$/.exec(line);
    if (start) {
      flush();
      meta = { id: start[1] };
      lastKey = 'id';
      body = [];
      inBody = false;
      continue;
    }
    if (!meta) continue; // file header before the first entry
    if (!inBody) {
      const keyValue = /^--\s*@([\w-]+):\s*(.*)$/.exec(line);
      if (keyValue) {
        meta[keyValue[1]] = keyValue[2].trim();
        lastKey = keyValue[1];
        continue;
      }
      if (line.startsWith('--')) {
        const continuation = line.replace(/^--\s*/, '').trim();
        if (continuation && lastKey) meta[lastKey] = `${meta[lastKey]} ${continuation}`.trim();
        continue;
      }
      if (line.trim() === '') continue;
      inBody = true;
    }
    body.push(line);
  }
  flush();
  return entries;
}

let cache: SqlEntry[] | undefined;

export function sqlEntries(): SqlEntry[] {
  cache ??= parseSqlLibrary(readFileSync(SQL_LIBRARY_FILE, 'utf8'));
  return cache;
}

/** The statement text for an entry id, e.g. sql('DQ-13'). */
export function sql(id: string): string {
  const entry = sqlEntries().find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown SQL entry "${id}" (see sql/validation-queries.sql)`);
  return entry.sql;
}
