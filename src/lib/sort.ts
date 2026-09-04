import type { Dataset, Row } from '../types/dataset';
import { isMissing } from '../types/dataset';
import type { OpResult } from './clean';

export interface SortKey {
  column: string;
  direction: 'asc' | 'desc';
}

function compareValues(a: Row, b: Row, key: SortKey): number {
  const av = a[key.column];
  const bv = b[key.column];
  const aMissing = isMissing(av);
  const bMissing = isMissing(bv);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing values sort last regardless of direction
  if (bMissing) return -1;

  let cmp = 0;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  return key.direction === 'asc' ? cmp : -cmp;
}

export function sortRows(ds: Dataset, keys: SortKey[]): OpResult {
  if (keys.length === 0) return { dataset: ds, label: 'No sort applied', code: '# no-op' };
  const rows = [...ds.rows].sort((a, b) => {
    for (const key of keys) {
      const cmp = compareValues(a, b, key);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  const byArg = keys.map((k) => `"${k.column}"`).join(', ');
  const ascArg = keys.map((k) => (k.direction === 'asc' ? 'True' : 'False')).join(', ');
  return {
    dataset: { ...ds, rows },
    label: `Sorted by ${keys.map((k) => `${k.column} (${k.direction})`).join(', ')}`,
    code: `df = df.sort_values(by=[${byArg}], ascending=[${ascArg}]).reset_index(drop=True)`,
  };
}
