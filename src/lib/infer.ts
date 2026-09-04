import type { CellValue, ColumnType } from '../types/dataset';
import { isMissing } from '../types/dataset';

const INT_RE = /^-?\d+$/;
const DECIMAL_RE = /^-?\d*\.\d+$/;
const BOOL_TRUE = new Set(['true', 'yes', 'y', '1']);
const BOOL_FALSE = new Set(['false', 'no', 'n', '0']);
const DATE_RE =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;

/**
 * Infers a column's type by sampling its non-missing values. Uses a simple
 * majority-vote so a handful of stray values (e.g. "N/A" in a numeric
 * column) don't force everything to fall back to string.
 */
export function inferColumnType(values: CellValue[]): ColumnType {
  const sample = values.filter((v) => !isMissing(v)).slice(0, 500);
  if (sample.length === 0) return 'string';

  const votes = { integer: 0, decimal: 0, boolean: 0, date: 0, string: 0 };

  for (const raw of sample) {
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (typeof v === 'boolean') {
      votes.boolean++;
      continue;
    }
    if (typeof v === 'number') {
      votes[Number.isInteger(v) ? 'integer' : 'decimal']++;
      continue;
    }
    const s = String(v);
    const lower = s.toLowerCase();
    if (BOOL_TRUE.has(lower) || BOOL_FALSE.has(lower)) votes.boolean++;
    else if (INT_RE.test(s)) votes.integer++;
    else if (DECIMAL_RE.test(s)) votes.decimal++;
    else if (DATE_RE.test(s) && !Number.isNaN(Date.parse(s))) votes.date++;
    else votes.string++;
  }

  const total = sample.length;
  const threshold = total * 0.9;
  if (votes.boolean >= threshold) return 'boolean';
  if (votes.integer >= threshold) return 'integer';
  if (votes.integer + votes.decimal >= threshold) return 'decimal';
  if (votes.date >= threshold) return 'date';

  // Category heuristic: low cardinality relative to row count, and not numeric.
  const unique = new Set(sample.map((v) => String(v).trim().toLowerCase()));
  if (unique.size <= Math.max(10, total * 0.05) && unique.size < total) return 'category';

  return 'string';
}

export function coerceToType(value: CellValue, type: ColumnType): { value: CellValue; ok: boolean } {
  if (isMissing(value)) return { value: null, ok: true };
  const s = typeof value === 'string' ? value.trim() : value;

  switch (type) {
    case 'integer': {
      const n = typeof s === 'number' ? s : Number(String(s).replace(/,/g, ''));
      if (Number.isFinite(n) && Number.isInteger(n)) return { value: n, ok: true };
      if (Number.isFinite(n)) return { value: Math.trunc(n), ok: true };
      return { value: null, ok: false };
    }
    case 'decimal': {
      const n = typeof s === 'number' ? s : Number(String(s).replace(/,/g, ''));
      return Number.isFinite(n) ? { value: n, ok: true } : { value: null, ok: false };
    }
    case 'boolean': {
      if (typeof s === 'boolean') return { value: s, ok: true };
      const lower = String(s).toLowerCase();
      if (BOOL_TRUE.has(lower)) return { value: true, ok: true };
      if (BOOL_FALSE.has(lower)) return { value: false, ok: true };
      return { value: null, ok: false };
    }
    case 'date': {
      const d = new Date(String(s));
      if (Number.isNaN(d.getTime())) return { value: null, ok: false };
      return { value: d.toISOString().slice(0, 10), ok: true };
    }
    case 'category':
    case 'string':
    default:
      return { value: String(s), ok: true };
  }
}
