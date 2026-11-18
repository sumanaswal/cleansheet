# CleanSheet Architecture

This describes what exists now (end of Phase 3). Parts that are planned but not built are marked as planned.

## Principles

- Spreadsheet data is processed inside the browser. There is no backend. This is the design intent, and network behaviour has not yet been verified (planned for Phase 8).
- Data integrity comes before appearance: no silent changes, and everything the importer had to interpret is reported to the user.
- The cleaning engine is plain TypeScript with no React and no browser APIs. ESLint fails the build if code under `src/engine/` imports React or any UI, page, hook or worker code.

## Layers

```
src/engine/       Pure TypeScript. Data model, importers, validation, profiling (cleaning operations are planned).
src/workers/      Web Worker, message protocol, promise client. Imports the engine.
src/hooks/        React hooks that connect the interface to the worker client.
src/components/   Interface components.
src/pages/        The four screens.
```

Dependencies point one way: pages, then components and hooks, then the worker client, then the engine. The engine knows nothing about the layers above it.

## Data model (`src/engine/types.ts`)

- `Dataset` = `columns` plus `rows`. Treated as immutable: operations will return a new dataset.
- `Column` has a stable `id` (`c1`, `c2`, ...) assigned at import, and a `name`. Names can be duplicated or generated, so ids are the identity.
- `Row` has `sourceRow` (the row number in the source sheet, header included) and `cells`, aligned with `columns`.
- `CellValue` = `string | number | boolean | null | DateCell`. `null` is an empty cell. A `DateCell` carries the raw Excel serial number and Excel's displayed text, so serial dates stay distinct from text dates.

## Import pipeline

```
File (browser)
  → first 8 bytes read, validateFile()          type, size, signature   (cheap, before reading the file)
  → whole file read into an ArrayBuffer
  → transferred to the worker (not copied)
  → importFile()                                 inside the worker
       CSV:  decodeCsvBytes → parseCsvText       Papa Parse, everything stays text
       XLSX: importXlsxSheet                     SheetJS, one worksheet
  → validateDatasetLimits()
  → handler keeps the Dataset, replies with a DatasetSummary (no rows)
  → interface asks for pages of rows (100 at a time)
```

Limits live in `IMPORT_LIMITS` (`src/engine/io/validation.ts`) and are shown in the interface from the same constants.

## Worker (`src/workers/`)

- `protocol.ts`: request and response types. Requests are `import`, `getPage`, `getProfile` and `clear`. Responses are `imported`, `page`, `profile`, `cleared` and `error`.
- `importHandler.ts`: `createImportHandler()` returns a function from request to response and owns the loaded dataset. It contains no browser code, so tests run it directly. Page requests are clamped (offset at least 0, limit between 1 and 500). The profile is computed the first time it is requested and kept until the data changes.
- `import.worker.ts`: connects the handler to the browser's messaging.
- `importClient.ts`: turns messages into promises. `cancel()` stops the worker, which discards the loaded data and rejects every waiting request. The next request starts a fresh worker.
- `browserImportClient.ts`: creates the real `Worker`.

The loaded dataset exists only inside the worker. The interface holds a summary and the rows of the current page.

## Interface state

- `useSpreadsheetSession` (in `App`) holds the loaded summary, status and error, and exposes `loadFile`, `selectSheet`, `reset` and `getPage`. It keeps the `File` handle so another worksheet can be read.
- `usePagedRows` loads one page at a time and ignores replies that arrive after the user moved on. When the loaded data changes it returns to page 1 and never shows rows from the previous data.

## Data profiling (`src/engine/profiling/`)

`profileDataset(dataset)` reads a dataset once and returns a `DatasetProfile`: the totals (rows, columns, duplicate rows, missing cells, empty rows, empty columns, negative numbers) and one `ColumnProfile` per column (type, missing, possible placeholders, exceptions, negatives, and whether the column is worth checking). It never changes the dataset.

- `missing.ts` defines a missing cell and the possible-placeholder list. Cleaning operations will reuse these definitions, so what the overview counts and what an operation touches cannot disagree.
- `columnType.ts` classifies each value, then picks a column type when at least 90% of the values fit.
- `negative.ts` defines a negative number.
- Duplicate detection compares a text key built from every cell of a row. The key keeps number-versus-text, case and spaces distinct.

The interface asks for the profile through `getProfile`. `useDatasetProfile` never shows the profile of earlier data.

## Planned and not built

- Cleaning operations (Phase 5), undo and redo (Phase 6), export (Phase 7)
- Undo history is planned as stored changes or shared unchanged rows, with a capped length, not full copies. This has not been designed in detail or measured.