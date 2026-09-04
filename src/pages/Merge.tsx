import { useMemo, useState } from 'react';
import type { Dataset } from '../types/dataset';
import type { OpResult } from '../lib/clean';
import type { JoinKeyPair, JoinType } from '../lib/merge';
import { appendDatasets, computeAppendPreview, computeMergePreview, joinToOpResult } from '../lib/merge';
import { parseFile, ParseError } from '../lib/parse';
import { Alert, Badge, Button, EmptyState, Field, Section, selectClass } from '../components/ui';
import { UploadZone } from '../components/UploadZone';
import { formatNumber } from '../utils/format';
import { sampleResults } from '../data/samples';

interface MergeProps {
  dataset: Dataset;
  onApply: (result: OpResult) => void;
}

const JOIN_EXPLANATIONS: Record<JoinType, string> = {
  inner: 'Keeps only rows whose key exists in both datasets.',
  left: 'Keeps every row from Dataset A, filling in Dataset B\'s columns where a match exists.',
  right: 'Keeps every row from Dataset B, filling in Dataset A\'s columns where a match exists.',
  full: 'Keeps every row from both datasets, matching where possible.',
};

export function Merge({ dataset, onApply }: MergeProps) {
  const [mode, setMode] = useState<'join' | 'append'>('join');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <Button variant={mode === 'join' ? 'primary' : 'secondary'} onClick={() => setMode('join')}>
          Join
        </Button>
        <Button variant={mode === 'append' ? 'primary' : 'secondary'} onClick={() => setMode('append')}>
          Append / concatenate
        </Button>
      </div>
      {mode === 'join' ? <JoinPanel dataset={dataset} onApply={onApply} /> : <AppendPanel dataset={dataset} onApply={onApply} />}
    </div>
  );
}

function JoinPanel({ dataset, onApply }: MergeProps) {
  const [datasetB, setDatasetB] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<JoinKeyPair[]>([]);
  const [joinType, setJoinType] = useState<JoinType>('inner');

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const ds = await parseFile(file);
      setDatasetB(ds);
      const guess = ds.columns.find((c) => dataset.columns.some((a) => a.name === c.name));
      setPairs(guess ? [{ left: guess.name, right: guess.name }] : [{ left: dataset.columns[0]?.name ?? '', right: ds.columns[0]?.name ?? '' }]);
    } catch (e) {
      setError(e instanceof ParseError ? e.message : `Something went wrong reading "${file.name}".`);
    }
  };

  const preview = useMemo(
    () => (datasetB && pairs.every((p) => p.left && p.right) ? computeMergePreview(dataset, datasetB, pairs, joinType) : null),
    [dataset, datasetB, pairs, joinType]
  );

  if (!datasetB) {
    return (
      <Section title="Load Dataset B" description="Choose a second dataset to merge into your current one (Dataset A).">
        <UploadZone onFile={handleFile} onSample={() => setDatasetB({ ...sampleResults, meta: { ...sampleResults.meta, importedAt: Date.now() } })} />
        {error && <Alert tone="bad" title="Couldn't read that file">{error}</Alert>}
      </Section>
    );
  }

  return (
    <>
      <Section title="Matching columns">
        <div className="flex flex-wrap gap-4 text-sm text-ink-500">
          <span>
            Dataset A: <strong className="text-ink-800 dark:text-ink-100">{dataset.meta.name}</strong> ({formatNumber(dataset.rows.length)} rows)
          </span>
          <span>
            Dataset B: <strong className="text-ink-800 dark:text-ink-100">{datasetB.meta.name}</strong> ({formatNumber(datasetB.rows.length)} rows)
          </span>
          <button className="text-clay-600 underline" onClick={() => setDatasetB(null)}>
            Change Dataset B
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {pairs.map((pair, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className={selectClass} value={pair.left} onChange={(e) => setPairs((ps) => ps.map((p, idx) => (idx === i ? { ...p, left: e.target.value } : p)))}>
                {dataset.columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <span className="text-ink-400">=</span>
              <select className={selectClass} value={pair.right} onChange={(e) => setPairs((ps) => ps.map((p, idx) => (idx === i ? { ...p, right: e.target.value } : p)))}>
                {datasetB.columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              {pairs.length > 1 && (
                <Button variant="ghost" size="sm" aria-label="Remove key" onClick={() => setPairs((ps) => ps.filter((_, idx) => idx !== i))}>
                  ✕
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setPairs((ps) => [...ps, { left: dataset.columns[0]?.name ?? '', right: datasetB.columns[0]?.name ?? '' }])}
          >
            + Add matching column
          </Button>
        </div>

        <Field label="Join type">
          <select className={selectClass} value={joinType} onChange={(e) => setJoinType(e.target.value as JoinType)}>
            <option value="inner">Inner join</option>
            <option value="left">Left join</option>
            <option value="right">Right join</option>
            <option value="full">Full / outer join</option>
          </select>
        </Field>
        <p className="text-xs text-ink-400">{JOIN_EXPLANATIONS[joinType]}</p>
      </Section>

      {preview && (
        <Section title="Merge preview">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PreviewStat label="Dataset A rows" value={preview.leftRowCount} />
            <PreviewStat label="Dataset B rows" value={preview.rightRowCount} />
            <PreviewStat label="Matching keys" value={preview.matchingKeys} />
            <PreviewStat label="Only in A" value={preview.onlyInLeft} />
            <PreviewStat label="Only in B" value={preview.onlyInRight} />
            <PreviewStat label="Estimated result rows" value={preview.resultingRowsEstimate} />
            <PreviewStat label="Duplicate keys in A" value={preview.duplicateKeysLeft} />
            <PreviewStat label="Duplicate keys in B" value={preview.duplicateKeysRight} />
          </div>
          {preview.warnings.map((w, i) => (
            <Alert key={i} tone="warn" title="Heads up">
              {w}
            </Alert>
          ))}
          <Button variant="primary" onClick={() => onApply(joinToOpResult(dataset, datasetB, pairs, joinType))}>
            Run merge
          </Button>
        </Section>
      )}
    </>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-ink-200 px-3 py-2 dark:border-ink-800">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="font-display text-lg text-ink-900 dark:text-ink-50">{formatNumber(value)}</p>
    </div>
  );
}

function AppendPanel({ dataset, onApply }: MergeProps) {
  const [extra, setExtra] = useState<Dataset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const ds = await parseFile(file);
      setExtra((prev) => [...prev, ds]);
    } catch (e) {
      setError(e instanceof ParseError ? e.message : `Something went wrong reading "${file.name}".`);
    }
  };

  const all = [dataset, ...extra];
  const preview = useMemo(() => computeAppendPreview(all), [all]);

  return (
    <>
      <Section title="Append datasets" description="Stack files vertically — useful for combining monthly exports into one table.">
        <div className="flex flex-wrap gap-2">
          <Badge>{dataset.meta.name} ({formatNumber(dataset.rows.length)} rows)</Badge>
          {extra.map((d, i) => (
            <Badge key={i}>{d.meta.name} ({formatNumber(d.rows.length)} rows)</Badge>
          ))}
        </div>
        <UploadZone onFile={handleFile} onSample={() => setExtra((prev) => [...prev, { ...sampleResults, meta: { name: 'february_sample', importedAt: Date.now() } }])} />
        {error && <Alert tone="bad" title="Couldn't read that file">{error}</Alert>}
      </Section>

      {extra.length === 0 ? (
        <EmptyState title="Nothing to append yet" description="Add at least one more file above to combine it with your current dataset." />
      ) : (
        <Section title="Append preview">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PreviewStat label="Total rows" value={preview.totalRows} />
            <PreviewStat label="Shared columns" value={preview.commonColumns.length} />
            <PreviewStat label="Only in dataset A" value={preview.onlyInFirst.length} />
          </div>
          {(preview.onlyInFirst.length > 0 || preview.onlyInSecond.length > 0) && (
            <Alert tone="warn" title="Columns that don't line up">
              Missing columns will be filled with null. Only in A: {preview.onlyInFirst.join(', ') || 'none'}. Only in others:{' '}
              {preview.onlyInSecond.join(', ') || 'none'}.
            </Alert>
          )}
          <Button variant="primary" onClick={() => onApply(appendDatasets(all, dataset.meta.name))}>
            Append all
          </Button>
        </Section>
      )}
    </>
  );
}
