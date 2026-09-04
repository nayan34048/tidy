import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types/dataset';
import {
  convertColumnType,
  fillMissing,
  removeDuplicateRows,
  removeRowsWithMissing,
} from '../clean';
import { countDuplicateRows } from '../profile';
import { filterRows } from '../clean';

function makeDataset(): Dataset {
  return {
    meta: { name: 'test', importedAt: 0 },
    columns: [
      { name: 'id', type: 'integer', inferred: true },
      { name: 'age', type: 'string', inferred: true },
      { name: 'city', type: 'string', inferred: true },
    ],
    rows: [
      { id: 1, age: '20', city: 'Dhaka' },
      { id: 2, age: null, city: 'Dhaka' },
      { id: 3, age: '25', city: null },
      { id: 3, age: '25', city: null },
    ],
  };
}

describe('removeRowsWithMissing', () => {
  it('removes rows with any missing value when no columns specified', () => {
    const ds = makeDataset();
    const { dataset } = removeRowsWithMissing(ds, null);
    expect(dataset.rows).toHaveLength(1);
    expect(dataset.rows[0].id).toBe(1);
  });

  it('only checks specified columns', () => {
    const ds = makeDataset();
    const { dataset } = removeRowsWithMissing(ds, ['age']);
    expect(dataset.rows).toHaveLength(3);
  });
});

describe('fillMissing', () => {
  it('fills missing numeric values with zero', () => {
    const ds = makeDataset();
    const { dataset } = fillMissing(ds, 'city', 'custom', 'Unknown');
    expect(dataset.rows[2].city).toBe('Unknown');
    expect(dataset.rows[3].city).toBe('Unknown');
  });

  it('reports how many cells were filled', () => {
    const ds = makeDataset();
    const { label } = fillMissing(ds, 'city', 'custom', 'Unknown');
    expect(label).toContain('2');
  });
});

describe('duplicate detection', () => {
  it('counts duplicate rows', () => {
    const ds = makeDataset();
    expect(countDuplicateRows(ds)).toBe(1);
  });

  it('removes duplicates keeping first occurrence', () => {
    const ds = makeDataset();
    const { dataset } = removeDuplicateRows(ds, null, 'first');
    expect(dataset.rows).toHaveLength(3);
  });

  it('supports subset-based duplicate detection', () => {
    const ds = makeDataset();
    expect(countDuplicateRows(ds, ['city'])).toBeGreaterThan(0);
  });
});

describe('type conversion', () => {
  it('converts a string column to integer and flags invalid values', () => {
    const ds: Dataset = {
      meta: { name: 't', importedAt: 0 },
      columns: [{ name: 'n', type: 'string', inferred: true }],
      rows: [{ n: '5' }, { n: 'not a number' }, { n: '10' }],
    };
    const { result, invalidCount } = convertColumnType(ds, 'n', 'integer');
    expect(invalidCount).toBe(1);
    expect(result.dataset.rows[0].n).toBe(5);
    expect(result.dataset.rows[1].n).toBe('not a number'); // left unchanged, not destroyed
  });
});

describe('filterRows', () => {
  it('keeps only rows matching a single rule', () => {
    const ds = makeDataset();
    const { dataset } = filterRows(ds, [{ column: 'city', op: 'eq', value: 'Dhaka' }], 'AND');
    expect(dataset.rows).toHaveLength(2);
  });

  it('combines multiple rules with OR', () => {
    const ds = makeDataset();
    const { dataset } = filterRows(
      ds,
      [
        { column: 'id', op: 'eq', value: '1' },
        { column: 'id', op: 'eq', value: '3' },
      ],
      'OR'
    );
    expect(dataset.rows).toHaveLength(3);
  });
});
