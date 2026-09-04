import { useMemo, useState } from 'react';
import type { Dataset } from '../types/dataset';
import type { OpResult, FillStrategy } from '../lib/clean';
import {
  countAffectedByFill,
  fillMissing,
  removeColumns,
  removeConstantColumns,
  removeDuplicateColumns,
  removeDuplicateRows,
  removeEmptyColumns,
  removeEmptyRows,
  removeColumnsByMissingThreshold,
  removeRowsWithMissing,
} from '../lib/clean';
import { countDuplicateRows, suggestUnnecessaryColumns } from '../lib/profile';
import { Alert, Badge, Button, ConfirmDialog, Field, Section, inputClass, selectClass } from '../components/ui';
import { formatNumber } from '../utils/format';

interface CleanProps {
  dataset: Dataset;
  onApply: (result: OpResult) => void;
}

export function Clean({ dataset, onApply }: CleanProps) {
  const [pendingOp, setPendingOp] = useState<{ label: string; description: string; run: () => OpResult } | null>(null);

  const confirmAndApply = (label: string, description: string, run: () => OpResult) => {
    setPendingOp({ label, description, run });
  };

  return (
    <div className="flex flex-col gap-5">
      <RowRemovalPanel dataset={dataset} onConfirm={confirmAndApply} />
      <ColumnRemovalPanel dataset={dataset} onConfirm={confirmAndApply} />
      <MissingValuesPanel dataset={dataset} onApply={onApply} />
      <DuplicateRowsPanel dataset={dataset} onConfirm={confirmAndApply} />

      <ConfirmDialog
        open={!!pendingOp}
        title={pendingOp?.label ?? ''}
        description={pendingOp?.description ?? ''}
        confirmLabel="Apply"
        destructive
        onCancel={() => setPendingOp(null)}
        onConfirm={() => {
          if (pendingOp) onApply(pendingOp.run());
          setPendingOp(null);
        }}
      />
    </div>
  );
}

function RowRemovalPanel({
  dataset,
  onConfirm,
}: {
  dataset: Dataset;
  onConfirm: (label: string, description: string, run: () => OpResult) => void;
}) {
  return (
    <Section title="Remove rows">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            onConfirm('Remove empty rows', 'Rows where every column is missing will be removed.', () => removeEmptyRows(dataset))
          }
        >
          Remove empty rows
        </Button>
        <Button
          onClick={() =>
            onConfirm(
              'Remove rows with any missing values',
              'Any row containing at least one missing value will be removed.',
              () => removeRowsWithMissing(dataset, null)
            )
          }
        >
          Remove rows with missing values
        </Button>
      </div>
    </Section>
  );
}

function ColumnRemovalPanel({
  dataset,
  onConfirm,
}: {
  dataset: Dataset;
  onConfirm: (label: string, description: string, run: () => OpResult) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(80);
  const suggestions = useMemo(() => suggestUnnecessaryColumns(dataset), [dataset]);

  return (
    <Section title="Remove columns">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Select columns to remove">
          <select
            multiple
            className={`${selectClass} h-24 w-56`}
            value={selected}
            onChange={(e) => setSelected(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {dataset.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Button
          disabled={selected.length === 0}
          onClick={() =>
            onConfirm('Remove selected columns', `${selected.join(', ')} will be permanently removed.`, () =>
              removeColumns(dataset, selected)
            )
          }
        >
          Remove selected
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onConfirm('Remove empty columns', 'Columns that are entirely missing will be removed.', () => removeEmptyColumns(dataset))}>
          Remove empty columns
        </Button>
        <Button onClick={() => onConfirm('Remove constant columns', 'Columns with only one distinct value will be removed.', () => removeConstantColumns(dataset))}>
          Remove constant columns
        </Button>
        <Button onClick={() => onConfirm('Remove duplicate columns', 'Columns that are exact duplicates of another column will be removed.', () => removeDuplicateColumns(dataset))}>
          Remove duplicate columns
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={`Remove columns with ≥ ${threshold}% missing`}>
          <input type="range" min={50} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-48" />
        </Field>
        <Button
          onClick={() =>
            onConfirm(
              'Remove columns by missing threshold',
              `Columns with ${threshold}% or more missing values will be removed.`,
              () => removeColumnsByMissingThreshold(dataset, threshold / 100)
            )
          }
        >
          Apply
        </Button>
      </div>

      {suggestions.length > 0 && (
        <Alert tone="warn" title="Suggested for removal">
          {suggestions.map((s) => `${s.name} (${s.reason})`).join(' · ')}
        </Alert>
      )}
    </Section>
  );
}

function MissingValuesPanel({ dataset, onApply }: { dataset: Dataset; onApply: (result: OpResult) => void }) {
  const [column, setColumn] = useState(dataset.columns[0]?.name ?? '');
  const [strategy, setStrategy] = useState<FillStrategy>('mean');
  const [customValue, setCustomValue] = useState('');
  const affected = column ? countAffectedByFill(dataset, column) : 0;

  return (
    <Section title="Missing values">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Column">
          <select className={selectClass} value={column} onChange={(e) => setColumn(e.target.value)}>
            {dataset.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fill with">
          <select className={selectClass} value={strategy} onChange={(e) => setStrategy(e.target.value as FillStrategy)}>
            <option value="mean">Mean</option>
            <option value="median">Median</option>
            <option value="mode">Mode</option>
            <option value="zero">Zero</option>
            <option value="custom">Custom value</option>
            <option value="previous">Previous value</option>
            <option value="next">Next value</option>
          </select>
        </Field>
        {strategy === 'custom' && (
          <Field label="Value">
            <input className={inputClass} value={customValue} onChange={(e) => setCustomValue(e.target.value)} />
          </Field>
        )}
        <Button variant="primary" disabled={!column} onClick={() => onApply(fillMissing(dataset, column, strategy, customValue))}>
          Fill
        </Button>
      </div>
      <p className="text-xs text-ink-400">
        {formatNumber(affected)} cell{affected === 1 ? '' : 's'} in "{column}" {affected === 1 ? 'is' : 'are'} currently missing.
      </p>
    </Section>
  );
}

function DuplicateRowsPanel({
  dataset,
  onConfirm,
}: {
  dataset: Dataset;
  onConfirm: (label: string, description: string, run: () => OpResult) => void;
}) {
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [keep, setKeep] = useState<'first' | 'last'>('first');
  const dupCount = useMemo(() => countDuplicateRows(dataset, keyColumns.length ? keyColumns : undefined), [dataset, keyColumns]);

  return (
    <Section title="Duplicate detection">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={dupCount > 0 ? 'warn' : 'good'}>
          {formatNumber(dupCount)} duplicate row{dupCount === 1 ? '' : 's'} found
        </Badge>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Duplicate based on (optional)">
          <select
            multiple
            className={`${selectClass} h-20 w-56`}
            value={keyColumns}
            onChange={(e) => setKeyColumns(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {dataset.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Keep">
          <select className={selectClass} value={keep} onChange={(e) => setKeep(e.target.value as 'first' | 'last')}>
            <option value="first">First occurrence</option>
            <option value="last">Last occurrence</option>
          </select>
        </Field>
        <Button
          variant="primary"
          disabled={dupCount === 0}
          onClick={() =>
            onConfirm(
              'Remove duplicate rows',
              `${dupCount} duplicate row(s) will be removed, keeping the ${keep} occurrence.`,
              () => removeDuplicateRows(dataset, keyColumns.length ? keyColumns : null, keep)
            )
          }
        >
          Remove duplicates
        </Button>
      </div>
    </Section>
  );
}
