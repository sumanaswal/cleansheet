// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ImportError } from '@/engine/io/types'
import {
    DEFAULT_DUPLICATE_OPTIONS,
    type DuplicateOptions,
} from '@/engine/operations/duplicates'
import { OperationError } from '@/engine/operations/types'
import { csvBuffer } from '@/test/files'
import { HandlerWorker } from '@/test/handlerWorker'
import { createImportClient } from '@/workers/importClient'
import type { OperationSpec } from '@/workers/protocol'

function duplicates(overrides: Partial<DuplicateOptions> = {}): OperationSpec {
    return {
        kind: 'duplicates',
        options: { ...DEFAULT_DUPLICATE_OPTIONS, ...overrides },
    }
}

// Row numbers 2 to 6: A, B, A, C, A
const DUP_CSV = 'v\nA\nB\nA\nC\nA'

function newClient() {
    return createImportClient(() => new HandlerWorker())
}

describe('import client: operations', () => {
    it('previews, highlights and applies an operation', async () => {
        const client = newClient()
        await client.importFile('data.csv', csvBuffer(DUP_CSV))

        const summary = await client.previewOperation(duplicates())
        expect(summary.removedRows).toBe(2)
        expect(summary.retainedRows).toBe(3)

        const marked = await client.getPage(0, 10)
        expect(marked.marks).toEqual(['keep', null, 'remove', null, 'remove'])

        const result = await client.applyOperation(duplicates())
        expect(result.removedRows).toBe(2)
        expect(result.summary.rowCount).toBe(3)
        expect(result.historyDepth).toBe(1)

        const after = await client.getPage(0, 10)
        expect(after.rows.map((row) => row.sourceRow)).toEqual([2, 3, 5])
        expect(after.marks).toBeUndefined()
        expect((await client.getProfile()).duplicateRows).toBe(0)
    })

    it('lists the affected records and forgets them when the preview is cleared', async () => {
        const client = newClient()
        await client.importFile('data.csv', csvBuffer(DUP_CSV))
        await client.previewOperation(duplicates())

        const records = await client.getPreviewPage(0, 10)
        expect(records.itemCount).toBe(2)
        expect(records.items.map((item) => item.row.sourceRow)).toEqual([4, 6])
        expect(records.items.map((item) => item.keptSourceRow)).toEqual([2, 2])

        await client.clearPreview()
        await expect(client.getPreviewPage(0, 10)).rejects.toBeInstanceOf(
            OperationError,
        )
    })

    it('rejects with an OperationError when the settings cannot be used', async () => {
        const client = newClient()
        await client.importFile('data.csv', csvBuffer(DUP_CSV))
        const error = client.previewOperation(duplicates({ columnIds: [] }))
        await expect(error).rejects.toBeInstanceOf(OperationError)
        await expect(
            client.applyOperation(duplicates({ columnIds: [] })),
        ).rejects.toThrow('Choose at least one column to compare.')
    })

    it('rejects when nothing is loaded', async () => {
        const client = newClient()
        await expect(client.previewOperation(duplicates())).rejects.toBeInstanceOf(
            ImportError,
        )
        await expect(client.applyOperation(duplicates())).rejects.toThrow(
            'No spreadsheet is loaded.',
        )
    })
})