/**
 * Core data model. A Dataset is an immutable value: every cleaning
 * operation returns a *new* Dataset rather than mutating the one it
 * received. That's what makes undo/redo a simple stack of snapshots
 * instead of a change-tracking system.
 */

export type ColumnType = 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'category';

/** A single cell value. `null` is the canonical "missing" representation. */
export type CellValue = string | number | boolean | null;

export type Row = Record<string, CellValue>;

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  /** True if the type was inferred automatically rather than set by the user. */
  inferred: boolean;
}

export interface HistoryEntry {
  id: string;
  label: string;
  /** Human-readable pandas snippet reflecting this exact step. */
  code: string;
  timestamp: number;
}

export interface DatasetMeta {
  name: string;
  sourceFileName?: string;
  importedAt: number;
}

export interface Dataset {
  columns: ColumnMeta[];
  rows: Row[];
  meta: DatasetMeta;
}

/** The full undo/redo-able application state for one dataset session. */
export interface DatasetSession {
  /** Snapshots of the dataset after each operation. snapshots[0] is the original import. */
  snapshots: Dataset[];
  /** Index into `snapshots` that represents "now". */
  pointer: number;
  /** History log entries, one per forward step (parallel to snapshots[1..]). */
  history: HistoryEntry[];
}

export const MISSING_TOKENS = new Set([
  '', 'null', 'none', 'nan', 'n/a', 'na', 'unknown', 'not available', '#n/a', '-', '--',
]);

export function isMissing(value: CellValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return MISSING_TOKENS.has(value.trim().toLowerCase());
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

export function columnValues(ds: Dataset, col: string): CellValue[] {
  return ds.rows.map((r) => r[col] ?? null);
}
