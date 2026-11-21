// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { OperationError } from '@/engine/operations/types'
import { csvBuffer } from '@/test/files'
import { HandlerWorker } from '@/test/handlerWorker'
import { createImportClient } from '@/workers/importClient'
import type { OperationSpec } from '@/workers/protocol'

const CSV = ['Name,City', 'Asha,Delhi', ',Pune', 'Ravi,'].join('\n')

function fillAll(value: string): OperationSpec {
    return {
        kind: 'missing',
        options: { columnIds: ['c1', 'c2'], placeholders: [], action: { kind: 'fill', value } },
    }
}

describe('import client: missing values', () => {
    it('previews, marks the cells, lists them and applies the fill', async () => {
        const client = createImportClient(() => new HandlerWorker())
        await client.importFile('data.csv', csvBuffer(CSV))

        const summary = await client.previewOperation(fillAll('x'))
        expect(summary.missing).toMatchObject({ action: 'fill', filledCells: 2 })

        const marked = await client.getPage(0, 10)
        expect(marked.marks).toBeUndefined()
        expect(marked.cellMarks).toEqual([[], [0], [1]])

        const records = await client.getPreviewPage(0, 10)
        expect(records.itemCount).toBe(2)
        expect(records.items.map((item) => item.kind)).toEqual(['filledCell', 'filledCell'])

        const result = await client.applyOperation(fillAll('x'))
        expect(result.filledCells).toBe(2)
        expect(result.removedRows).toBe(0)

        const after = await client.getPage(0, 10)
        expect(after.cellMarks).toBeUndefined()
        expect(after.rows.map((row) => row.cells)).toEqual([
            ['Asha', 'Delhi'],
            ['x', 'Pune'],
            ['Ravi', 'x'],
        ])
        expect((await client.getProfile()).missingCells).toBe(0)
    })

    it('rejects with an OperationError when the settings cannot be used', async () => {
        const client = createImportClient(() => new HandlerWorker())
        await client.importFile('data.csv', csvBuffer(CSV))
        const noColumns: OperationSpec = {
            kind: 'missing',
            options: { columnIds: [], placeholders: [], action: { kind: 'fill', value: 'x' } },
        }
        await expect(client.previewOperation(noColumns)).rejects.toBeInstanceOf(OperationError)
        await expect(client.applyOperation(fillAll(''))).rejects.toThrow(
            'Type the value to insert in place of the missing values.',
        )
    })
})