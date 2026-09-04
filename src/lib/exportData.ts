import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Dataset, Row } from '../types/dataset';

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'tsv' | 'txt' | 'markdown';

function rowsToRecords(ds: Dataset): Record<string, unknown>[] {
  const cols = ds.columns.map((c) => c.name);
  return ds.rows.map((r) => {
    const out: Record<string, unknown> = {};
    cols.forEach((c) => {
      out[c] = r[c] ?? '';
    });
    return out;
  });
}

function toDelimited(ds: Dataset, delimiter: string): string {
  return Papa.unparse(rowsToRecords(ds), { delimiter });
}

function toMarkdownTable(ds: Dataset, rows: Row[]): string {
  const cols = ds.columns.map((c) => c.name);
  const isNumeric = ds.columns.map((c) => c.type === 'integer' || c.type === 'decimal');
  const header = `| ${cols.join(' | ')} |`;
  const divider = `|${cols.map((_, i) => (isNumeric[i] ? '---:' : '---')).join('|')}|`;
  const body = rows
    .map((r) => `| ${cols.map((c) => String(r[c] ?? '')).join(' | ')} |`)
    .join('\n');
  return [header, divider, body].join('\n');
}

export function buildMarkdownReport(
  original: Dataset,
  cleaned: Dataset,
  historyLabels: string[]
): string {
  const lines = [
    '# Data Cleaning Report',
    '',
    '## Dataset',
    '',
    `- Original rows: ${original.rows.length}`,
    `- Original columns: ${original.columns.length}`,
    '',
    '## Cleaning performed',
    '',
    ...(historyLabels.length > 0 ? historyLabels.map((l) => `- ${l}`) : ['- No cleaning steps applied']),
    '',
    '## Final dataset',
    '',
    `- Rows: ${cleaned.rows.length}`,
    `- Columns: ${cleaned.columns.length}`,
    '',
    '## Preview',
    '',
    toMarkdownTable(cleaned, cleaned.rows.slice(0, 10)),
    '',
  ];
  return lines.join('\n');
}

function triggerDownload(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportDataset(ds: Dataset, format: ExportFormat, baseName: string) {
  switch (format) {
    case 'csv':
      triggerDownload(toDelimited(ds, ','), `${baseName}.csv`, 'text/csv');
      break;
    case 'tsv':
      triggerDownload(toDelimited(ds, '\t'), `${baseName}.tsv`, 'text/tab-separated-values');
      break;
    case 'txt':
      triggerDownload(toDelimited(ds, ','), `${baseName}.txt`, 'text/plain');
      break;
    case 'json':
      triggerDownload(JSON.stringify(rowsToRecords(ds), null, 2), `${baseName}.json`, 'application/json');
      break;
    case 'markdown':
      triggerDownload(toMarkdownTable(ds, ds.rows), `${baseName}.md`, 'text/markdown');
      break;
    case 'xlsx': {
      const ws = XLSX.utils.json_to_sheet(rowsToRecords(ds));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      triggerDownload(buf, `${baseName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      break;
    }
  }
}

export function downloadTextFile(content: string, filename: string, mime = 'text/plain') {
  triggerDownload(content, filename, mime);
}
