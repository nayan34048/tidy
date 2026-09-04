import type { CellValue, ColumnType, Dataset, Row } from '../types/dataset';
import { columnValues, isMissing } from '../types/dataset';
import { coerceToType } from './infer';
import { toSnakeCase } from '../utils/format';
import { countDuplicateRows, profileColumn } from './profile';

/** Every cleaning operation returns the new dataset plus a human label and
 * a pandas snippet, so the caller can push one HistoryEntry per step. */
export interface OpResult {
  dataset: Dataset;
  label: string;
  code: string;
}

function withRows(ds: Dataset, rows: Row[]): Dataset {
  return { ...ds, rows };
}

function withColumns(ds: Dataset, columns: Dataset['columns']): Dataset {
  return { ...ds, columns };
}

// ---------- Rows ----------

export function removeRowsByIndex(ds: Dataset, indices: Set<number>): OpResult {
  const rows = ds.rows.filter((_, i) => !indices.has(i));
  return {
    dataset: withRows(ds, rows),
    label: `Removed ${indices.size} selected row${indices.size === 1 ? '' : 's'}`,
    code: `df = df.drop(index=[${[...indices].join(', ')}]).reset_index(drop=True)`,
  };
}

export function removeEmptyRows(ds: Dataset): OpResult {
  const cols = ds.columns.map((c) => c.name);
  const rows = ds.rows.filter((r) => !cols.every((c) => isMissing(r[c])));
  const removed = ds.rows.length - rows.length;
  return {
    dataset: withRows(ds, rows),
    label: `Removed ${removed} empty row${removed === 1 ? '' : 's'}`,
    code: `df = df.dropna(how="all").reset_index(drop=True)`,
  };
}

export function removeDuplicateRows(ds: Dataset, keyColumns: string[] | null, keep: 'first' | 'last'): OpResult {
  const cols = keyColumns && keyColumns.length > 0 ? keyColumns : ds.columns.map((c) => c.name);
  const seen = new Map<string, number>();
  const rowKey = (r: Row) => cols.map((c) => JSON.stringify(r[c] ?? null)).join('\u0001');
  ds.rows.forEach((r, i) => {
    const k = rowKey(r);
    if (keep === 'first' && seen.has(k)) return;
    seen.set(k, i);
  });
  let rows: Row[];
  if (keep === 'first') {
    const keepKeys = new Set<string>();
    rows = ds.rows.filter((r) => {
      const k = rowKey(r);
      if (keepKeys.has(k)) return false;
      keepKeys.add(k);
      return true;
    });
  } else {
    const lastIndexForKey = new Map<string, number>();
    ds.rows.forEach((r, i) => lastIndexForKey.set(rowKey(r), i));
    rows = ds.rows.filter((r, i) => lastIndexForKey.get(rowKey(r)) === i);
  }
  const removed = ds.rows.length - rows.length;
  const subsetArg = keyColumns && keyColumns.length > 0 ? `subset=${JSON.stringify(keyColumns)}, ` : '';
  return {
    dataset: withRows(ds, rows),
    label: `Removed ${removed} duplicate row${removed === 1 ? '' : 's'}${keyColumns?.length ? ` (by ${keyColumns.join(', ')})` : ''}`,
    code: `df = df.drop_duplicates(${subsetArg}keep="${keep}").reset_index(drop=True)`,
  };
}

export function removeRowsWithMissing(ds: Dataset, columns: string[] | null): OpResult {
  const cols = columns && columns.length > 0 ? columns : ds.columns.map((c) => c.name);
  const rows = ds.rows.filter((r) => !cols.some((c) => isMissing(r[c])));
  const removed = ds.rows.length - rows.length;
  const subsetArg = columns && columns.length > 0 ? `subset=${JSON.stringify(columns)}` : '';
  return {
    dataset: withRows(ds, rows),
    label: `Removed ${removed} row${removed === 1 ? '' : 's'} with missing values${columns?.length ? ` in ${columns.join(', ')}` : ''}`,
    code: `df = df.dropna(${subsetArg}).reset_index(drop=True)`,
  };
}

export type CompareOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startswith' | 'endswith' | 'empty' | 'notempty';

export interface FilterRule {
  column: string;
  op: CompareOp;
  value?: string;
}

function matchRule(row: Row, rule: FilterRule): boolean {
  const v = row[rule.column];
  if (rule.op === 'empty') return isMissing(v);
  if (rule.op === 'notempty') return !isMissing(v);
  if (isMissing(v)) return false;
  const num = Number(v);
  const target = rule.value ?? '';
  switch (rule.op) {
    case 'eq':
      return String(v).toLowerCase() === target.toLowerCase();
    case 'neq':
      return String(v).toLowerCase() !== target.toLowerCase();
    case 'gt':
      return Number.isFinite(num) && num > Number(target);
    case 'lt':
      return Number.isFinite(num) && num < Number(target);
    case 'gte':
      return Number.isFinite(num) && num >= Number(target);
    case 'lte':
      return Number.isFinite(num) && num <= Number(target);
    case 'contains':
      return String(v).toLowerCase().includes(target.toLowerCase());
    case 'startswith':
      return String(v).toLowerCase().startsWith(target.toLowerCase());
    case 'endswith':
      return String(v).toLowerCase().endsWith(target.toLowerCase());
    default:
      return true;
  }
}

/** Evaluates filter rules against a dataset; used by both "remove matching rows" and the Filter panel. */
export function evaluateFilter(ds: Dataset, rules: FilterRule[], combinator: 'AND' | 'OR'): boolean[] {
  return ds.rows.map((r) => {
    if (rules.length === 0) return true;
    return combinator === 'AND' ? rules.every((rule) => matchRule(r, rule)) : rules.some((rule) => matchRule(r, rule));
  });
}

export function removeRowsMatching(ds: Dataset, rules: FilterRule[], combinator: 'AND' | 'OR'): OpResult {
  const matches = evaluateFilter(ds, rules, combinator);
  const rows = ds.rows.filter((_, i) => !matches[i]);
  const removed = ds.rows.length - rows.length;
  return {
    dataset: withRows(ds, rows),
    label: `Removed ${removed} row${removed === 1 ? '' : 's'} matching condition`,
    code: `# condition: ${rules.map((r) => `${r.column} ${r.op} ${r.value ?? ''}`).join(` ${combinator} `)}\ndf = df[~(<condition>)].reset_index(drop=True)`,
  };
}

export function filterRows(ds: Dataset, rules: FilterRule[], combinator: 'AND' | 'OR'): OpResult {
  const matches = evaluateFilter(ds, rules, combinator);
  const rows = ds.rows.filter((_, i) => matches[i]);
  return {
    dataset: withRows(ds, rows),
    label: `Filtered to ${rows.length} row${rows.length === 1 ? '' : 's'}`,
    code: `# condition: ${rules.map((r) => `${r.column} ${r.op} ${r.value ?? ''}`).join(` ${combinator} `)}\ndf = df[<condition>].reset_index(drop=True)`,
  };
}

// ---------- Columns ----------

export function removeColumns(ds: Dataset, names: string[]): OpResult {
  const set = new Set(names);
  const columns = ds.columns.filter((c) => !set.has(c.name));
  const rows = ds.rows.map((r) => {
    const row = { ...r };
    names.forEach((n) => delete row[n]);
    return row;
  });
  return {
    dataset: { ...ds, columns, rows },
    label: `Removed column${names.length === 1 ? '' : 's'} ${names.join(', ')}`,
    code: `df = df.drop(columns=${JSON.stringify(names)})`,
  };
}

export function removeEmptyColumns(ds: Dataset): OpResult {
  const empty = ds.columns.filter((c) => profileColumn(ds, c.name, c.type).missingPct === 1).map((c) => c.name);
  if (empty.length === 0) return { dataset: ds, label: 'No empty columns found', code: '# no-op' };
  return removeColumns(ds, empty);
}

export function removeColumnsByMissingThreshold(ds: Dataset, thresholdPct: number): OpResult {
  const targets = ds.columns
    .filter((c) => profileColumn(ds, c.name, c.type).missingPct >= thresholdPct)
    .map((c) => c.name);
  if (targets.length === 0) return { dataset: ds, label: 'No columns exceeded the missing-value threshold', code: '# no-op' };
  const result = removeColumns(ds, targets);
  return {
    ...result,
    label: `Removed ${targets.length} column(s) with ≥${Math.round(thresholdPct * 100)}% missing`,
    code: `high_missing = df.columns[df.isna().mean() >= ${thresholdPct}]\ndf = df.drop(columns=high_missing)`,
  };
}

export function removeConstantColumns(ds: Dataset): OpResult {
  const targets = ds.columns
    .filter((c) => {
      const p = profileColumn(ds, c.name, c.type);
      return p.uniqueCount <= 1 && p.missingPct < 1;
    })
    .map((c) => c.name);
  if (targets.length === 0) return { dataset: ds, label: 'No constant columns found', code: '# no-op' };
  const result = removeColumns(ds, targets);
  return { ...result, label: `Removed ${targets.length} constant column(s): ${targets.join(', ')}` };
}

export function removeDuplicateColumns(ds: Dataset): OpResult {
  const seen = new Map<string, string>(); // signature -> first column name
  const targets: string[] = [];
  for (const col of ds.columns) {
    const sig = JSON.stringify(columnValues(ds, col.name));
    if (seen.has(sig)) targets.push(col.name);
    else seen.set(sig, col.name);
  }
  if (targets.length === 0) return { dataset: ds, label: 'No duplicate columns found', code: '# no-op' };
  const result = removeColumns(ds, targets);
  return { ...result, label: `Removed ${targets.length} duplicate column(s): ${targets.join(', ')}` };
}

export function renameColumn(ds: Dataset, oldName: string, newName: string): OpResult {
  if (!newName || oldName === newName) return { dataset: ds, label: 'No change', code: '# no-op' };
  const columns = ds.columns.map((c) => (c.name === oldName ? { ...c, name: newName } : c));
  const rows = ds.rows.map((r) => {
    const row = { ...r };
    row[newName] = row[oldName];
    delete row[oldName];
    return row;
  });
  return {
    dataset: { ...ds, columns, rows },
    label: `Renamed "${oldName}" → "${newName}"`,
    code: `df = df.rename(columns={"${oldName}": "${newName}"})`,
  };
}

export function normalizeColumnNames(ds: Dataset): OpResult {
  const columns = ds.columns.map((c) => ({ ...c, name: toSnakeCase(c.name) }));
  const rows = ds.rows.map((r) => {
    const row: Row = {};
    ds.columns.forEach((c) => {
      row[toSnakeCase(c.name)] = r[c.name];
    });
    return row;
  });
  return {
    dataset: { ...ds, columns, rows },
    label: 'Normalized column names to snake_case',
    code: `df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]`,
  };
}

export function reorderColumns(ds: Dataset, order: string[]): OpResult {
  const byName = new Map(ds.columns.map((c) => [c.name, c]));
  const columns = order.map((n) => byName.get(n)!).filter(Boolean);
  return {
    dataset: { ...ds, columns },
    label: 'Reordered columns',
    code: `df = df[${JSON.stringify(order)}]`,
  };
}

export function splitColumn(ds: Dataset, column: string, delimiter: string, newNames: string[]): OpResult {
  const columns = [...ds.columns];
  const insertAt = columns.findIndex((c) => c.name === column) + 1;
  const newCols = newNames.map((n) => ({ name: n, type: 'string' as ColumnType, inferred: false }));
  columns.splice(insertAt, 0, ...newCols);
  const rows = ds.rows.map((r) => {
    const row = { ...r };
    const parts = isMissing(r[column]) ? [] : String(r[column]).split(delimiter);
    newNames.forEach((n, i) => {
      row[n] = parts[i] !== undefined ? parts[i].trim() : null;
    });
    return row;
  });
  return {
    dataset: { ...ds, columns, rows },
    label: `Split "${column}" into ${newNames.join(', ')}`,
    code: `df[${JSON.stringify(newNames)}] = df["${column}"].str.split("${delimiter}", expand=True)`,
  };
}

export function combineColumns(ds: Dataset, columnsToCombine: string[], newName: string, separator: string): OpResult {
  const insertAt = ds.columns.findIndex((c) => c.name === columnsToCombine[0]);
  const columns = [...ds.columns];
  columns.splice(insertAt, 0, { name: newName, type: 'string', inferred: false });
  const rows = ds.rows.map((r) => {
    const row = { ...r };
    row[newName] = columnsToCombine
      .map((c) => (isMissing(r[c]) ? '' : String(r[c])))
      .filter((v) => v !== '')
      .join(separator);
    return row;
  });
  return {
    dataset: { ...ds, columns, rows },
    label: `Combined ${columnsToCombine.join(', ')} → "${newName}"`,
    code: `df["${newName}"] = df[${JSON.stringify(columnsToCombine)}].astype(str).agg("${separator}".join, axis=1)`,
  };
}

// ---------- Missing values ----------

export type FillStrategy = 'mean' | 'median' | 'mode' | 'zero' | 'custom' | 'previous' | 'next';

function computeFillValue(ds: Dataset, column: string, strategy: FillStrategy, custom?: string): CellValue {
  const present = columnValues(ds, column).filter((v) => !isMissing(v));
  if (strategy === 'zero') return 0;
  if (strategy === 'custom') return custom ?? '';
  const nums = present.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (strategy === 'mean') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  if (strategy === 'median') {
    if (!nums.length) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  if (strategy === 'mode') {
    const freq = new Map<string, number>();
    present.forEach((v) => freq.set(String(v), (freq.get(String(v)) ?? 0) + 1));
    let best: string | null = null;
    let bestCount = -1;
    freq.forEach((count, val) => {
      if (count > bestCount) {
        best = val;
        bestCount = count;
      }
    });
    return best;
  }
  return null;
}

export function fillMissing(ds: Dataset, column: string, strategy: FillStrategy, custom?: string): OpResult {
  let affected = 0;
  let rows: Row[];

  if (strategy === 'previous' || strategy === 'next') {
    rows = ds.rows.map((r) => ({ ...r }));
    const order = strategy === 'previous' ? rows.map((_, i) => i) : rows.map((_, i) => i).reverse();
    let last: CellValue = null;
    for (const i of order) {
      if (isMissing(rows[i][column])) {
        if (last !== null) {
          rows[i][column] = last;
          affected++;
        }
      } else {
        last = rows[i][column];
      }
    }
  } else {
    const fillValue = computeFillValue(ds, column, strategy, custom);
    rows = ds.rows.map((r) => {
      if (isMissing(r[column])) {
        affected++;
        return { ...r, [column]: fillValue };
      }
      return r;
    });
  }

  const codeMap: Record<FillStrategy, string> = {
    mean: `df["${column}"] = df["${column}"].fillna(df["${column}"].mean())`,
    median: `df["${column}"] = df["${column}"].fillna(df["${column}"].median())`,
    mode: `df["${column}"] = df["${column}"].fillna(df["${column}"].mode().iloc[0])`,
    zero: `df["${column}"] = df["${column}"].fillna(0)`,
    custom: `df["${column}"] = df["${column}"].fillna(${JSON.stringify(custom ?? '')})`,
    previous: `df["${column}"] = df["${column}"].ffill()`,
    next: `df["${column}"] = df["${column}"].bfill()`,
  };

  return {
    dataset: withRows(ds, rows),
    label: `Filled ${affected} missing value${affected === 1 ? '' : 's'} in "${column}" (${strategy})`,
    code: codeMap[strategy],
  };
}

export function countAffectedByFill(ds: Dataset, column: string): number {
  return columnValues(ds, column).filter(isMissing).length;
}

// ---------- Text cleaning ----------

export type TextOp =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'titlecase'
  | 'remove_punctuation'
  | 'remove_special'
  | { findReplace: { find: string; replace: string; regex?: boolean } };

function applyTextOp(value: string, op: TextOp): string {
  if (typeof op === 'object') {
    const { find, replace, regex } = op.findReplace;
    if (regex) {
      try {
        return value.replace(new RegExp(find, 'g'), replace);
      } catch {
        return value;
      }
    }
    return value.split(find).join(replace);
  }
  switch (op) {
    case 'trim':
      return value.trim().replace(/\s+/g, ' ');
    case 'lowercase':
      return value.toLowerCase();
    case 'uppercase':
      return value.toUpperCase();
    case 'titlecase':
      return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case 'remove_punctuation':
      return value.replace(/[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g, '');
    case 'remove_special':
      return value.replace(/[^\w\s]/g, '');
    default:
      return value;
  }
}

const TEXT_OP_CODE: Record<string, (col: string) => string> = {
  trim: (c) => `df["${c}"] = df["${c}"].str.strip().str.replace(r"\\s+", " ", regex=True)`,
  lowercase: (c) => `df["${c}"] = df["${c}"].str.lower()`,
  uppercase: (c) => `df["${c}"] = df["${c}"].str.upper()`,
  titlecase: (c) => `df["${c}"] = df["${c}"].str.title()`,
  remove_punctuation: (c) => `df["${c}"] = df["${c}"].str.replace(r"[^\\w\\s]", "", regex=True)`,
  remove_special: (c) => `df["${c}"] = df["${c}"].str.replace(r"[^\\w\\s]", "", regex=True)`,
};

export function cleanText(ds: Dataset, column: string, op: TextOp): OpResult {
  const rows = ds.rows.map((r) => {
    if (isMissing(r[column])) return r;
    return { ...r, [column]: applyTextOp(String(r[column]), op) };
  });
  const label =
    typeof op === 'object'
      ? `Replaced "${op.findReplace.find}" → "${op.findReplace.replace}" in "${column}"`
      : `Applied ${op.replace(/_/g, ' ')} to "${column}"`;
  const code =
    typeof op === 'object'
      ? `df["${column}"] = df["${column}"].str.replace(${JSON.stringify(op.findReplace.find)}, ${JSON.stringify(op.findReplace.replace)}, regex=${op.findReplace.regex ? 'True' : 'False'})`
      : TEXT_OP_CODE[op](column);
  return { dataset: withRows(ds, rows), label, code };
}

export function standardizeCategories(ds: Dataset, column: string, mapping: Record<string, string>): OpResult {
  const lowerMap = new Map(Object.entries(mapping).map(([k, v]) => [k.trim().toLowerCase(), v]));
  let affected = 0;
  const rows = ds.rows.map((r) => {
    if (isMissing(r[column])) return r;
    const key = String(r[column]).trim().toLowerCase();
    const mapped = lowerMap.get(key);
    if (mapped !== undefined && mapped !== r[column]) {
      affected++;
      return { ...r, [column]: mapped };
    }
    return r;
  });
  return {
    dataset: withRows(ds, rows),
    label: `Standardized ${affected} value${affected === 1 ? '' : 's'} in "${column}"`,
    code: `mapping = ${JSON.stringify(mapping)}\ndf["${column}"] = df["${column}"].replace(mapping)`,
  };
}

// ---------- Number cleaning ----------

export interface NumberCleanOptions {
  removeCommas?: boolean;
  removeCurrencySymbols?: boolean;
  removePercent?: boolean;
  round?: number;
}

export function cleanNumbers(ds: Dataset, column: string, opts: NumberCleanOptions): OpResult {
  let invalid = 0;
  const rows = ds.rows.map((r) => {
    if (isMissing(r[column])) return r;
    let s = String(r[column]).trim();
    if (opts.removeCurrencySymbols) s = s.replace(/[^\d.,\-]/g, '');
    if (opts.removeCommas) s = s.replace(/,/g, '');
    if (opts.removePercent) s = s.replace(/%/g, '');
    let n = Number(s);
    if (!Number.isFinite(n)) {
      invalid++;
      return r;
    }
    if (typeof opts.round === 'number') n = Number(n.toFixed(opts.round));
    return { ...r, [column]: n };
  });
  const parts: string[] = [`df["${column}"] = df["${column}"].astype(str)`];
  if (opts.removeCurrencySymbols) parts.push(`.str.replace(r"[^\\d.,\\-]", "", regex=True)`);
  if (opts.removeCommas) parts.push(`.str.replace(",", "", regex=False)`);
  if (opts.removePercent) parts.push(`.str.replace("%", "", regex=False)`);
  let code = parts.join('\n  ') + `\ndf["${column}"] = pd.to_numeric(df["${column}"], errors="coerce")`;
  if (typeof opts.round === 'number') code += `\ndf["${column}"] = df["${column}"].round(${opts.round})`;
  return {
    dataset: withRows(ds, rows),
    label: `Cleaned numbers in "${column}"${invalid ? ` (${invalid} value${invalid === 1 ? '' : 's'} could not be converted)` : ''}`,
    code,
  };
}

// ---------- Date cleaning ----------

export type DateOutputFormat = 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM/DD/YYYY';

function formatDate(d: Date, fmt: DateOutputFormat): string {
  const yyyy = d.getFullYear().toString().padStart(4, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  switch (fmt) {
    case 'DD-MM-YYYY':
      return `${dd}-${mm}-${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD':
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

export function standardizeDates(ds: Dataset, column: string, format: DateOutputFormat): OpResult {
  let invalid = 0;
  const rows = ds.rows.map((r) => {
    if (isMissing(r[column])) return r;
    const d = new Date(String(r[column]));
    if (Number.isNaN(d.getTime())) {
      invalid++;
      return r;
    }
    return { ...r, [column]: formatDate(d, format) };
  });
  return {
    dataset: withRows(ds, rows),
    label: `Standardized dates in "${column}" to ${format}${invalid ? ` (${invalid} invalid)` : ''}`,
    code: `df["${column}"] = pd.to_datetime(df["${column}"], errors="coerce").dt.strftime("${format.replace('YYYY', '%Y').replace('MM', '%m').replace('DD', '%d')}")`,
  };
}

export type DatePart = 'year' | 'month' | 'day' | 'weekday';

export function extractDatePart(ds: Dataset, column: string, part: DatePart): OpResult {
  const newCol = `${column}_${part}`;
  const columns = [...ds.columns];
  const idx = columns.findIndex((c) => c.name === column) + 1;
  columns.splice(idx, 0, { name: newCol, type: part === 'weekday' ? 'category' : 'integer', inferred: false });
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const rows = ds.rows.map((r) => {
    if (isMissing(r[column])) return { ...r, [newCol]: null };
    const d = new Date(String(r[column]));
    if (Number.isNaN(d.getTime())) return { ...r, [newCol]: null };
    const value =
      part === 'year' ? d.getFullYear() : part === 'month' ? d.getMonth() + 1 : part === 'day' ? d.getDate() : weekdays[d.getDay()];
    return { ...r, [newCol]: value };
  });
  const accessor = { year: 'dt.year', month: 'dt.month', day: 'dt.day', weekday: 'dt.day_name()' }[part];
  return {
    dataset: { ...ds, columns, rows },
    label: `Extracted ${part} from "${column}" → "${newCol}"`,
    code: `df["${newCol}"] = pd.to_datetime(df["${column}"], errors="coerce").${accessor}`,
  };
}

// ---------- Type conversion ----------

export function convertColumnType(ds: Dataset, column: string, type: ColumnType): { result: OpResult; invalidCount: number } {
  let invalid = 0;
  const rows = ds.rows.map((r) => {
    const { value, ok } = coerceToType(r[column], type);
    if (!ok) invalid++;
    return { ...r, [column]: ok ? value : r[column] };
  });
  const columns = ds.columns.map((c) => (c.name === column ? { ...c, type, inferred: false } : c));
  const pandasType = { string: 'str', integer: 'Int64', decimal: 'float64', boolean: 'boolean', date: 'datetime64[ns]', category: 'category' }[type];
  const code =
    type === 'date'
      ? `df["${column}"] = pd.to_datetime(df["${column}"], errors="coerce")`
      : `df["${column}"] = df["${column}"].astype("${pandasType}", errors="ignore")`;
  return {
    result: {
      dataset: { ...ds, columns, rows },
      label: `Converted "${column}" to ${type}${invalid ? ` (${invalid} value${invalid === 1 ? '' : 's'} could not convert)` : ''}`,
      code,
    },
    invalidCount: invalid,
  };
}

export function previewInvalidForType(ds: Dataset, column: string, type: ColumnType): CellValue[] {
  return columnValues(ds, column)
    .filter((v) => !isMissing(v))
    .filter((v) => !coerceToType(v, type).ok)
    .slice(0, 20);
}

// ---------- Outliers ----------

export interface OutlierResult {
  method: 'iqr' | 'zscore';
  indices: number[];
  values: number[];
  bounds: { low: number; high: number };
}

export function detectOutliers(ds: Dataset, column: string, method: 'iqr' | 'zscore'): OutlierResult {
  const entries = ds.rows.map((r, i) => ({ i, v: Number(r[column]) })).filter((e) => Number.isFinite(e.v));
  const nums = entries.map((e) => e.v).sort((a, b) => a - b);
  if (nums.length === 0) return { method, indices: [], values: [], bounds: { low: 0, high: 0 } };

  if (method === 'iqr') {
    const q1 = nums[Math.floor(nums.length * 0.25)];
    const q3 = nums[Math.floor(nums.length * 0.75)];
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    const flagged = entries.filter((e) => e.v < low || e.v > high);
    return { method, indices: flagged.map((e) => e.i), values: flagged.map((e) => e.v), bounds: { low, high } };
  }

  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  const std = Math.sqrt(variance) || 1;
  const flagged = entries.filter((e) => Math.abs((e.v - mean) / std) > 3);
  return {
    method,
    indices: flagged.map((e) => e.i),
    values: flagged.map((e) => e.v),
    bounds: { low: mean - 3 * std, high: mean + 3 * std },
  };
}

export { countDuplicateRows };
