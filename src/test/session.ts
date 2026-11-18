import { vi } from 'vitest'

import type { DatasetProfile } from '@/engine/profiling/types'
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

/** A profile with distinct figures, so tests can tell them apart. */
export function makeProfile(
    overrides: Partial<DatasetProfile> = {},
): DatasetProfile {
    return {
        totalRows: 1234,
        totalColumns: 3,
        duplicateRows: 12,
        missingCells: 30,
        emptyRows: 4,
        emptyColumns: 1,
        negativeNumbers: 7,
        columns: [
            {
                id: 'c1',
                name: 'Name',
                position: 1,
                type: 'text',
                missingCount: 10,
                placeholderCount: 2,
                exceptionCount: 0,
                negativeCount: 0,
                hasIssues: true,
            },
            {
                id: 'c2',
                name: 'Name',
                position: 2,
                type: 'numberText',
                missingCount: 0,
                placeholderCount: 0,
                exceptionCount: 4,
                negativeCount: 0,
                hasIssues: true,
            },
            {
                id: 'c3',
                name: 'Qty',
                position: 3,
                type: 'number',
                missingCount: 0,
                placeholderCount: 0,
                exceptionCount: 0,
                negativeCount: 7,
                hasIssues: false,
            },
        ],
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
        getProfile: vi.fn().mockResolvedValue(makeProfile()),
        previewOperation: vi.fn().mockResolvedValue({
            totalRows: 0,
            removedRows: 0,
            retainedRows: 0,
            skippedRows: 0,
            itemCount: 0,
        }),
        getPreviewPage: vi
            .fn()
            .mockResolvedValue({ offset: 0, items: [], itemCount: 0 }),
        clearPreview: vi.fn().mockResolvedValue(undefined),
        applyOperation: vi.fn().mockResolvedValue({
            summary: makeSummary(),
            removedRows: 0,
            historyDepth: 0,
        }),
        ...overrides,
    }
}