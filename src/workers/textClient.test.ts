// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { TextRules } from '@/engine/operations/textCleaning'
import { OperationError } from '@/engine/operations/types'
import { csvBuffer } from '@/test/files'
import { HandlerWorker } from '@/test/handlerWorker'
import { createImportClient } from '@/workers/importClient'
import type { OperationSpec } from '@/workers/protocol'

const rules: TextRules = {
    removeNonPrinting: false,
    lineBreaksToSpace: false,
    trimEnds: true,
    collapseSpaces: true,
    textCase: 'title',
    keepAddressCase: true,
}

function clean(columnIds: string[], overrides: Partial<TextRules> = {}): OperationSpec {
    return { kind: 'text', options: { ...rules, ...overrides, columnIds } }
}

const CSV = ['Name', '  asha ', 'RAVI'].join('\n')

describe('import client: text cleaning', () => {
    it('previews, marks the cells, lists them and applies the cleaning', async () => {
        const client = createImportClient(() => new HandlerWorker())
        await client.importFile('data.csv', csvBuffer(CSV))

        const summary = await client.previewOperation(clean(['c1']))
        expect(summary.text).toMatchObject({ textCells: 2, changedCells: 2 })

        const marked = await client.getPage(0, 10)
        expect(marked.marks).toBeUndefined()
        expect(marked.cellMarks).toEqual([[0], [0]])
        expect(marked.cellMarkKind).toBe('change')

        const records = await client.getPreviewPage(0, 10)
        expect(records.itemCount).toBe(2)
        expect(records.items.map((item) => item.kind)).toEqual(['changedText', 'changedText'])

        const result = await client.applyOperation(clean(['c1']))
        expect(result).toMatchObject({ changedCells: 2, filledCells: 0, removedRows: 0 })

        const after = await client.getPage(0, 10)
        expect(after.cellMarks).toBeUndefined()
        expect(after.rows.map((row) => row.cells)).toEqual([['Asha'], ['Ravi']])
    })

    it('rejects with an OperationError when the settings cannot be used', async () => {
        const client = createImportClient(() => new HandlerWorker())
        await client.importFile('data.csv', csvBuffer(CSV))
        await expect(client.previewOperation(clean([]))).rejects.toBeInstanceOf(OperationError)
        await expect(
            client.applyOperation(
                clean(['c1'], { trimEnds: false, collapseSpaces: false, textCase: 'none' }),
            ),
        ).rejects.toThrow('Choose at least one cleaning option.')
    })
})