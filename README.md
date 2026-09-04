# Tidy

**Clean your data. Trust your analysis.**

Tidy is a browser-based data cleaning and preparation tool for researchers, students, analysts, and data scientists. Upload a dataset, inspect it, clean it, transform it, merge it with another dataset, validate it against rules you define, and export the result — all without a backend. Your files never leave your browser.

Workflow: **Upload → Inspect → Clean → Transform → Merge → Validate → Export**

## Features

- Import CSV, TSV, TXT, XLSX, XLS, and JSON
- Automatic column type inference and per-column data profiling
- A searchable, sortable, filterable spreadsheet-style table preview
- Row and column removal (empty, duplicate, constant, high-missing)
- Missing-value detection and filling (mean, median, mode, zero, custom, previous/next value)
- Duplicate row detection, including subset-based (by key column)
- Text cleaning (trim, case conversion, punctuation stripping, find & replace, regex)
- Category standardization via an editable value-mapping table
- Number cleaning (currency symbols, commas, percentages, rounding)
- Date cleaning (format standardization, extracting year/month/day/weekday)
- Data type conversion with an invalid-value preview before you commit
- Outlier detection (IQR and Z-score) with manual review before removal
- A visual filter builder (AND/OR, 11 comparison operators) and multi-column sort
- Column operations: rename, snake_case normalization, split, combine, reorder
- Dataset merging with inner/left/right/full joins, a merge preview, and
  warnings for duplicate keys, type mismatches, and unmatched records
- Append/concatenate multiple files, with mismatched-column detection
- A validation rule engine (ranges, uniqueness, email format, future-date checks, regex, not-null)
- A heuristic data quality score
- Full undo/redo/reset, with every step recorded as human-readable cleaning history
- One-click export of the cleaning history as a runnable pandas script
- Export to CSV, XLSX, JSON, TSV, TXT, or a Markdown table, plus a Markdown cleaning report
- Two built-in sample datasets (a messy roster and a matching results file) so you can try every panel immediately

Parquet export is not implemented — there is no browser-safe, dependency-light Parquet writer available client-side, so CSV or XLSX are the closest equivalents. If that changes, this is the first thing worth revisiting.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Testing

```bash
npm test
```

Tests cover the core data-processing logic: missing-value handling, duplicate detection, type conversion, filtering, sorting, joins (inner/left/full), duplicate-key detection, append, and Markdown export.

## Building for production

```bash
npm run build
```

This runs a TypeScript check and produces a static build in `dist/`, ready for any static host.

## Deploying to GitHub Pages

This repo ships with a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys automatically.

1. Push this repository to GitHub.
2. In your repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).
4. Your site will be published at `https://<your-username>.github.io/<repo-name>/`.

The workflow sets `TIDY_BASE` to your repository name automatically, so the Vite `base` path matches your Pages URL without any manual edits. If you'd rather deploy manually:

```bash
TIDY_BASE=<your-repo-name> npm run build
```

then upload the contents of `dist/` to your host of choice. If you're deploying to a custom domain or the root of a user/organization Pages site (`<username>.github.io`), set `TIDY_BASE=` (empty) so the base path is `/`.

## Privacy

Tidy processes every file locally in your browser using JavaScript. Nothing you upload — datasets, file names, or cleaning steps — is sent to a server. There is no backend, no authentication, and no database.

## Project structure

```
src/
├── components/     Reusable UI (Button, Table, Dialog, Alert, ...)
├── pages/          One file per top-level tab (Dashboard, Clean, Transform, Merge, Validate, Export)
├── lib/            Data-processing logic, kept separate from the UI
│   ├── parse.ts       File import (CSV/TSV/XLSX/JSON)
│   ├── infer.ts       Column type inference and coercion
│   ├── profile.ts     Dataset and column profiling
│   ├── clean.ts        Row/column removal, missing values, text/number/date cleaning, type conversion, outliers
│   ├── sort.ts         Sorting
│   ├── merge.ts         Joins, merge preview, append/concatenate
│   ├── validate.ts    Validation rule engine
│   ├── quality.ts      Heuristic quality score
│   ├── codegen.ts      Pandas script generation
│   └── exportData.ts   CSV/XLSX/JSON/TSV/TXT/Markdown export
├── hooks/          useDatasetStore — undo/redo state management
├── types/          Dataset data model
└── data/           Built-in sample datasets
```

Cleaning operations are pure functions: each takes a `Dataset` and returns a new one, plus a human-readable label and
the equivalent pandas snippet. Nothing is mutated in place, which is what makes undo/redo a simple stack of
snapshots rather than a change-tracking system.

## Technology

React, TypeScript, Vite, Tailwind CSS, PapaParse (CSV/TSV), SheetJS/xlsx (Excel).
