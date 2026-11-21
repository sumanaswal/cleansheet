# CleanSheet Known Issues

## Open

### 1. SheetJS is not covered by `npm audit`

- SheetJS 0.20.3 is installed from `vendor/xlsx-0.20.3.tgz`, so npm's advisory database does not track it.
- Action: before the Phase 9 release, check SheetJS's site for a newer release and for new advisories, and re-run the library behaviour tests in `src/engine/io/xlsx-library.test.ts` after any upgrade.
- The tarball's checksum is recorded in DEVELOPMENT_LOG.md. It detects later changes only.

### 2. npm audit reports vulnerabilities in development tooling only

- At the end of Phase 1: 12 findings (2 low, 10 moderate) in two chains, `minimatch` through `typescript-eslint` (linting) and `deepmerge`, `ts-morph` and `minimatch` through the `shadcn` command-line tool.
- They are development tools that run on the developer's computer and are not part of the production bundle. `npm audit --omit=dev` reported 0 vulnerabilities then, and a search of the built JavaScript found none of the affected packages.
- Do not run `npm audit fix --force`: it proposes downgrading `shadcn` to 1.0.0 and `typescript-eslint` to 8.36.0.
- Action: re-run `npm audit` and `npm audit --omit=dev` before the Phase 9 release. The numbers may have changed since Phase 3 added packages.

### 3. Large-file behaviour is unmeasured

- The community edition of SheetJS has no streaming, so a whole file is held in memory while it is read, and the loaded dataset stays in the worker.
- The 10 MB, 50,000-row and 100-column limits are initial proposals, not tested limits.
- Action: measure time and memory with the generated 5,000, 25,000 and 50,000-row files in Phase 8, then confirm or change the limits.

### 4. If the background worker crashes, the screen can show a file whose data is gone

- The worker holds the dataset. If it crashes, the screen can still show the file as loaded, and the data table shows an error asking the user to remove the file and upload it again.
- Accepted for now. Revisit when undo history is added in Phase 6.

### 5. Cancelling an import also discards an already loaded spreadsheet

- Stopping a parser that may be hung requires stopping the worker, which discards its data.

### 6. XLSX import limits

- The header is assumed to be the first row with content. There is no option to choose another row.
- Merged cells: only the top-left cell holds a value. This is reported in the import notes.
- Formulas are imported as their last calculated values. This is reported.
- Dates are recognised only through Excel's cell format. Dates stored as text stay text, in XLSX and CSV.
- Hidden worksheets, hidden rows and filtered rows are not treated specially. Untested.
- Only .xlsx is read. Older formats and password-protected files are rejected with an explanation.

### 7. CSV import limits

- UTF-16 is detected only when the file has a byte order mark. Files that are not valid UTF-8 are read as Windows-1252 with a warning.
- The delimiter is detected by Papa Parse and is not user-selectable.

### 8. Table display

- Numbers appear as stored, without Excel number formatting (for example 30010.5 and not 30,010.50).
- Long cell text is cut at 200 characters on screen. The full text (up to 1,000 characters) is in the tooltip. The data itself is not changed.

### 9. Dependency licenses not yet audited

- The `cn` package is newer and less established than `clsx` and `tailwind-merge`.
- Licenses of other packages were recorded from package metadata or general knowledge only.
- Action: full license audit in Phase 9.

### 10. No browser Back button or bookmarks between pages

- Navigation uses React state, not a router. Refreshing the browser discards the loaded spreadsheet and returns to the Dashboard.

### 11. Favicon is a placeholder

- A simple checkmark drawn for the project. Replace it before any public release.

### 12. Responsive layout tested on a resized desktop window only

- Real tablet and phone testing is still to do (Phase 8).

### 13. Tests use a stand-in for the Web Worker

- The engine, handler and client are tested without a browser. The real worker is only exercised by hand.
- Action: include the worker in the manual checks in Phase 8.

### 14. Profiling cost on large files is unmeasured

- Duplicate detection builds one text key per row and keeps them all in memory. For 50,000 rows by 100 columns that may be large.
- The profile runs on the worker's single thread. While it runs, requests for pages of rows wait behind it. The Data Quality page shows "Analyzing…" meanwhile.
- Action: measure time and memory with the generated 25,000 and 50,000-row files in Phase 8. If needed, switch to hashing the row keys or analyze in chunks.

### 15. Profile rules are fixed and some formats are not recognised

- The placeholder list is fixed: n/a, na, #n/a, null, nil, none, nan, - and --. Words like "NA" or "None" can be real data, which is why they are only reported and never counted as missing.
- Numbers stored as text are recognised with commas as thousands separators and a dot as the decimal point. Other styles (for example 1.234,50), percentages (5%), currency symbols (-$5) and a typographic minus sign are treated as plain text. Negative numbers written in those styles are not counted.
- Dates stored as text are recognised only by their shape (day or month first, year first, or with a month name). Nothing is interpreted, so 03/04/2026 is flagged as a date without deciding which part is the month.
- The 90% rule for column types is a chosen value and has not been tested on real files.



### 17. The Data Quality page shows counts but not the rows behind them

- It says how many duplicates, missing cells and negative numbers there are, but not where. The "show me these rows" view arrives with the Phase 5 previews.

### 18. No undo yet

- Apply cannot be reversed. The worker already keeps up to 10 earlier versions of the data, but nothing can use them until Phase 6.
- Until then the only way to start over is to upload the file again.

### 19. Choosing another worksheet discards cleaning

- Switching worksheets re-reads the file, so any cleaning applied to the first sheet is lost. The screen says so.

### 20. Preview and apply cost on large files is unmeasured

- Apply recalculates from the settings and does not reuse the preview, so a large file is analysed twice.
- Each stored version keeps its rows. Unchanged rows are shared, but operations that rewrite every row (column changes, text cleaning) will use more memory.
- Action: measure in Phase 8 with 25,000 and 50,000-row files, then set the real history limit.

### 21. Preview display limits

- Table highlights cover only the page being viewed, and the preview list shows the first six non-empty values of each record.
- The list shows records 20 at a time.

## Resolved

- ESLint `react-refresh/only-export-components` error in the shadcn `button.tsx`: resolved with a folder-scoped rule exception.
- Unused Vite template files (`App.css`, `src/assets`, `public/icons.svg`): deleted in Phase 2.
- Template `README.md`: replaced in Phase 2.
- The stored profile not refreshing after cleaning: resolved in Phase 5. Applying an operation discards the profile and the Data Quality page asks again (tested).