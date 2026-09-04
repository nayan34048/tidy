import { useMemo, useState } from 'react';
import type { Dataset, HistoryEntry } from '../types/dataset';
import type { ValidationRule, ValidationRuleType } from '../lib/validate';
import { runValidation } from '../lib/validate';
import { computeQualityScore } from '../lib/quality';
import { generatePandasScript } from '../lib/codegen';
import { downloadTextFile } from '../lib/exportData';
import { Alert, Badge, Button, ProgressBar, Section, selectClass } from '../components/ui';
import { formatNumber, formatPercent } from '../utils/format';
import { uid } from '../utils/id';

interface ValidateProps {
  dataset: Dataset;
  history: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onClearHistory: () => void;
}

const RULE_LABELS: Record<ValidationRuleType, string> = {
  range: 'Must be between min and max',
  non_negative: 'Cannot be negative',
  unique: 'Must be unique',
  email: 'Must be a valid email',
  not_future_date: 'Cannot be in the future',
  not_null: 'Cannot be missing',
  regex: 'Must match pattern',
};

export function Validate({ dataset, history, canUndo, canRedo, onUndo, onRedo, onReset, onClearHistory }: ValidateProps) {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [invalidPreviewRuleId, setInvalidPreviewRuleId] = useState<string | null>(null);

  const report = useMemo(() => runValidation(dataset, rules), [dataset, rules]);
  const quality = useMemo(() => computeQualityScore(dataset), [dataset]);

  const addRule = () => {
    const firstCol = dataset.columns[0]?.name ?? '';
    setRules((rs) => [...rs, { id: uid('rule'), column: firstCol, type: 'not_null', label: 'New rule' }]);
  };

  const updateRule = (id: string, patch: Partial<ValidationRule>) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="flex flex-col gap-5">
      <Section title="Data quality">
        <div className="flex items-center justify-between">
          <ProgressBar value={quality.score} tone={quality.score >= 70 ? 'moss' : 'clay'} />
          <span className="ml-3 whitespace-nowrap font-mono text-sm text-ink-500">{quality.score}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-ink-500 sm:grid-cols-4">
          <span>Missing values: {formatPercent(quality.missingPct)}</span>
          <span>Duplicates: {formatPercent(quality.duplicatePct)}</span>
          <span>Invalid values: {formatPercent(quality.invalidPct)}</span>
          <span>Type issues: {formatPercent(quality.typeIssuePct)}</span>
        </div>
        <p className="text-xs text-ink-400">This is a heuristic score, not a statistical guarantee.</p>
      </Section>

      <Section title="Validation rules">
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-2">
              <select className={selectClass} value={rule.column} onChange={(e) => updateRule(rule.id, { column: e.target.value })}>
                {dataset.columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <select className={selectClass} value={rule.type} onChange={(e) => updateRule(rule.id, { type: e.target.value as ValidationRuleType })}>
                {Object.entries(RULE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              {rule.type === 'range' && (
                <>
                  <input type="number" placeholder="min" className={`${selectClass} w-20`} value={rule.min ?? ''} onChange={(e) => updateRule(rule.id, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <input type="number" placeholder="max" className={`${selectClass} w-20`} value={rule.max ?? ''} onChange={(e) => updateRule(rule.id, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </>
              )}
              {rule.type === 'regex' && (
                <input placeholder="pattern" className={`${selectClass} w-40`} value={rule.pattern ?? ''} onChange={(e) => updateRule(rule.id, { pattern: e.target.value })} />
              )}
              <Button variant="ghost" size="sm" aria-label="Remove rule" onClick={() => setRules((rs) => rs.filter((r) => r.id !== rule.id))}>
                ✕
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="self-start" onClick={addRule}>
            + Add rule
          </Button>
        </div>

        {rules.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={report.rowsWithIssues === 0 ? 'good' : 'warn'}>
              ✓ {formatNumber(report.validRows)} valid rows
            </Badge>
            {report.rowsWithIssues > 0 && <Badge tone="bad">⚠ {formatNumber(report.rowsWithIssues)} rows require attention</Badge>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {report.results.map((r) => (
            <div key={r.rule.id} className="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 text-sm dark:border-ink-800">
              <span>
                <strong>{r.rule.column}</strong> — {RULE_LABELS[r.rule.type]}
              </span>
              <button
                className="text-clay-600 underline disabled:no-underline disabled:text-ink-300"
                disabled={r.invalidCount === 0}
                onClick={() => setInvalidPreviewRuleId(invalidPreviewRuleId === r.rule.id ? null : r.rule.id)}
              >
                {r.invalidCount} invalid
              </button>
            </div>
          ))}
        </div>

        {report.results.map((r) =>
          r.rule.id === invalidPreviewRuleId ? (
            <Alert key={r.rule.id} tone="bad" title={`Invalid rows for "${r.rule.column}"`}>
              Row indices: {r.invalidRowIndices.slice(0, 30).join(', ')}
              {r.invalidRowIndices.length > 30 ? '…' : ''}
            </Alert>
          ) : null
        )}
      </Section>

      <Section title="Cleaning history">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onUndo} disabled={!canUndo}>
            Undo
          </Button>
          <Button size="sm" onClick={onRedo} disabled={!canRedo}>
            Redo
          </Button>
          <Button size="sm" onClick={onReset} disabled={!canUndo}>
            Reset to original
          </Button>
          <Button size="sm" variant="ghost" onClick={onClearHistory} disabled={history.length === 0}>
            Clear history
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-ink-400">No cleaning steps recorded yet.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {history.map((h, i) => (
              <li key={h.id} className="flex gap-2 text-ink-600 dark:text-ink-300">
                <span className="text-ink-400">{i + 1}.</span> {h.label}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Generate code" description="Export the exact cleaning steps you performed as a reusable Python script.">
        <Button
          variant="primary"
          onClick={() => downloadTextFile(generatePandasScript(dataset.meta.sourceFileName, history), 'tidy_cleaning_script.py', 'text/x-python')}
        >
          Download pandas script
        </Button>
      </Section>
    </div>
  );
}
