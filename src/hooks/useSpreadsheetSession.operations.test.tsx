import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DEFAULT_DUPLICATE_OPTIONS } from '@/engine/operations/duplicates'
import { useSpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import { csvBuffer, fakeFile } from '@/test/files'
import { HandlerWorker } from '@/test/handlerWorker'
import { createImportClient, ImportCancelledError } from '@/workers/importClient'
import type { OperationSpec } from '@/workers/protocol'

const DUPLICATES: OperationSpec = {
    kind: 'duplicates',
    options: DEFAULT_DUPLICATE_OPTIONS,
}

// Row numbers 2 to 6: A, B, A, C, A
const DUP_CSV = 'v\nA\nB\nA\nC\nA'

function setup() {
    const client = createImportClient(() => new HandlerWorker())
    return renderHook(() => useSpreadsheetSession(client)).result
}

async function loadDuplicates(result: ReturnType<typeof setup>) {
    const { file } = fakeFile('data.csv', csvBuffer(DUP_CSV))
    await act(async () => {
        await result.current.loadFile(file)
    })
}

describe('useSpreadsheetSession: operations', () => {
    it('previews an operation without changing the summary', async () => {
        const result = setup()
        await loadDuplicates(result)
        const before = result.current.summary

        const preview = await result.current.previewOperation(DUPLICATES)
        expect(preview.removedRows).toBe(2)
        const records = await result.current.getPreviewPage(0, 10)
        expect(records.itemCount).toBe(2)
        await result.current.clearPreview()

        expect(result.current.summary).toBe(before)
        expect(result.current.summary?.rowCount).toBe(5)
    })

    it('applies an operation and updates the summary with a new object', async () => {
        const result = setup()
        await loadDuplicates(result)
        const before = result.current.summary

        let removed = -1
        await act(async () => {
            removed = (await result.current.applyOperation(DUPLICATES)).removedRows
        })

        expect(removed).toBe(2)
        expect(result.current.status).toBe('ready')
        expect(result.current.summary?.rowCount).toBe(3)
        expect(result.current.summary).not.toBe(before)
        const page = await result.current.getPage(0, 10)
        expect(page.rows.map((row) => row.sourceRow)).toEqual([2, 3, 5])
        expect((await result.current.getProfile()).duplicateRows).toBe(0)
    })

    it('does not restore the summary if the data was removed while it was working', async () => {
        const result = setup()
        await loadDuplicates(result)

        const pending = result.current.applyOperation(DUPLICATES)
        const assertion = expect(pending).rejects.toBeInstanceOf(ImportCancelledError)
        act(() => {
            result.current.reset()
        })
        await assertion
        expect(result.current.summary).toBeNull()
        expect(result.current.status).toBe('empty')
    })

    it('passes a failed operation to the caller and keeps the data', async () => {
        const result = setup()
        await loadDuplicates(result)
        const badSettings: OperationSpec = {
            kind: 'duplicates',
            options: { ...DEFAULT_DUPLICATE_OPTIONS, columnIds: [] },
        }
        await expect(result.current.applyOperation(badSettings)).rejects.toThrow(
            'Choose at least one column to compare.',
        )
        expect(result.current.summary?.rowCount).toBe(5)
    })
})