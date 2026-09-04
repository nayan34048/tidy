import type { CellValue, ColumnMeta, Dataset, Row } from '../types/dataset';
import { isMissing } from '../types/dataset';
import type { OpResult } from './clean';

export type JoinType = 'inner' | 'left' | 'right' | 'full';

export interface JoinKeyPair {
  left: string;
  right: string;
}

export interface MergePreview {
  leftRowCount: number;
  rightRowCount: number;
  matchingKeys: number;
  onlyInLeft: number;
  onlyInRight: number;
  duplicateKeysLeft: number;
  duplicateKeysRight: number;
  resultingRowsEstimate: number;
  warnings: string[];
}

function keyOf(row: Row, cols: string[]): string {
  return cols.map((c) => (isMissing(row[c]) ? '\u0000' : String(row[c]).trim().toLowerCase())).join('\u0001');
}

function countByKey(rows: Row[], cols: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = keyOf(r, cols);
    const list = map.get(k) ?? [];
    list.push(i);
    map.set(k, list);
  });
  return map;
}

export function computeMergePreview(left: Dataset, right: Dataset, keys: JoinKeyPair[], joinType: JoinType): MergePreview {
  const leftCols = keys.map((k) => k.left);
  const rightCols = keys.map((k) => k.right);
  const leftMap = countByKey(left.rows, leftCols);
  const rightMap = countByKey(right.rows, rightCols);

  let matching = 0;
  let onlyLeft = 0;
  let dupLeft = 0;
  let dupRight = 0;
  let estimate = 0;

  leftMap.forEach((idxs, k) => {
    if (idxs.length > 1) dupLeft++;
    if (rightMap.has(k)) {
      matching += idxs.length;
      estimate += idxs.length * (rightMap.get(k)?.length ?? 0);
    } else {
      onlyLeft += idxs.length;
    }
  });
  let onlyRight = 0;
  rightMap.forEach((idxs, k) => {
    if (idxs.length > 1) dupRight++;
    if (!leftMap.has(k)) onlyRight += idxs.length;
  });

  if (joinType === 'left') estimate += 0; // matches already counted; unmatched left rows appear once each
  const leftUnmatchedRows = onlyLeft;
  const rightUnmatchedRows = onlyRight;

  let resultingRowsEstimate = estimate;
  if (joinType === 'left') resultingRowsEstimate += leftUnmatchedRows;
  if (joinType === 'right') resultingRowsEstimate += rightUnmatchedRows;
  if (joinType === 'full') resultingRowsEstimate += leftUnmatchedRows + rightUnmatchedRows;

  const warnings: string[] = [];
  if (dupLeft > 0 && dupRight > 0) {
    warnings.push('Both sides have duplicate keys — this will produce a many-to-many join and can multiply rows unexpectedly.');
  } else if (dupLeft > 0 || dupRight > 0) {
    warnings.push('The join key contains duplicate values on one side — matching rows will be repeated for each duplicate.');
  }
  for (const { left: l, right: r } of keys) {
    const lt = left.columns.find((c) => c.name === l)?.type;
    const rt = right.columns.find((c) => c.name === r)?.type;
    if (lt && rt && lt !== rt) {
      warnings.push(`"${l}" (${lt}) and "${r}" (${rt}) have different data types — values may fail to match.`);
    }
  }
  if (joinType === 'inner' && (leftUnmatchedRows > 0 || rightUnmatchedRows > 0)) {
    warnings.push(`${leftUnmatchedRows + rightUnmatchedRows} unmatched record(s) will be dropped by the inner join.`);
  }
  if (resultingRowsEstimate > (left.rows.length + right.rows.length) * 3) {
    warnings.push('This join will create a large number of records relative to your inputs — double-check your keys.');
  }

  return {
    leftRowCount: left.rows.length,
    rightRowCount: right.rows.length,
    matchingKeys: matching,
    onlyInLeft: onlyLeft,
    onlyInRight: onlyRight,
    duplicateKeysLeft: dupLeft,
    duplicateKeysRight: dupRight,
    resultingRowsEstimate,
    warnings,
  };
}

function mergeColumns(left: Dataset, right: Dataset, rightKeyCols: Set<string>): ColumnMeta[] {
  const leftNames = new Set(left.columns.map((c) => c.name));
  const cols = [...left.columns];
  for (const c of right.columns) {
    if (rightKeyCols.has(c.name)) continue; // dropped: same info as the matching left key
    if (leftNames.has(c.name)) {
      cols.push({ ...c, name: `${c.name}_right` });
    } else {
      cols.push(c);
    }
  }
  return cols;
}

export function performJoin(left: Dataset, right: Dataset, keys: JoinKeyPair[], joinType: JoinType): Dataset {
  const leftCols = keys.map((k) => k.left);
  const rightCols = keys.map((k) => k.right);
  const rightKeySet = new Set(rightCols);
  const leftNameSet = new Set(left.columns.map((c) => c.name));
  const rightMap = countByKey(right.rows, rightCols);
  const leftMap = countByKey(left.rows, leftCols);

  const blankRight: Row = {};
  right.columns.forEach((c) => {
    if (!rightKeySet.has(c.name)) blankRight[leftNameSet.has(c.name) ? `${c.name}_right` : c.name] = null;
  });

  const outRows: Row[] = [];
  const matchedRightIdx = new Set<number>();

  for (const lrow of left.rows) {
    const k = keyOf(lrow, leftCols);
    const rightIdxs = rightMap.get(k);
    if (rightIdxs && rightIdxs.length > 0) {
      for (const ri of rightIdxs) {
        matchedRightIdx.add(ri);
        const rrow = right.rows[ri];
        const merged: Row = { ...lrow };
        right.columns.forEach((c) => {
          if (rightKeySet.has(c.name)) return;
          const outName = leftNameSet.has(c.name) ? `${c.name}_right` : c.name;
          merged[outName] = rrow[c.name];
        });
        outRows.push(merged);
      }
    } else if (joinType === 'left' || joinType === 'full') {
      outRows.push({ ...lrow, ...blankRight });
    }
  }

  if (joinType === 'right' || joinType === 'full') {
    const blankLeft: Row = {};
    left.columns.forEach((c) => {
      if (!leftCols.includes(c.name)) blankLeft[c.name] = null;
    });
    for (let ri = 0; ri < right.rows.length; ri++) {
      if (matchedRightIdx.has(ri)) continue;
      const rrow = right.rows[ri];
      const merged: Row = { ...blankLeft };
      keys.forEach(({ left: l, right: r }) => {
        merged[l] = rrow[r];
      });
      right.columns.forEach((c) => {
        if (rightKeySet.has(c.name)) return;
        const outName = leftNameSet.has(c.name) ? `${c.name}_right` : c.name;
        merged[outName] = rrow[c.name];
      });
      outRows.push(merged);
    }
  }

  const columns = mergeColumns(left, right, rightKeySet);
  return {
    columns,
    rows: outRows,
    meta: { name: `${left.meta.name}_${right.meta.name}_merged`, importedAt: Date.now() },
  };
}

export function joinToOpResult(left: Dataset, right: Dataset, keys: JoinKeyPair[], joinType: JoinType): OpResult {
  const dataset = performJoin(left, right, keys, joinType);
  const on =
    keys.every((k) => k.left === k.right)
      ? `on=${JSON.stringify(keys.map((k) => k.left))}`
      : `left_on=${JSON.stringify(keys.map((k) => k.left))}, right_on=${JSON.stringify(keys.map((k) => k.right))}`;
  const pandasHow = joinType === 'full' ? 'outer' : joinType;
  return {
    dataset,
    label: `Merged "${right.meta.name}" into "${left.meta.name}" using ${joinType} join (${dataset.rows.length} rows)`,
    code: `df = df_a.merge(df_b, how="${pandasHow}", ${on}, suffixes=("", "_right"))`,
  };
}

// ---------- Append / concatenate ----------

export interface AppendPreview {
  commonColumns: string[];
  onlyInFirst: string[];
  onlyInSecond: string[];
  totalRows: number;
}

export function computeAppendPreview(datasets: Dataset[]): AppendPreview {
  if (datasets.length === 0) return { commonColumns: [], onlyInFirst: [], onlyInSecond: [], totalRows: 0 };
  const columnSets = datasets.map((d) => new Set(d.columns.map((c) => c.name)));
  const all = new Set<string>();
  columnSets.forEach((s) => s.forEach((c) => all.add(c)));
  const common = [...all].filter((c) => columnSets.every((s) => s.has(c)));
  const first = columnSets[0];
  const onlyInFirst = [...first].filter((c) => !columnSets.slice(1).every((s) => s.has(c)));
  const restUnion = new Set<string>();
  columnSets.slice(1).forEach((s) => s.forEach((c) => restUnion.add(c)));
  const onlyInSecond = [...restUnion].filter((c) => !first.has(c));
  return {
    commonColumns: common,
    onlyInFirst,
    onlyInSecond,
    totalRows: datasets.reduce((sum, d) => sum + d.rows.length, 0),
  };
}

export function appendDatasets(datasets: Dataset[], name: string): OpResult {
  const all = new Set<string>();
  datasets.forEach((d) => d.columns.forEach((c) => all.add(c.name)));
  const columnOrder = [...all];
  const columns: ColumnMeta[] = columnOrder.map((name) => {
    const source = datasets.find((d) => d.columns.some((c) => c.name === name));
    const meta = source?.columns.find((c) => c.name === name);
    return { name, type: meta?.type ?? 'string', inferred: true };
  });
  const rows: Row[] = [];
  datasets.forEach((d) => {
    d.rows.forEach((r) => {
      const row: Row = {};
      columnOrder.forEach((c) => {
        row[c] = (r[c] ?? null) as CellValue;
      });
      rows.push(row);
    });
  });
  return {
    dataset: { columns, rows, meta: { name, importedAt: Date.now() } },
    label: `Appended ${datasets.length} datasets (${rows.length} total rows)`,
    code: `df = pd.concat([${datasets.map((_, i) => `df_${i + 1}`).join(', ')}], ignore_index=True)`,
  };
}
