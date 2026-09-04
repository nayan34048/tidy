import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types/dataset';
import { appendDatasets, computeMergePreview, performJoin } from '../merge';

const left: Dataset = {
  meta: { name: 'left', importedAt: 0 },
  columns: [
    { name: 'id', type: 'integer', inferred: true },
    { name: 'name', type: 'string', inferred: true },
  ],
  rows: [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
  ],
};

const right: Dataset = {
  meta: { name: 'right', importedAt: 0 },
  columns: [
    { name: 'id', type: 'integer', inferred: true },
    { name: 'score', type: 'integer', inferred: true },
  ],
  rows: [
    { id: 1, score: 90 },
    { id: 2, score: 80 },
    { id: 4, score: 70 },
  ],
};

describe('performJoin', () => {
  it('inner join keeps only matching rows', () => {
    const result = performJoin(left, right, [{ left: 'id', right: 'id' }], 'inner');
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it('left join keeps every left row, filling unmatched with null', () => {
    const result = performJoin(left, right, [{ left: 'id', right: 'id' }], 'left');
    expect(result.rows).toHaveLength(3);
    const unmatched = result.rows.find((r) => r.id === 3);
    expect(unmatched?.score).toBeNull();
  });

  it('full join keeps all rows from both sides', () => {
    const result = performJoin(left, right, [{ left: 'id', right: 'id' }], 'full');
    expect(result.rows).toHaveLength(4); // 1,2 matched + 3 (left-only) + 4 (right-only)
    expect(result.rows.some((r) => r.id === 4)).toBe(true);
  });
});

describe('computeMergePreview', () => {
  it('flags duplicate keys', () => {
    const dupLeft: Dataset = { ...left, rows: [...left.rows, { id: 1, name: 'A2' }] };
    const preview = computeMergePreview(dupLeft, right, [{ left: 'id', right: 'id' }], 'inner');
    expect(preview.duplicateKeysLeft).toBe(1);
    expect(preview.warnings.length).toBeGreaterThan(0);
  });

  it('reports unmatched counts for an inner join', () => {
    const preview = computeMergePreview(left, right, [{ left: 'id', right: 'id' }], 'inner');
    expect(preview.onlyInLeft).toBe(1); // id 3
    expect(preview.onlyInRight).toBe(1); // id 4
    expect(preview.matchingKeys).toBe(2);
  });
});

describe('appendDatasets', () => {
  it('concatenates rows and fills missing columns with null', () => {
    const a: Dataset = { meta: { name: 'a', importedAt: 0 }, columns: [{ name: 'x', type: 'integer', inferred: true }], rows: [{ x: 1 }] };
    const b: Dataset = { meta: { name: 'b', importedAt: 0 }, columns: [{ name: 'y', type: 'integer', inferred: true }], rows: [{ y: 2 }] };
    const { dataset } = appendDatasets([a, b], 'combined');
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0].y).toBeNull();
    expect(dataset.rows[1].x).toBeNull();
  });
});
