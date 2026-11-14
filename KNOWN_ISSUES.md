# CleanSheet Known Issues

## Open

### 1. npm audit reports 12 vulnerabilities in development tooling only

- 12 findings (2 low, 10 moderate) as of the end of Phase 1.
- Two dependency chains: `minimatch` through `typescript-eslint` (linting), and `deepmerge`, `ts-morph` and `minimatch` through the `shadcn` command-line tool.
- All are development tools that run on the developer's computer and are not part of the production bundle.
- `npm audit --omit=dev` reports 0 vulnerabilities. A search of the built JavaScript found none of the affected packages.
- Do not run `npm audit fix --force`: it proposes downgrading `shadcn` to 1.0.0 and `typescript-eslint` to 8.36.0.
- Action: re-run `npm audit` and `npm audit --omit=dev` before the Phase 9 release, and update the tooling if patched versions exist.

### 2. Dependency licenses not yet audited

- The `cn` package is newer and less established than `clsx` and `tailwind-merge`.
- Licenses were recorded from general knowledge and package metadata only.
- Action: full license audit in Phase 9.

### 3. No browser Back button or bookmarks between pages

- Navigation uses React state, not a router. Refreshing the browser returns to the Dashboard.
- Accepted for the local MVP. Revisit before commercialization.

### 4. Favicon is a placeholder

- A simple checkmark drawn for the project. Replace with a real logo before any public release.

### 5. Responsive layout tested on a resized desktop window only

- Real tablet and phone testing is still to do (Phase 8).

## Resolved

- ESLint `react-refresh/only-export-components` error in the shadcn `button.tsx`: resolved with a folder-scoped rule exception.
- Unused Vite template files (`App.css`, `src/assets`, `public/icons.svg`): deleted in Phase 2.
- Template `README.md`: replaced in Phase 2.