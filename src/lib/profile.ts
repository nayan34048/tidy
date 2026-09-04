import type { CellValue, ColumnType, Dataset } from '../types/dataset';
import { columnValues, isMissing } from '../types/dataset';

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  examples: CellValue[];
  min?: number | string;
  max?: number | string;
  /** 0-1 heuristic: 1 is pristine, 0 is unusable. */
  quality: number;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  missingCellPct: number;
  duplicateRowCount: number;
  columns: ColumnProfile[];
}

function rowKey(row: Record<string, CellValue>, cols: string[]): string {
  return cols.map((c) => JSON.stringify(row[c] ?? null)).join('\u0001');
}

export function countDuplicateRows(ds: Dataset, keyColumns?: string[]): number {
  const cols = keyColumns && keyColumns.length > 0 ? keyColumns : ds.columns.map((c) => c.name);
  const seen = new Map<string, number>();
  let dupes = 0;
  for (const row of ds.rows) {
    const key = rowKey(row, cols);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) dupes++;
  }
  return dupes;
}

export function profileColumn(ds: Dataset, name: string, type: ColumnType): ColumnProfile {
  const values = columnValues(ds, name);
  const total = values.length;
  const missing = values.filter(isMissing);
  const present = values.filter((v) => !isMissing(v));
  const uniqueSet = new Set(present.map((v) => String(v)));

  let min: number | string | undefined;
  let max: number | string | undefined;
  if (type === 'integer' || type === 'decimal') {
    const nums = present.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    if (nums.length > 0) {
      min = Math.min(...nums);
      max = Math.max(...nums);
    }
  } else if (type === 'date') {
    const dates = present.map((v) => String(v)).sort();
    if (dates.length > 0) {
      min = dates[0];
      max = dates[dates.length - 1];
    }
  }

  const missingPct = total > 0 ? missing.length / total : 0;
  const constantPenalty = present.length > 0 && uniqueSet.size === 1 ? 0.15 : 0;
  const quality = Math.max(0, 1 - missingPct * 0.8 - constantPenalty);

  return {
    name,
    type,
    missingCount: missing.length,
    missingPct,
    uniqueCount: uniqueSet.size,
    examples: present.slice(0, 3),
    min,
    max,
    quality,
  };
}

export function profileDataset(ds: Dataset): DatasetProfile {
  const columns = ds.columns.map((c) => profileColumn(ds, c.name, c.type));
  const totalCells = ds.rows.length * ds.columns.length;
  const missingCells = columns.reduce((sum, c) => sum + c.missingCount, 0);
  return {
    rowCount: ds.rows.length,
    columnCount: ds.columns.length,
    missingCellPct: totalCells > 0 ? missingCells / totalCells : 0,
    duplicateRowCount: countDuplicateRows(ds),
    columns,
  };
}

/** Columns worth flagging as "you might want to drop these". */
export function suggestUnnecessaryColumns(ds: Dataset): { name: string; reason: string }[] {
  const suggestions: { name: string; reason: string }[] = [];
  for (const col of ds.columns) {
    const p = profileColumn(ds, col.name, col.type);
    if (p.missingPct === 1) suggestions.push({ name: col.name, reason: 'entirely empty' });
    else if (p.uniqueCount <= 1 && p.missingPct < 1) suggestions.push({ name: col.name, reason: 'constant value' });
    else if (p.missingPct >= 0.9) suggestions.push({ name: col.name, reason: `${Math.round(p.missingPct * 100)}% missing` });
    else if (/^unnamed/i.test(col.name)) suggestions.push({ name: col.name, reason: 'looks like an index artifact' });
  }
  return suggestions;
}
