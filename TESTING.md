# CleanSheet Testing

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs every test once |
| `npm run test:watch` | Re-runs tests when files change |
| `npx tsc -b` | Type-checks the whole project (strict mode) |
| `npm run lint` | Runs ESLint, including the rule that keeps the engine free of UI code |
| `npm run build` | Type-checks and builds for production |

Run all four after each change. All must pass before a commit.

## Where tests live

Tests sit next to the code they test, inside `src/`, so they are also type-checked under strict settings.

- `src/engine/` runs in plain Node (`// @vitest-environment node` at the top of the file). These cover CSV and XLSX import, file validation, the data model, and `xlsx-library.test.ts`, which pins the SheetJS behaviour the engine relies on: leading zeros, formatted numbers, raw date serial numbers, zero and false.
- `src/workers/` tests the request handler and the client. A stand-in for the browser Worker (`src/test/handlerWorker.ts`) runs the real handler directly. The real Worker is not covered by automated tests.
- `src/components/`, `src/pages/`, `src/hooks/` use React Testing Library with a simulated browser (jsdom).

## Test files for manual testing

```powershell
node scripts/make-test-files.mjs
```

This writes into `private-data/`, which git ignores. It creates:

- Valid files: `csv-100`, `csv-5000`, `csv-25000`, `csv-50000`, `xlsx-5000`, `xlsx-50000`, and `mixed-types.xlsx` (two worksheets, zero-padded numbers, date cells, formulas, a thousands format, zero, false and a whitespace-only cell).
- Files that must be rejected with a clear message: empty, wrong extension, a text file named .xlsx, an unclosed quote, too many rows, too many columns and too big.

Never put real or confidential spreadsheets anywhere that git tracks. Use `private-data/` for your own files.

## What has not been tested yet

- Time and memory with 25,000 and 50,000-row files (Phase 8).
- That no spreadsheet data leaves the device, checked in the browser's Network tab (Phase 8).
- Other browsers, tablets and phones (Phase 8).
- Hidden worksheets, hidden rows and filtered rows in XLSX files.
- The real Web Worker in automated tests.