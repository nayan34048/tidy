import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types/dataset';
import { sortRows } from '../sort';

const ds: Dataset = {
  meta: { name: 't', importedAt: 0 },
  columns: [
    { name: 'name', type: 'string', inferred: true },
    { name: 'score', type: 'decimal', inferred: true },
  ],
  rows: [
    { name: 'Karim', score: 3.5 },
    { name: 'Rahim', score: 3.9 },
    { name: 'Hasan', score: null },
    { name: 'Ayesha', score: 3.9 },
  ],
};

describe('sortRows', () => {
  it('sorts ascending by a numeric column, missing values last', () => {
    const { dataset } = sortRows(ds, [{ column: 'score', direction: 'asc' }]);
    expect(dataset.rows.map((r) => r.name)).toEqual(['Karim', 'Rahim', 'Ayesha', 'Hasan']);
  });

  it('supports multi-column sort', () => {
    const { dataset } = sortRows(ds, [
      { column: 'score', direction: 'desc' },
      { column: 'name', direction: 'asc' },
    ]);
    expect(dataset.rows.map((r) => r.name)).toEqual(['Ayesha', 'Rahim', 'Karim', 'Hasan']);
  });
});
