// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    DEFAULT_DUPLICATE_OPTIONS,
    type DuplicateOptions,
} from '@/engine/operations/duplicates'
import { csvBuffer } from '@/test/files'
import { createImportHandler } from '@/workers/importHandler'
import {
    MAX_HISTORY_DEPTH,
    type OperationSpec,
    type WorkerResponse,
} from '@/workers/protocol'

type Handler = ReturnType<typeof createImportHandler>

let lastId = 0
function nextId(): number {
    lastId += 1
    return lastId
}

function expectType<T extends WorkerResponse['type']>(
    response: WorkerResponse,
    type: T,
): Extract<WorkerResponse, { type: T }> {
    if (response.type !== type) {
        throw new Error(`Expected a "${type}" reply but got "${response.type}"`)
    }
    return response as Extract<WorkerResponse, { type: T }>
}

function duplicates(overrides: Partial<DuplicateOptions> = {}): OperationSpec {
    return {
        kind: 'duplicates',
        options: { ...DEFAULT_DUPLICATE_OPTIONS, ...overrides },
    }
}

function load(handle: Handler, text: string): void {
    expectType(
        handle({
            id: nextId(),
            type: 'import',
            fileName: 'data.csv',
            bytes: csvBuffer(text),
        }),
        'imported',
    )
}

function preview(handle: Handler, operation: OperationSpec): WorkerResponse {
    return handle({ id: nextId(), type: 'previewOperation', operation })
}

function previewPage(handle: Handler, offset: number, limit: number) {
    return handle({ id: nextId(), type: 'getPreviewPage', offset, limit })
}

function apply(handle: Handler, operation: OperationSpec): WorkerResponse {
    return handle({ id: nextId(), type: 'applyOperation', operation })
}

function page(handle: Handler) {
    return expectType(
        handle({ id: nextId(), type: 'getPage', offset: 0, limit: 10 }),
        'page',
    )
}

// Row numbers 2 to 6: A, B, A, C, A
const DUP_CSV = 'v\nA\nB\nA\nC\nA'
// Matching on c1, then c2, then c3 removes one more row each time.
const STAGES = 'a,b,c\nx1,y1,z1\nx1,y2,z2\nx2,y1,z3\nx3,y3,z1'

describe('operations in the worker: preview', () => {
    it('previews without changing the data', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        const { summary } = expectType(preview(handle, duplicates()), 'previewed')
        expect(summary).toEqual({
            totalRows: 5,
            removedRows: 2,
            retainedRows: 3,
            skippedRows: 0,
            itemCount: 2,
        })
        const after = page(handle)
        expect(after.rowCount).toBe(5)
        expect(after.rows.map((row) => row.sourceRow)).toEqual([2, 3, 4, 5, 6])
    })

    it('marks rows on pages while a preview exists and stops when it is cleared', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        expect(page(handle).marks).toBeUndefined()

        preview(handle, duplicates())
        expect(page(handle).marks).toEqual(['keep', null, 'remove', null, 'remove'])

        expectType(handle({ id: nextId(), type: 'clearPreview' }), 'previewCleared')
        expect(page(handle).marks).toBeUndefined()
    })

    it('lists the affected records a page at a time', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        preview(handle, duplicates())

        const first = expectType(previewPage(handle, 0, 1), 'previewPage')
        expect(first.itemCount).toBe(2)
        expect(first.items).toHaveLength(1)
        expect(first.items[0]?.row.sourceRow).toBe(4)
        expect(first.items[0]?.keptSourceRow).toBe(2)

        const second = expectType(previewPage(handle, 1, 10), 'previewPage')
        expect(second.items).toHaveLength(1)
        expect(second.items[0]?.row.sourceRow).toBe(6)
    })

    it('corrects an invalid offset and limit', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        preview(handle, duplicates())
        const result = expectType(
            previewPage(handle, -5, Number.NaN),
            'previewPage',
        )
        expect(result.offset).toBe(0)
        expect(result.items).toHaveLength(1)
    })

    it('reports an error when there is no preview to list', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        const error = expectType(previewPage(handle, 0, 10), 'error')
        expect(error.kind).toBe('operation')
        expect(error.message).toMatch(/no preview to show/)
    })

    it('reports an error when nothing is loaded', () => {
        const handle = createImportHandler()
        expect(expectType(preview(handle, duplicates()), 'error')).toMatchObject({
            kind: 'import',
            message: 'No spreadsheet is loaded.',
        })
        expect(expectType(apply(handle, duplicates()), 'error')).toMatchObject({
            kind: 'import',
            message: 'No spreadsheet is loaded.',
        })
    })

    it('removes the previous preview when a new one cannot be built', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        preview(handle, duplicates())

        const error = expectType(
            preview(handle, duplicates({ columnIds: [] })),
            'error',
        )
        expect(error.kind).toBe('operation')
        expect(error.message).toBe('Choose at least one column to compare.')
        expectType(previewPage(handle, 0, 10), 'error')
        expect(page(handle).marks).toBeUndefined()
    })
})

describe('operations in the worker: apply', () => {
    it('removes the duplicates and reports the new size', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        const { result } = expectType(apply(handle, duplicates()), 'applied')
        expect(result.removedRows).toBe(2)
        expect(result.summary.rowCount).toBe(3)
        expect(result.historyDepth).toBe(1)
        expect(page(handle).rows.map((row) => row.sourceRow)).toEqual([2, 3, 5])
    })

    it('keeps the last copy when asked', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        expectType(apply(handle, duplicates({ keep: 'last' })), 'applied')
        expect(page(handle).rows.map((row) => row.sourceRow)).toEqual([3, 5, 6])
    })

    it('discards the preview', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        preview(handle, duplicates())
        expectType(apply(handle, duplicates()), 'applied')
        expectType(previewPage(handle, 0, 10), 'error')
        expect(page(handle).marks).toBeUndefined()
    })

    it('works out the data quality profile again for the new data', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        const before = expectType(
            handle({ id: nextId(), type: 'getProfile' }),
            'profile',
        )
        expect(before.profile.duplicateRows).toBe(2)
        expect(before.profile.totalRows).toBe(5)

        expectType(apply(handle, duplicates()), 'applied')
        const after = expectType(
            handle({ id: nextId(), type: 'getProfile' }),
            'profile',
        )
        expect(after.profile.duplicateRows).toBe(0)
        expect(after.profile.totalRows).toBe(3)
    })

    it('keeps the file details and import notes in the new summary', () => {
        const handle = createImportHandler()
        load(handle, 'a,,c\n1,2,3\n1,2,3')
        const { result } = expectType(apply(handle, duplicates()), 'applied')
        expect(result.summary.source.name).toBe('data.csv')
        expect(result.summary.rowCount).toBe(1)
        expect(result.summary.columns.map((column) => column.name)).toEqual([
            'a',
            'Column 2',
            'c',
        ])
        expect(result.summary.warnings.join(' ')).toMatch(/no header/)
    })

    it('leaves everything alone when there is nothing to remove', () => {
        const handle = createImportHandler()
        load(handle, 'v\nA\nB')
        const { result } = expectType(apply(handle, duplicates()), 'applied')
        expect(result.removedRows).toBe(0)
        expect(result.historyDepth).toBe(0)
        expect(result.summary.rowCount).toBe(2)
    })

    it('leaves the data alone when the settings cannot be used', () => {
        const handle = createImportHandler()
        load(handle, DUP_CSV)
        const error = expectType(
            apply(handle, duplicates({ columnIds: [] })),
            'error',
        )
        expect(error.kind).toBe('operation')
        expect(page(handle).rowCount).toBe(5)
    })
})

describe('operations in the worker: version history', () => {
    it('keeps a limited number of earlier versions', () => {
        expect(MAX_HISTORY_DEPTH).toBe(10)
        const handle = createImportHandler(2)
        load(handle, STAGES)
        const depths = ['c1', 'c2', 'c3'].map(
            (id) =>
                expectType(apply(handle, duplicates({ columnIds: [id] })), 'applied')
                    .result.historyDepth,
        )
        expect(depths).toEqual([1, 2, 2])
        expect(page(handle).rows.map((row) => row.sourceRow)).toEqual([2])
    })

    it('starts the history again when a new file is imported', () => {
        const handle = createImportHandler()
        load(handle, STAGES)
        expect(
            expectType(apply(handle, duplicates({ columnIds: ['c1'] })), 'applied')
                .result.historyDepth,
        ).toBe(1)

        load(handle, DUP_CSV)
        expect(
            expectType(apply(handle, duplicates()), 'applied').result.historyDepth,
        ).toBe(1)
    })

    it('starts the history again when the data is cleared', () => {
        const handle = createImportHandler()
        load(handle, STAGES)
        expectType(apply(handle, duplicates({ columnIds: ['c1'] })), 'applied')
        expectType(handle({ id: nextId(), type: 'clear' }), 'cleared')
        expectType(apply(handle, duplicates()), 'error')
    })
})