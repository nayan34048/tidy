import { useMemo, useState } from 'react';
import type { Dataset } from '../types/dataset';
import { UploadZone } from '../components/UploadZone';
import { DataTable } from '../components/DataTable';
import { Alert, Badge, Card, ProgressBar } from '../components/ui';
import { parseFile, ParseError } from '../lib/parse';
import { profileDataset, suggestUnnecessaryColumns } from '../lib/profile';
import { computeQualityScore } from '../lib/quality';
import { formatNumber, formatPercent, truncate } from '../utils/format';
import { sampleStudents } from '../data/samples';

export function Dashboard({
  dataset,
  onLoad,
}: {
  dataset: Dataset | null;
  onLoad: (ds: Dataset) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const ds = await parseFile(file);
      onLoad(ds);
    } catch (e) {
      setError(e instanceof ParseError ? e.message : `Something went wrong reading "${file.name}".`);
    } finally {
      setLoading(false);
    }
  };

  const profile = useMemo(() => (dataset ? profileDataset(dataset) : null), [dataset]);
  const quality = useMemo(() => (dataset ? computeQualityScore(dataset) : null), [dataset]);
  const suggestions = useMemo(() => (dataset ? suggestUnnecessaryColumns(dataset) : []), [dataset]);

  if (!dataset) {
    return (
      <div className="flex flex-col gap-4">
        <UploadZone onFile={handleFile} onSample={() => onLoad({ ...sampleStudents, meta: { ...sampleStudents.meta, importedAt: Date.now() } })} />
        {loading && <Alert tone="info">Reading your file…</Alert>}
        {error && <Alert tone="bad" title="Couldn't read that file">{error}</Alert>}
        <Alert tone="good" title="Your data stays in your browser">
          Tidy processes files locally. Nothing you upload is sent to a server.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Rows" value={formatNumber(profile!.rowCount)} />
        <StatCard label="Columns" value={formatNumber(profile!.columnCount)} />
        <StatCard label="Missing cells" value={formatPercent(profile!.missingCellPct)} />
        <StatCard label="Duplicate rows" value={formatNumber(profile!.duplicateRowCount)} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base text-ink-800 dark:text-ink-100">Data quality</h3>
          <span className="font-mono text-sm text-ink-500">{quality!.score}/100</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={quality!.score} tone={quality!.score >= 70 ? 'moss' : 'clay'} />
        </div>
        <p className="mt-2 text-xs text-ink-400">
          A heuristic estimate, not a statistical guarantee — missing values, duplicates, and values that don't fit
          their column's type all count against it.
        </p>
      </Card>

      {suggestions.length > 0 && (
        <Alert tone="warn" title="Columns you might not need">
          {suggestions.map((s) => `${s.name} (${s.reason})`).join(' · ')}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-ink-200 px-4 py-3 dark:border-ink-800">
          <h3 className="font-display text-base text-ink-800 dark:text-ink-100">Column profile</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800/60">
              <tr>
                {['Column', 'Type', 'Missing', 'Unique', 'Example', 'Quality'].map((h) => (
                  <th key={h} className="border-b border-ink-200 px-3 py-2 text-left font-medium text-ink-600 dark:border-ink-700 dark:text-ink-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profile!.columns.map((c) => (
                <tr key={c.name} className="odd:bg-white even:bg-ink-50/50 dark:odd:bg-ink-900 dark:even:bg-ink-900/40">
                  <td className="border-b border-ink-100 px-3 py-2 font-medium text-ink-800 dark:border-ink-800 dark:text-ink-100">{c.name}</td>
                  <td className="border-b border-ink-100 px-3 py-2 dark:border-ink-800">
                    <Badge>{c.type}</Badge>
                  </td>
                  <td className="border-b border-ink-100 px-3 py-2 font-mono text-xs dark:border-ink-800">
                    {formatPercent(c.missingPct)} ({formatNumber(c.missingCount)})
                  </td>
                  <td className="border-b border-ink-100 px-3 py-2 font-mono text-xs dark:border-ink-800">{formatNumber(c.uniqueCount)}</td>
                  <td className="border-b border-ink-100 px-3 py-2 font-mono text-xs text-ink-500 dark:border-ink-800">
                    {truncate(c.examples.map(String).join(', '), 28) || '—'}
                  </td>
                  <td className="border-b border-ink-100 px-3 py-2 dark:border-ink-800">
                    <Badge tone={c.quality > 0.85 ? 'good' : c.quality > 0.6 ? 'warn' : 'bad'}>{Math.round(c.quality * 100)}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div>
        <h3 className="mb-2 font-display text-base text-ink-800 dark:text-ink-100">Data preview</h3>
        <DataTable dataset={dataset} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink-900 dark:text-ink-50">{value}</p>
    </Card>
  );
}
