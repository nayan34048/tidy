import { useState } from 'react';
import type { Dataset, HistoryEntry } from '../types/dataset';
import type { ExportFormat } from '../lib/exportData';
import { buildMarkdownReport, downloadTextFile, exportDataset } from '../lib/exportData';
import { Alert, Button, Field, Section, selectClass } from '../components/ui';
import { historyLabels } from '../hooks/useDatasetStore';

interface ExportProps {
  dataset: Dataset;
  original: Dataset;
  history: HistoryEntry[];
}

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'csv', label: 'CSV' },
  { id: 'xlsx', label: 'Excel (XLSX)' },
  { id: 'json', label: 'JSON' },
  { id: 'tsv', label: 'TSV' },
  { id: 'txt', label: 'TXT' },
  { id: 'markdown', label: 'Markdown table' },
];

export function Export({ dataset, original, history }: ExportProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<'cleaned' | 'original'>('cleaned');

  const active = scope === 'cleaned' ? dataset : original;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Export dataset">
        <Field label="Export">
          <select className={selectClass} value={scope} onChange={(e) => setScope(e.target.value as 'cleaned' | 'original')}>
            <option value="cleaned">Cleaned dataset ({dataset.rows.length} rows)</option>
            <option value="original">Original dataset ({original.rows.length} rows)</option>
          </select>
        </Field>
        <Field label="Format">
          <select className={selectClass} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </Field>
        <Button variant="primary" onClick={() => exportDataset(active, format, dataset.meta.name)}>
          Download {FORMATS.find((f) => f.id === format)?.label}
        </Button>
        <Alert tone="good" title="Your data stays in your browser">
          Export happens entirely on your device — nothing is uploaded to a server. Parquet export isn't available yet
          in the browser build; use CSV or XLSX for now.
        </Alert>
      </Section>

      <Section title="Cleaning report" description="A readable summary of every step applied to this dataset.">
        <Button
          onClick={() =>
            downloadTextFile(buildMarkdownReport(original, dataset, historyLabels(history)), `${dataset.meta.name}_report.md`, 'text/markdown')
          }
        >
          Download Markdown report
        </Button>
      </Section>
    </div>
  );
}
