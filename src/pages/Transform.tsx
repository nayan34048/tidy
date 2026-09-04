import { useMemo, useState } from 'react';
import type { ColumnType, Dataset } from '../types/dataset';
import type { CompareOp, DateOutputFormat, DatePart, FilterRule, OpResult } from '../lib/clean';
import {
  cleanNumbers,
  cleanText,
  combineColumns,
  convertColumnType,
  detectOutliers,
  extractDatePart,
  filterRows,
  normalizeColumnNames,
  previewInvalidForType,
  reorderColumns,
  renameColumn,
  splitColumn,
  standardizeCategories,
  standardizeDates,
} from '../lib/clean';
import { sortRows, type SortKey } from '../lib/sort';
import { Alert, Badge, Button, Field, Section, inputClass, selectClass } from '../components/ui';
import { formatNumber } from '../utils/format';

interface TransformProps {
  dataset: Dataset;
  onApply: (result: OpResult) => void;
}

export function Transform({ dataset, onApply }: TransformProps) {
  return (
    <div className="flex flex-col gap-5">
      <TextCleaningPanel dataset={dataset} onApply={onApply} />
      <CategoryStandardizationPanel dataset={dataset} onApply={onApply} />
      <NumberCleaningPanel dataset={dataset} onApply={onApply} />
      <DateCleaningPanel dataset={dataset} onApply={onApply} />
      <TypeConversionPanel dataset={dataset} onApply={onApply} />
      <OutlierPanel dataset={dataset} onApply={onApply} />
      <ColumnOpsPanel dataset={dataset} onApply={onApply} />
      <FilterPanel dataset={dataset} onApply={onApply} />
      <SortPanel dataset={dataset} onApply={onApply} />
    </div>
  );
}

function ColumnSelect({ dataset, value, onChange, types }: { dataset: Dataset; value: string; onChange: (v: string) => void; types?: ColumnType[] }) {
  const cols = types ? dataset.columns.filter((c) => types.includes(c.type)) : dataset.columns;
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {cols.map((c) => (
        <option key={c.name} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function TextCleaningPanel({ dataset, onApply }: TransformProps) {
  const [column, setColumn] = useState(dataset.columns[0]?.name ?? '');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);

  const ops: { id: 'trim' | 'lowercase' | 'uppercase' | 'titlecase' | 'remove_punctuation' | 'remove_special'; label: string }[] = [
    { id: 'trim', label: 'Trim whitespace' },
    { id: 'lowercase', label: 'lowercase' },
    { id: 'uppercase', label: 'UPPERCASE' },
    { id: 'titlecase', label: 'Title Case' },
    { id: 'remove_punctuation', label: 'Remove punctuation' },
    { id: 'remove_special', label: 'Remove special characters' },
  ];

  return (
    <Section title="Text cleaning">
      <Field label="Column">
        <ColumnSelect dataset={dataset} value={column} onChange={setColumn} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {ops.map((op) => (
          <Button key={op.id} onClick={() => onApply(cleanText(dataset, column, op.id))}>
            {op.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
        <Field label="Find">
          <input className={inputClass} value={find} onChange={(e) => setFind(e.target.value)} />
        </Field>
        <Field label="Replace with">
          <input className={inputClass} value={replace} onChange={(e) => setReplace(e.target.value)} />
        </Field>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm text-ink-600 dark:text-ink-300">
          <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
          Regex
        </label>
        <Button variant="primary" disabled={!find} onClick={() => onApply(cleanText(dataset, column, { findReplace: { find, replace, regex } }))}>
          Find & replace
        </Button>
      </div>
    </Section>
  );
}

function CategoryStandardizationPanel({ dataset, onApply }: TransformProps) {
  const catCols = dataset.columns.filter((c) => c.type === 'category' || c.type === 'string');
  const [column, setColumn] = useState(catCols[0]?.name ?? '');
  const uniqueValues = useMemo(() => {
    if (!column) return [];
    const set = new Set<string>();
    dataset.rows.forEach((r) => {
      const v = r[column];
      if (v !== null && v !== undefined && String(v).trim() !== '') set.add(String(v));
    });
    return Array.from(set).slice(0, 30);
  }, [dataset, column]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  if (catCols.length === 0) return null;

  return (
    <Section title="Standardize categories" description="Map inconsistent values (M, Male, MALE) to a single canonical value.">
      <Field label="Column">
        <ColumnSelect dataset={dataset} value={column} onChange={(v) => { setColumn(v); setMapping({}); }} types={['category', 'string']} />
      </Field>
      <div className="flex flex-col gap-1.5">
        {uniqueValues.map((val) => (
          <div key={val} className="flex items-center gap-2 text-sm">
            <span className="w-40 truncate text-ink-500">{val}</span>
            <span className="text-ink-300">→</span>
            <input
              className={`${inputClass} flex-1`}
              placeholder={val}
              value={mapping[val] ?? ''}
              onChange={(e) => setMapping((m) => ({ ...m, [val]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        onClick={() => {
          const cleaned = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v.trim() !== ''));
          onApply(standardizeCategories(dataset, column, cleaned));
          setMapping({});
        }}
      >
        Apply mapping
      </Button>
    </Section>
  );
}

function NumberCleaningPanel({ dataset, onApply }: TransformProps) {
  const [column, setColumn] = useState(dataset.columns[0]?.name ?? '');
  const [removeCommas, setRemoveCommas] = useState(true);
  const [removeCurrency, setRemoveCurrency] = useState(true);
  const [removePercent, setRemovePercent] = useState(false);
  const [round, setRound] = useState<string>('');

  return (
    <Section title="Number cleaning">
      <Field label="Column">
        <ColumnSelect dataset={dataset} value={column} onChange={setColumn} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm text-ink-600 dark:text-ink-300">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={removeCommas} onChange={(e) => setRemoveCommas(e.target.checked)} /> Remove commas
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={removeCurrency} onChange={(e) => setRemoveCurrency(e.target.checked)} /> Remove currency symbols
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={removePercent} onChange={(e) => setRemovePercent(e.target.checked)} /> Remove % symbol
        </label>
        <Field label="Round to">
          <input type="number" min={0} max={10} className={`${inputClass} w-20`} value={round} onChange={(e) => setRound(e.target.value)} />
        </Field>
      </div>
      <Button
        variant="primary"
        onClick={() =>
          onApply(
            cleanNumbers(dataset, column, {
              removeCommas,
              removeCurrencySymbols: removeCurrency,
              removePercent,
              round: round === '' ? undefined : Number(round),
            })
          )
        }
      >
        Clean numbers
      </Button>
    </Section>
  );
}

function DateCleaningPanel({ dataset, onApply }: TransformProps) {
  const [column, setColumn] = useState(dataset.columns[0]?.name ?? '');
  const [format, setFormat] = useState<DateOutputFormat>('YYYY-MM-DD');
  const [part, setPart] = useState<DatePart>('year');

  return (
    <Section title="Date cleaning">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Column">
          <ColumnSelect dataset={dataset} value={column} onChange={setColumn} />
        </Field>
        <Field label="Output format">
          <select className={selectClass} value={format} onChange={(e) => setFormat(e.target.value as DateOutputFormat)}>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          </select>
        </Field>
        <Button variant="primary" onClick={() => onApply(standardizeDates(dataset, column, format))}>
          Standardize dates
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
        <Field label="Extract">
          <select className={selectClass} value={part} onChange={(e) => setPart(e.target.value as DatePart)}>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="day">Day</option>
            <option value="weekday">Weekday</option>
          </select>
        </Field>
        <Button onClick={() => onApply(extractDatePart(dataset, column, part))}>Extract into new column</Button>
      </div>
    </Section>
  );
}

function TypeConversionPanel({ dataset, onApply }: TransformProps) {
  const [column, setColumn] = useState(dataset.columns[0]?.name ?? '');
  const [type, setType] = useState<ColumnType>('integer');
  const invalid = useMemo(() => previewInvalidForType(dataset, column, type), [dataset, column, type]);

  return (
    <Section title="Data type conversion">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Column">
          <ColumnSelect dataset={dataset} value={column} onChange={setColumn} />
        </Field>
        <Field label="Convert to">
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as ColumnType)}>
            <option value="string">String</option>
            <option value="integer">Integer</option>
            <option value="decimal">Decimal</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
            <option value="category">Category</option>
          </select>
        </Field>
        <Button variant="primary" onClick={() => onApply(convertColumnType(dataset, column, type).result)}>
          Convert
        </Button>
      </div>
      {invalid.length > 0 && (
        <Alert tone="warn" title={`${invalid.length}+ value(s) can't convert to ${type}`}>
          Example values: {invalid.slice(0, 5).map(String).join(', ')} — these will be left unchanged rather than silently destroyed.
        </Alert>
      )}
    </Section>
  );
}

function OutlierPanel({ dataset, onApply }: TransformProps) {
  const numericCols = dataset.columns.filter((c) => c.type === 'integer' || c.type === 'decimal');
  const [column, setColumn] = useState(numericCols[0]?.name ?? '');
  const [method, setMethod] = useState<'iqr' | 'zscore'>('iqr');
  const result = useMemo(() => (column ? detectOutliers(dataset, column, method) : null), [dataset, column, method]);

  if (numericCols.length === 0) return null;

  return (
    <Section title="Outlier detection" description="Flags suspicious values — nothing is removed automatically.">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Column">
          <ColumnSelect dataset={dataset} value={column} onChange={setColumn} types={['integer', 'decimal']} />
        </Field>
        <Field label="Method">
          <select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as 'iqr' | 'zscore')}>
            <option value="iqr">IQR (1.5×)</option>
            <option value="zscore">Z-score (&gt;3)</option>
          </select>
        </Field>
      </div>
      {result && (
        <>
          <Badge tone={result.indices.length > 0 ? 'warn' : 'good'}>
            {formatNumber(result.indices.length)} possible outlier{result.indices.length === 1 ? '' : 's'} (outside{' '}
            {result.bounds.low.toFixed(1)}–{result.bounds.high.toFixed(1)})
          </Badge>
          {result.indices.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                const idxSet = new Set(result.indices);
                onApply({
                  dataset: { ...dataset, rows: dataset.rows.filter((_, i) => !idxSet.has(i)) },
                  label: `Removed ${result.indices.length} outlier(s) in "${column}" (${method})`,
                  code: `# ${method} outlier removal on "${column}"\ndf = df[~df.index.isin([${result.indices.join(', ')}])].reset_index(drop=True)`,
                });
              }}
            >
              Remove flagged rows
            </Button>
          )}
        </>
      )}
    </Section>
  );
}

function ColumnOpsPanel({ dataset, onApply }: TransformProps) {
  const [renameFrom, setRenameFrom] = useState(dataset.columns[0]?.name ?? '');
  const [renameTo, setRenameTo] = useState('');
  const [splitColumnName, setSplitColumnName] = useState(dataset.columns[0]?.name ?? '');
  const [delimiter, setDelimiter] = useState(',');
  const [splitNames, setSplitNames] = useState('');
  const [combineCols, setCombineCols] = useState<string[]>([]);
  const [combineName, setCombineName] = useState('');
  const [separator, setSeparator] = useState(' ');
  const [order, setOrder] = useState<string[]>(dataset.columns.map((c) => c.name));

  const moveColumn = (name: string, dir: -1 | 1) => {
    const idx = order.indexOf(name);
    const next = [...order];
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setOrder(next);
  };

  return (
    <Section title="Column operations">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Rename column">
          <ColumnSelect dataset={dataset} value={renameFrom} onChange={setRenameFrom} />
        </Field>
        <Field label="New name">
          <input className={inputClass} value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
        </Field>
        <Button disabled={!renameTo} onClick={() => { onApply(renameColumn(dataset, renameFrom, renameTo)); setRenameTo(''); }}>
          Rename
        </Button>
        <Button variant="ghost" onClick={() => onApply(normalizeColumnNames(dataset))}>
          Normalize all to snake_case
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
        <Field label="Split column">
          <ColumnSelect dataset={dataset} value={splitColumnName} onChange={setSplitColumnName} />
        </Field>
        <Field label="Delimiter">
          <input className={`${inputClass} w-20`} value={delimiter} onChange={(e) => setDelimiter(e.target.value)} />
        </Field>
        <Field label="New column names (comma-separated)">
          <input className={`${inputClass} w-56`} placeholder="first_name, last_name" value={splitNames} onChange={(e) => setSplitNames(e.target.value)} />
        </Field>
        <Button
          disabled={!splitNames.trim()}
          onClick={() =>
            onApply(
              splitColumn(
                dataset,
                splitColumnName,
                delimiter,
                splitNames.split(',').map((s) => s.trim()).filter(Boolean)
              )
            )
          }
        >
          Split
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
        <Field label="Combine columns">
          <select multiple className={`${selectClass} h-20 w-48`} value={combineCols} onChange={(e) => setCombineCols(Array.from(e.target.selectedOptions).map((o) => o.value))}>
            {dataset.columns.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Separator">
          <input className={`${inputClass} w-16`} value={separator} onChange={(e) => setSeparator(e.target.value)} />
        </Field>
        <Field label="New column name">
          <input className={inputClass} value={combineName} onChange={(e) => setCombineName(e.target.value)} />
        </Field>
        <Button
          disabled={combineCols.length < 2 || !combineName}
          onClick={() => {
            onApply(combineColumns(dataset, combineCols, combineName, separator));
            setCombineCols([]);
            setCombineName('');
          }}
        >
          Combine
        </Button>
      </div>

      <div className="border-t border-ink-100 pt-3 dark:border-ink-800">
        <p className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-200">Reorder columns</p>
        <div className="flex flex-wrap gap-1.5">
          {order.map((name) => (
            <span key={name} className="flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-xs dark:border-ink-700 dark:bg-ink-800">
              {name}
              <button aria-label={`Move ${name} left`} onClick={() => moveColumn(name, -1)} className="text-ink-400 hover:text-ink-800">
                ‹
              </button>
              <button aria-label={`Move ${name} right`} onClick={() => moveColumn(name, 1)} className="text-ink-400 hover:text-ink-800">
                ›
              </button>
            </span>
          ))}
        </div>
        <Button className="mt-2" onClick={() => onApply(reorderColumns(dataset, order))}>
          Apply order
        </Button>
      </div>
    </Section>
  );
}

function FilterPanel({ dataset, onApply }: TransformProps) {
  const [rules, setRules] = useState<FilterRule[]>([{ column: dataset.columns[0]?.name ?? '', op: 'eq', value: '' }]);
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND');

  const opLabels: { id: CompareOp; label: string }[] = [
    { id: 'eq', label: 'Equals' },
    { id: 'neq', label: 'Not equals' },
    { id: 'gt', label: 'Greater than' },
    { id: 'lt', label: 'Less than' },
    { id: 'gte', label: 'Greater or equal' },
    { id: 'lte', label: 'Less or equal' },
    { id: 'contains', label: 'Contains' },
    { id: 'startswith', label: 'Starts with' },
    { id: 'endswith', label: 'Ends with' },
    { id: 'empty', label: 'Is empty' },
    { id: 'notempty', label: 'Is not empty' },
  ];

  const updateRule = (i: number, patch: Partial<FilterRule>) => {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  return (
    <Section title="Filter builder">
      <div className="flex flex-col gap-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {i > 0 && (
              <select className={`${selectClass} w-20`} value={combinator} onChange={(e) => setCombinator(e.target.value as 'AND' | 'OR')}>
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <ColumnSelect dataset={dataset} value={rule.column} onChange={(v) => updateRule(i, { column: v })} />
            <select className={selectClass} value={rule.op} onChange={(e) => updateRule(i, { op: e.target.value as CompareOp })}>
              {opLabels.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            {rule.op !== 'empty' && rule.op !== 'notempty' && (
              <input className={inputClass} value={rule.value ?? ''} onChange={(e) => updateRule(i, { value: e.target.value })} />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}
              aria-label="Remove rule"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setRules((rs) => [...rs, { column: dataset.columns[0]?.name ?? '', op: 'eq', value: '' }])}
        >
          + Add rule
        </Button>
      </div>
      <Button variant="primary" onClick={() => onApply(filterRows(dataset, rules, combinator))}>
        Keep matching rows
      </Button>
    </Section>
  );
}

function SortPanel({ dataset, onApply }: TransformProps) {
  const [keys, setKeys] = useState<SortKey[]>([{ column: dataset.columns[0]?.name ?? '', direction: 'asc' }]);

  const updateKey = (i: number, patch: Partial<SortKey>) => setKeys((ks) => ks.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));

  return (
    <Section title="Sorting">
      <div className="flex flex-col gap-2">
        {keys.map((key, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-400 w-4">{i + 1}.</span>
            <ColumnSelect dataset={dataset} value={key.column} onChange={(v) => updateKey(i, { column: v })} />
            <select className={selectClass} value={key.direction} onChange={(e) => updateKey(i, { direction: e.target.value as 'asc' | 'desc' })}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <Button variant="ghost" size="sm" aria-label="Remove sort key" onClick={() => setKeys((ks) => ks.filter((_, idx) => idx !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setKeys((ks) => [...ks, { column: dataset.columns[0]?.name ?? '', direction: 'asc' }])}>
          + Add sort key
        </Button>
      </div>
      <Button variant="primary" onClick={() => onApply(sortRows(dataset, keys))}>
        Apply sort
      </Button>
    </Section>
  );
}
