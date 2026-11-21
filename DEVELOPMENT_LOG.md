# CleanSheet Development Log

## Phase 0: Environment verification (2026-11-14)

- Node.js v24.19.0, npm 11.17.0, VS Code 1.146.0 (x64), Windows 11.
- 31 GB free on the S: drive. Project folder: `S:\cleansheet`.
- npm upgrade notice (11.17.0 to 12.2.2) deliberately ignored.

## Phase 1: Project foundation (2026-11-14)

Status: complete. Commits `742cf1e`, `b74c75e`.

### What was built

- Vite 8.3.8 + React 19 + TypeScript project (`react-ts` template, ESLint).
- Tailwind CSS v4 via `@tailwindcss/vite`.
- shadcn/ui initialised with Radix UI and the Nova preset. Only `Button` has been added so far.
- Vitest 5.1.0 with jsdom and React Testing Library. Tests live next to the code they test, inside `src/`, so they are covered by strict type-checking.
- Git repository on branch `main`.
- Folder skeleton: `src/engine/{profiling,operations,history,io}`, `src/workers`, `src/components/{ui,layout,workspace}`, `src/pages`, `src/hooks`, `src/lib`, `src/test`.

### Decisions

- **Strict TypeScript:** `strict`, `noUncheckedIndexedAccess` and `noImplicitReturns` are on. The Vite template did not enable `strict`.
- **Import alias:** `@/` maps to `src/` (set in `tsconfig.json`, `tsconfig.app.json` and `vite.config.ts`).
- **Architecture rule, enforced by ESLint:** files under `src/engine/` must not import React, components, pages, hooks or workers. Verified with a deliberate violation.
- **Fonts:** Geist is bundled locally through the `@fontsource-variable/geist` npm package. No external font requests. Confirmed by the `.woff2` files in the build output.
- **`cn` package:** the shadcn preset generated `src/lib/utils.ts` using the `cn` package (MIT per its package.json) instead of `clsx` + `tailwind-merge`. Kept. Fallback: switch back to `clsx` + `tailwind-merge` in that one file.
- **`shadcn` CLI package** moved to `devDependencies`. Confirmed that no code from its dependency chain appears in the production bundle.
- **ESLint:** `react-refresh/only-export-components` is turned off for `src/components/ui/**` only, because shadcn files export components plus style helpers.
- **Git:** `private-data/` and spreadsheets in the project root are ignored so that real data is never committed.

### Verified at end of Phase 1

- `npx tsc -b`: clean. `npm run lint`: clean. `npm test`: 2 of 2 pass. `npm run build`: succeeds.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Dev server runs at http://localhost:5173/ and the test page renders with Tailwind and the shadcn Button.

### Not yet done or verified

- Licenses of all dependencies (verified only from general knowledge so far). Scheduled for the Phase 9 audit.
- No spreadsheet library chosen yet. Decision, with license comparison, is due in Phase 3.
- Network behaviour (no spreadsheet data leaves the device) not yet verified. Scheduled for Phase 8.

## Phase 2: UI foundation (2026-11-14)

Status: complete (no spreadsheet processing yet, by design).

### What was built

- CleanSheet theme in `src/index.css`: white surfaces, navy primary, steel-blue focus ring and accents, blue-tinted neutrals. The unused shadcn `.dark` block is left in place and is never activated.
- Branding: tab title "CleanSheet" and a simple navy checkmark favicon (placeholder, to be replaced by a real logo later).
- App shell with a four-item navigation (Dashboard, Clean Spreadsheet, Data Quality, About / Help). Labels collapse to icons below 640 px.
- Dashboard: headline, upload area, six capability cards, privacy note and scope note.
- Cleaning workspace shell: operations panel, preview panel and settings panel.
- Data Quality page (empty state with the six planned figures) and About / Help page.
- Tests for navigation and for each page.

### Decisions

- **No router library.** The current page is held in React state in `App.tsx`. Trade-off: the browser Back button does not switch pages and pages cannot be bookmarked. `react-router` (MIT) can be added later with a small refactor.
- **Nothing is shown as working before it works.** The upload button and all 11 operation buttons are disabled, with notes explaining why. They are enabled in Phases 3 and 5.
- **Privacy wording says "designed to".** Stronger claims wait for the network inspection in Phase 8.
- **File size and row limits are not shown in the UI** until they are validated in Phase 3.
- **Mobile layout:** the spreadsheet preview is shown first on narrow screens, then the operations list, then the settings.

### Verified at end of Phase 2

- `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` pass.
- Navigation, active-tab highlighting and the icon-only mode on narrow windows confirmed by hand.

### Not yet done or verified

- Dependency licenses, spreadsheet library choice, network behaviour: unchanged from Phase 1.
- Dashboard and workspace layouts on real phones and tablets (only a resized desktop window was used).


## Phase 3: Spreadsheet import (2026-11-14 to 2026-11-17)

Status: complete. Informal timing and memory measurements are NOT recorded yet; they are scheduled for Phase 8.

### What was built

- **Data model** (`src/engine/types.ts`): stable column ids separate from names, rows as arrays aligned with the columns, `null` for empty cells, a `DateCell` type that keeps the raw Excel serial number plus Excel's displayed text, and a source row number on every row.
- **CSV importer** (`src/engine/io/csv.ts`): Papa Parse with every value kept as text. Encoding detection (UTF-8 with or without BOM, UTF-16 with BOM, otherwise Windows-1252 with a warning). Blank headers, short rows, long rows, trailing empty rows and unclosed quotes are handled and reported.
- **XLSX importer** (`src/engine/io/xlsx.ts`): reads one chosen worksheet. Finds the real data area instead of trusting the declared sheet size. Handles text, numbers, dates, booleans, formulas (last calculated value), Excel errors and merged cells, and reports each of these.
- **File validation** (`src/engine/io/validation.ts`): empty file, size, extension, file signature (ZIP versus old or password-protected Excel), row and column limits. Messages are written for end users.
- **Entry point** (`src/engine/io/importFile.ts`).
- **Web Worker** (`src/workers/`): a message protocol, a handler that owns the loaded dataset, a worker entry point and a promise-based client with cancel. The interface receives a summary and one page of rows at a time.
- **Interface**: working upload area, file summary card (name, size, format, rows, columns, notes about the import), worksheet selector, data table with a Row column, pagination at 100 rows per page.
- **Test file generator** (`scripts/make-test-files.mjs`) writing into the git-ignored `private-data/` folder.

### Decisions

- **SheetJS Community Edition 0.20.3 from SheetJS's own server, vendored.** The npm copy of `xlsx` is frozen at 0.18.5, which has two known high-severity advisories (prototype pollution and ReDoS) fixed in 0.20.2. The tarball is kept at `vendor/xlsx-0.20.3.tgz` and installed with `file:`.
  - License in the tarball's package.json: Apache-2.0. No runtime dependencies.
  - Size 2,409,319 bytes. SHA256 `8DC73FC3B00203E72D176E85B50938627C7B086E607C682E8D3C22C02BB99FE8`. This detects later changes only. It does not prove authenticity, because no published checksum from SheetJS was found to compare against.
  - Alternative to test another time: `read-excel-file` with `write-excel-file` (MIT, normal npm distribution, unknown behaviour for raw serial dates and formatted text).
- **Papa Parse for CSV**, with number conversion off so IDs, zeros and `=` values stay text. MIT per package metadata checked at install time.
- **Leading-zero numbers (Option 1):** an Excel number formatted with only zeros (such as `00000`) is imported as text (`00123`) and counted in the import notes. Other number formats stay plain numbers. This was confirmed by reply "d" and not by an explicit choice, so it can be changed.
- **Dates:** an Excel cell is a date when its number format is a date or time format. Text that looks like a date is never converted, in either format.
- **Limits (initial, unvalidated):** 10 MB, 50,000 data rows (header excluded), 100 columns. Shown on the upload area from the same constants the validation uses.
- **The dataset never leaves the worker.** The interface gets a summary and pages of at most 500 rows (the interface asks for 100).
- **A failed import keeps the previous spreadsheet.** Cancelling stops the worker, which discards the loaded data too.
- **No percentage progress for imports.** Parsing is one synchronous call, so a busy indicator is shown and no percentage is invented.
- **Unexpected errors show a generic message and are not logged,** because an error message could contain spreadsheet content.
- **Numbers in the table appear as stored,** without Excel's number formatting. Dates and zero-padded IDs carry their displayed text.
- **No router library.** Unchanged from Phase 2.

### Verified

- `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` pass (as reported by the developer at each step).
- `npm audit --omit=dev` reported 0 vulnerabilities before SheetJS and Papa Parse were added. Re-run before release (see KNOWN_ISSUES.md).
- Library behaviour that the engine depends on is pinned by tests in `src/engine/io/xlsx-library.test.ts`.
- The upload, rejection messages, worksheet switching, data table and pagination were tried by hand in the browser with the generated test files.

### Not yet done or verified

- Time and memory for large files (25,000 and 50,000 rows). Not measured.
- Network behaviour (that no spreadsheet data leaves the device). Phase 8.
- Dependency license audit. Phase 9.
- Tests use a stand-in for the Web Worker. The real worker has only been exercised by hand.
- Behaviour with hidden worksheets, hidden rows and filtered rows in XLSX files. Not tested.
- Option B library comparison. Deferred by the developer.


## Phase 4: Data profiling (2026-11-17 to 2026-11-18)

Status: complete. Timing and memory for large files are NOT measured yet (Phase 8).

### What was built

- **Profiling engine** (`src/engine/profiling/`): `profileDataset()` makes one pass over a dataset and returns the totals plus one profile per column. It only reads the data and never changes it (checked by a test).
  - `missing.ts`: what counts as missing, and the list of possible placeholders.
  - `columnType.ts`: classifies each value, then decides each column's type.
  - `negative.ts`: what counts as a negative number.
  - `profile.ts`: the single pass.
- **Worker support:** new `getProfile` request and `profile` reply. The worker computes the profile the first time it is asked for, keeps it, and forgets it when a different file loads or the data is cleared.
- **Data Quality page:** seven summary figures (total rows, total columns, duplicate rows, missing cells, empty rows, empty columns, negative numbers), a column table (position, name, detected type, missing, possible placeholders, exceptions, negative, status) and a short "How these are counted" section. "Analyzing…" is shown while the worker computes.
- **Hooks:** `useDatasetProfile` never shows the profile of a previous file and ignores replies that arrive late.

### Definitions (decided by the developer)

1. **Missing cell:** an empty cell or one holding only whitespace. Zero, false and text such as N/A are not missing. Possible placeholders (n/a, na, #n/a, null, nil, none, nan, a lone - and --, ignoring case) are listed per column and not counted as missing.
2. **Duplicate row:** identical to an earlier row in every column. Exact match: case, spaces and number-versus-text all matter. Fully empty rows count as empty rows and never as duplicates.
3. **Empty row or column:** every cell (for a column, every data cell, ignoring the header) is missing. A header-only file therefore reports every column as empty.
4. **Column types:** Text, Number, Date (an Excel date cell), Boolean, Mixed, Empty, plus Number stored as text, Date stored as text and ID-like text (leading zeros). A column gets a type when at least 90% of its values fit; the rest are counted as exceptions; otherwise it is Mixed. Dates stored as text are flagged and never interpreted.
5. **Page contents:** the figures and the column table. Showing the actual rows is left for Phase 5.

Decisions made beyond those five:
- Placeholders are left out of type detection and reported separately. A column holding only placeholders is Text, not Empty.
- One value with leading zeros is enough to label a column ID-like, because converting it to numbers would lose the zeros.
- Text counts as date-like only if its shape is a plausible date (13/13/2026 and 2026-04-32 do not). Nothing is interpreted.
- The 90% test uses whole-number arithmetic.
- A column is marked "Worth checking" when it has missing cells, placeholders or exceptions, or is Mixed, Empty, Number stored as text or Date stored as text. ID-like text alone is not marked.
- The profile is computed when the Data Quality page first needs it, and not right after import. The worker remembers it.
- **Negative numbers (added at the developer's request):** number cells below zero, and text that is clearly a negative number (-12, -1,250.50). Shown as a seventh figure and a column, as information only. They never mark a column as worth checking, because negatives are often correct. Zero, a lone dash and amounts in brackets such as (500) are not counted. The developer asked for a tab; a figure and a column were chosen instead, to avoid building a "show these rows" view that Phase 5 needs anyway. The developer accepted this.

### Verified

- `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` pass.
- The figures for `csv-100.csv` and `mixed-types.xlsx` were checked by hand against values worked out from the generator and matched, as reported by the developer.

### Not yet done or verified

- Time to analyze 25,000 and 50,000-row files, and memory use during duplicate detection (see KNOWN_ISSUES.md).
- Behaviour on real-world files with unusual number and date text formats.


## Phase 5, module 1: Remove duplicates (2026-11-18 to 2026-11-21)

Status: complete. Timing and memory for large files are NOT measured yet (Phase 8).

### What was built

- **Engine** (`src/engine/operations/duplicates.ts`): `planDuplicateRemoval` (the preview stage, changes nothing) and `removeDuplicates` (the apply stage). Row matching lives in the shared `src/engine/cellKey.ts`, which the profiler also uses, so the Data Quality "Duplicate rows" figure and this operation cannot disagree (a test checks it).
- **Worker** (`src/workers/`): new requests `previewOperation`, `getPreviewPage`, `clearPreview`, `applyOperation`. The preview is kept in the worker. Apply recalculates from the settings and never trusts a stored preview. Rows come back with a mark per row (`remove` or `keep`) while a preview exists, in the same reply as the rows.
- **Screen**: a Remove duplicates panel with column choice, keep first or last, matching options, a Preview button, counts, a paged list of the rows that would go (each with the row that stays), highlights in the table, Apply and Cancel.
- **Version history in the worker**: each effective apply stores the previous dataset, up to 10. Unchanged rows are shared between versions. There is no Undo button yet (Phase 6).

### Decisions (accepted by the developer)

1. History groundwork now, buttons in Phase 6.
2. The Row column keeps the original file's numbers, so removed rows leave gaps.
3. The preview shows exact counts, a paged list of affected records and highlights in the table.
4. Rules: with all columns, fully empty rows are never duplicates. With selected columns, a row with any chosen column missing is never compared (so two blank phone numbers are not a match). Matching is exact by default. Optional: ignore case, ignore extra spaces (text only: numbers, dates and true/false are never altered, and the number 1 still differs from the text "1"). Keep first or last leaves the kept row where it is and never reorders.

Smaller decisions:
- With "ignore extra spaces" on, a whitespace-only cell counts as an empty cell.
- The preview is a button and not live, so changing a setting does not make a large file recalculate on every click. Any change to a setting discards the preview and its highlights, and Apply stays disabled until the preview matches the settings.
- A failed preview discards the previous one, so stale highlights cannot survive a bad setting.
- Applying discards the stored profile and preview, and the summary is a new object, so the table and the Data Quality page reload on their own.
- An apply that changes nothing adds no history entry and keeps the profile.
- The panel states that Apply cannot be undone yet. Choosing another worksheet warns that it discards cleaning.

### Verified

- `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` pass.
- The developer tried the duplicate screen by hand with a generated file with known duplicates, and reported that it worked.

### Not yet done or verified

- Time to preview and apply on 25,000 and 50,000-row files, and memory with up to 10 stored versions.
- The real Web Worker handles the new messages: only the stand-in is covered by automated tests.