import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../types/dataset';
import { buildMarkdownReport } from '../exportData';

const original: Dataset = {
  meta: { name: 'students', importedAt: 0 },
  columns: [
    { name: 'SL', type: 'integer', inferred: true },
    { name: 'Name', type: 'string', inferred: true },
  ],
  rows: [
    { SL: 101, Name: 'Rahim' },
    { SL: 102, Name: 'Karim' },
  ],
};

const cleaned: Dataset = {
  ...original,
  rows: [{ SL: 101, Name: 'Rahim' }],
};

describe('buildMarkdownReport', () => {
  it('includes row and column counts for both original and cleaned datasets', () => {
    const report = buildMarkdownReport(original, cleaned, ['Removed 1 duplicate row']);
    expect(report).toContain('Original rows: 2');
    expect(report).toContain('Rows: 1');
    expect(report).toContain('Removed 1 duplicate row');
  });

  it('renders a markdown table with a header and divider row', () => {
    const report = buildMarkdownReport(original, cleaned, []);
    expect(report).toContain('| SL | Name |');
    expect(report).toContain('|---:|---|');
  });

  it('notes when no cleaning steps were applied', () => {
    const report = buildMarkdownReport(original, original, []);
    expect(report).toContain('No cleaning steps applied');
  });
});
