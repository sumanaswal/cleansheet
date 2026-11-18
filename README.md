# CleanSheet

A browser-based spreadsheet cleaning tool for office employees who work with Excel and CSV files. It is designed to run entirely on your own computer, with no account and no server.

**Status:** under development. You can open an XLSX or CSV file, see a summary of it, browse its data and see a data quality overview. Cleaning and export are being built phase by phase. See `DEVELOPMENT_LOG.md` for what is done.

## Requirements

- Windows 11 (other systems are untested)
- Node.js and npm (developed on Node 24.19.0 and npm 11.17.0)
- A modern browser such as Chrome or Edge

## Setup

```powershell
npm install
npm run dev
```

Then open http://localhost:5173/ in your browser.

`npm install` also installs SheetJS from the tarball in `vendor/`. The `xlsx` package on the npm registry is outdated and has known vulnerabilities, which is why it is not used (see `DEVELOPMENT_LOG.md`).

## Limits (initial, not yet validated by testing)

10 MB per file, 50,000 data rows and 100 columns. One worksheet is cleaned at a time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests when files change |
| `node scripts/make-test-files.mjs` | Generate test spreadsheets in `private-data/` |

## Project structure

- `src/engine/` is the spreadsheet logic, plain TypeScript with no React. It must not import UI code (enforced by ESLint).
- `src/workers/` is the background worker that reads files, so the page stays responsive.
- `src/components/`, `src/pages/`, `src/hooks/` are the interface.
- `vendor/` holds the SheetJS tarball.
- `scripts/` holds the test file generator.
- Tests sit next to the code they test.

## Privacy

CleanSheet is designed to process spreadsheets inside the browser. This design intent has not yet been verified by network inspection (planned for Phase 8), so no stronger claim is made here. Do not commit real spreadsheets: use the git-ignored `private-data/` folder for your own test files.

## Other documents

- `ARCHITECTURE.md`: how the code is organised
- `DEVELOPMENT_LOG.md`: completed phases and decisions
- `TESTING.md`: how to test, and what is not tested yet
- `KNOWN_ISSUES.md`: open problems and limitations