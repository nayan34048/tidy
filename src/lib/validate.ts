import type { CellValue, Dataset } from '../types/dataset';
import { isMissing } from '../types/dataset';

export type ValidationRuleType =
  | 'range'
  | 'non_negative'
  | 'unique'
  | 'email'
  | 'not_future_date'
  | 'not_null'
  | 'regex';

export interface ValidationRule {
  id: string;
  column: string;
  type: ValidationRuleType;
  min?: number;
  max?: number;
  pattern?: string;
  label: string;
}

export interface RuleResult {
  rule: ValidationRule;
  invalidRowIndices: number[];
  validCount: number;
  invalidCount: number;
}

export interface ValidationReport {
  results: RuleResult[];
  totalRows: number;
  rowsWithIssues: number;
  validRows: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRuleViolated(value: CellValue, rule: ValidationRule): boolean {
  if (rule.type === 'not_null') return isMissing(value);
  if (isMissing(value)) return false; // other rules don't flag missing values (that's not_null's job)

  switch (rule.type) {
    case 'range': {
      const n = Number(value);
      if (!Number.isFinite(n)) return true;
      if (rule.min !== undefined && n < rule.min) return true;
      if (rule.max !== undefined && n > rule.max) return true;
      return false;
    }
    case 'non_negative': {
      const n = Number(value);
      return Number.isFinite(n) ? n < 0 : true;
    }
    case 'email':
      return !EMAIL_RE.test(String(value));
    case 'not_future_date': {
      const d = new Date(String(value));
      return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
    }
    case 'regex':
      try {
        return rule.pattern ? !new RegExp(rule.pattern).test(String(value)) : false;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function runValidation(ds: Dataset, rules: ValidationRule[]): ValidationReport {
  const results: RuleResult[] = rules.map((rule) => {
    if (rule.type === 'unique') {
      const seen = new Map<string, number[]>();
      ds.rows.forEach((r, i) => {
        if (isMissing(r[rule.column])) return;
        const k = String(r[rule.column]);
        const list = seen.get(k) ?? [];
        list.push(i);
        seen.set(k, list);
      });
      const invalidRowIndices: number[] = [];
      seen.forEach((idxs) => {
        if (idxs.length > 1) invalidRowIndices.push(...idxs);
      });
      return {
        rule,
        invalidRowIndices,
        validCount: ds.rows.length - invalidRowIndices.length,
        invalidCount: invalidRowIndices.length,
      };
    }
    const invalidRowIndices = ds.rows
      .map((r, i) => (isRuleViolated(r[rule.column], rule) ? i : -1))
      .filter((i) => i >= 0);
    return {
      rule,
      invalidRowIndices,
      validCount: ds.rows.length - invalidRowIndices.length,
      invalidCount: invalidRowIndices.length,
    };
  });

  const badRows = new Set<number>();
  results.forEach((r) => r.invalidRowIndices.forEach((i) => badRows.add(i)));

  return {
    results,
    totalRows: ds.rows.length,
    rowsWithIssues: badRows.size,
    validRows: ds.rows.length - badRows.size,
  };
}
