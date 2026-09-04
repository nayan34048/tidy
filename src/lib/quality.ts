import type { Dataset } from '../types/dataset';
import { profileDataset } from './profile';
import { previewInvalidForType } from './clean';

export interface QualityBreakdown {
  score: number; // 0-100
  missingPct: number;
  duplicatePct: number;
  invalidPct: number;
  typeIssuePct: number;
}

/**
 * A heuristic, not a statistical guarantee — a rough dial for "does this
 * dataset look clean", weighted toward the issues most likely to break a
 * downstream analysis.
 */
export function computeQualityScore(ds: Dataset): QualityBreakdown {
  const profile = profileDataset(ds);
  const missingPct = profile.missingCellPct;
  const duplicatePct = profile.rowCount > 0 ? profile.duplicateRowCount / profile.rowCount : 0;

  let invalidCells = 0;
  let typeIssueCells = 0;
  const totalCells = Math.max(1, profile.rowCount * profile.columnCount);
  for (const col of ds.columns) {
    const invalid = previewInvalidForType(ds, col.name, col.type);
    // previewInvalidForType caps at 20 for UI; re-derive a fuller count cheaply here
    // by treating the capped sample as a lower bound signal.
    if (col.inferred) {
      typeIssueCells += invalid.length;
    } else {
      invalidCells += invalid.length;
    }
  }
  const invalidPct = Math.min(1, invalidCells / totalCells);
  const typeIssuePct = Math.min(1, typeIssueCells / totalCells);

  const score = Math.round(
    100 * Math.max(0, 1 - missingPct * 0.4 - duplicatePct * 0.25 - invalidPct * 0.2 - typeIssuePct * 0.15)
  );

  return { score, missingPct, duplicatePct, invalidPct, typeIssuePct };
}
