import { vi } from 'vitest'

import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import type { DatasetSummary } from '@/workers/protocol'

export function makeSummary(
    overrides: Partial<DatasetSummary> = {},
): DatasetSummary {
    return {
        source: { name: 'staff.csv', sizeBytes: 2048, format: 'csv' },
        sheetName: null,
        sheetNames: [],
        warnings: [],
        columns: [
            { id: 'c1', name: 'Name' },
            { id: 'c2', name: 'City' },
        ],
        rowCount: 1234,
        ...overrides,
    }
}

/** A session for page tests. Every action is a mock that does nothing. */
export function makeSession(
    overrides: Partial<SpreadsheetSession> = {},
): SpreadsheetSession {
    return {
        status: 'empty',
        summary: null,
        error: null,
        loadFile: vi.fn().mockResolvedValue(undefined),
        selectSheet: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn(),
        getPage: vi.fn().mockResolvedValue({ offset: 0, rows: [], rowCount: 0 }),
        ...overrides,
    }
}