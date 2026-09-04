import { useMemo, useState } from 'react';
import type { Dataset } from '../types/dataset';
import { isMissing } from '../types/dataset';
import { Badge, Button, inputClass } from './ui';
import { formatNumber } from '../utils/format';

const PAGE_SIZE = 50;
const LARGE_DATASET_THRESHOLD = 20000;

interface DataTableProps {
  dataset: Dataset;
  selectedRows?: Set<number>;
  onSelectedRowsChange?: (rows: Set<number>) => void;
}

export function DataTable({ dataset, selectedRows, onSelectedRowsChange }: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const visibleColumns = dataset.columns.filter((c) => !hiddenCols.has(c.name));

  const filteredIndices = useMemo(() => {
    let indices = dataset.rows.map((_, i) => i);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      indices = indices.filter((i) =>
        visibleColumns.some((c) => String(dataset.rows[i][c.name] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortCol) {
      indices = [...indices].sort((a, b) => {
        const av = dataset.rows[a][sortCol];
        const bv = dataset.rows[b][sortCol];
        if (isMissing(av) && isMissing(bv)) return 0;
        if (isMissing(av)) return 1;
        if (isMissing(bv)) return -1;
        let cmp: number;
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return indices;
  }, [dataset, search, sortCol, sortDir, visibleColumns]);

  const totalPages = Math.max(1, Math.ceil(filteredIndices.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageIndices = filteredIndices.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const toggleRow = (i: number) => {
    if (!onSelectedRowsChange || !selectedRows) return;
    const next = new Set(selectedRows);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onSelectedRowsChange(next);
  };

  const toggleAllOnPage = () => {
    if (!onSelectedRowsChange || !selectedRows) return;
    const allSelected = pageIndices.every((i) => selectedRows.has(i));
    const next = new Set(selectedRows);
    pageIndices.forEach((i) => (allSelected ? next.delete(i) : next.add(i)));
    onSelectedRowsChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search rows…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className={`${inputClass} w-56`}
          aria-label="Search rows"
        />
        <div className="relative">
          <Button size="sm" onClick={() => setShowColumnPicker((s) => !s)}>
            Columns ({visibleColumns.length}/{dataset.columns.length})
          </Button>
          {showColumnPicker && (
            <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-ink-200 bg-white p-2 shadow-card dark:bg-ink-900 dark:border-ink-700">
              {dataset.columns.map((c) => (
                <label key={c.name} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                  <input
                    type="checkbox"
                    checked={!hiddenCols.has(c.name)}
                    onChange={() => {
                      const next = new Set(hiddenCols);
                      if (next.has(c.name)) next.delete(c.name);
                      else next.add(c.name);
                      setHiddenCols(next);
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-ink-400">
          {formatNumber(filteredIndices.length)} of {formatNumber(dataset.rows.length)} rows
        </span>
        {dataset.rows.length > LARGE_DATASET_THRESHOLD && (
          <Badge tone="warn">Large dataset — showing {PAGE_SIZE} rows per page to stay responsive</Badge>
        )}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-md border border-ink-200 scrollbar-thin dark:border-ink-800">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-100 dark:bg-ink-800">
            <tr>
              {onSelectedRowsChange && (
                <th className="w-8 border-b border-ink-200 px-2 py-2 dark:border-ink-700">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on page"
                    checked={pageIndices.length > 0 && pageIndices.every((i) => selectedRows?.has(i))}
                    onChange={toggleAllOnPage}
                  />
                </th>
              )}
              {visibleColumns.map((c) => (
                <th
                  key={c.name}
                  className="cursor-pointer select-none whitespace-nowrap border-b border-ink-200 px-3 py-2 text-left font-medium text-ink-700 dark:border-ink-700 dark:text-ink-200"
                  onClick={() => toggleSort(c.name)}
                  aria-sort={sortCol === c.name ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1">
                    {c.name}
                    <span className="text-[10px] text-ink-400">{c.type}</span>
                    {sortCol === c.name && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageIndices.map((i) => (
              <tr
                key={i}
                className={selectedRows?.has(i) ? 'bg-moss-50 dark:bg-moss-900/20' : 'odd:bg-white even:bg-ink-50/60 dark:odd:bg-ink-900 dark:even:bg-ink-900/60'}
              >
                {onSelectedRowsChange && (
                  <td className="border-b border-ink-100 px-2 py-1.5 dark:border-ink-800">
                    <input type="checkbox" checked={!!selectedRows?.has(i)} onChange={() => toggleRow(i)} aria-label={`Select row ${i + 1}`} />
                  </td>
                )}
                {visibleColumns.map((c) => {
                  const v = dataset.rows[i][c.name];
                  return (
                    <td key={c.name} className="whitespace-nowrap border-b border-ink-100 px-3 py-1.5 font-mono text-xs text-ink-700 dark:border-ink-800 dark:text-ink-200">
                      {isMissing(v) ? <span className="italic text-ink-300 dark:text-ink-600">missing</span> : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">
            Page {clampedPage + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}>
              Previous
            </Button>
            <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={clampedPage >= totalPages - 1}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
