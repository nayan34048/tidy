import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CellValue, ColumnMeta, Dataset, Row } from '../types/dataset';
import { inferColumnType } from './infer';

export class ParseError extends Error {}

function buildDataset(fields: string[], rows: Row[], fileName: string): Dataset {
  const columns: ColumnMeta[] = fields.map((name) => ({
    name,
    type: inferColumnType(rows.map((r) => r[name])),
    inferred: true,
  }));
  return {
    columns,
    rows,
    meta: { name: fileName.replace(/\.[^.]+$/, ''), sourceFileName: fileName, importedAt: Date.now() },
  };
}

function normalizeCell(v: unknown): CellValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

async function parseDelimited(file: File, delimiter?: string): Promise<Dataset> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    dynamicTyping: true,
  });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new ParseError(
      `Could not parse "${file.name}". Check the delimiter or file encoding. (${result.errors[0].message})`
    );
  }
  const fields = result.meta.fields ?? [];
  if (fields.length === 0) {
    throw new ParseError(`"${file.name}" doesn't look like it has a header row Tidy could read.`);
  }
  const rows: Row[] = result.data.map((r) => {
    const row: Row = {};
    for (const f of fields) row[f] = normalizeCell(r[f]);
    return row;
  });
  return buildDataset(fields, rows, file.name);
}

async function parseExcel(file: File): Promise<Dataset> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (e) {
    throw new ParseError(`Could not open "${file.name}" as an Excel file. It may be corrupted or password-protected.`);
  }
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (json.length === 0) {
    throw new ParseError(`"${file.name}" (sheet "${sheetName}") has no rows Tidy could read.`);
  }
  const fields = Object.keys(json[0]);
  const rows: Row[] = json.map((r) => {
    const row: Row = {};
    for (const f of fields) row[f] = normalizeCell(r[f]);
    return row;
  });
  return buildDataset(fields, rows, file.name);
}

async function parseJson(file: File): Promise<Dataset> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new ParseError(`"${file.name}" is not valid JSON.`);
  }
  const records = Array.isArray(data) ? data : (data as { rows?: unknown[] })?.rows;
  if (!Array.isArray(records) || records.length === 0) {
    throw new ParseError(`"${file.name}" must be a JSON array of objects (or {"rows": [...]}).`);
  }
  const fieldSet = new Set<string>();
  for (const r of records) {
    if (r && typeof r === 'object') Object.keys(r).forEach((k) => fieldSet.add(k));
  }
  const fields = Array.from(fieldSet);
  const rows: Row[] = records.map((r) => {
    const row: Row = {};
    const obj = (r ?? {}) as Record<string, unknown>;
    for (const f of fields) row[f] = normalizeCell(obj[f]);
    return row;
  });
  return buildDataset(fields, rows, file.name);
}

/** Parses an uploaded File into a Dataset, dispatching by extension. */
export async function parseFile(file: File): Promise<Dataset> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv':
      return parseDelimited(file, ',');
    case 'tsv':
      return parseDelimited(file, '\t');
    case 'txt':
      return parseDelimited(file); // auto-detect delimiter
    case 'xlsx':
    case 'xls':
      return parseExcel(file);
    case 'json':
      return parseJson(file);
    default:
      throw new ParseError(`Unsupported file type ".${ext ?? 'unknown'}". Tidy reads CSV, TSV, TXT, XLSX, XLS, and JSON.`);
  }
}
