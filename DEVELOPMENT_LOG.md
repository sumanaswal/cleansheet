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