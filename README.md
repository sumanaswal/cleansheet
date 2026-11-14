# CleanSheet

A browser-based spreadsheet cleaning tool for office employees who work with Excel and CSV files. It is designed to run entirely on your own computer, with no account and no server.

**Status:** under development. The interface exists; spreadsheet import and cleaning are being built phase by phase. See `DEVELOPMENT_LOG.md` for what is done.

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests when files change |

## Project structure

- `src/engine/` is the cleaning logic, plain TypeScript with no React. It must not import UI code (enforced by ESLint).
- `src/components/`, `src/pages/`, `src/hooks/` are the interface.
- `src/workers/` is for background processing (Phase 3 onwards).
- Tests sit next to the code they test.

## Privacy

CleanSheet is designed to process spreadsheets inside the browser. This design intent has not yet been verified by network inspection (planned for Phase 8), so no stronger claim is made here.

## Other documents

- `DEVELOPMENT_LOG.md`: completed phases and decisions
- `KNOWN_ISSUES.md`: open problems and limitations