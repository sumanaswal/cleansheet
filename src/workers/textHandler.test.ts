// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { TextRules } from '@/engine/operations/textCleaning'
import { DEFAULT_DUPLICATE_OPTIONS } from '@/engine/operations/duplicates'
import {
    applyOf,
    clearPreviewOf,
    expectType,
    loadCsv,
    pageOf,
    previewOf,
    previewPageOf,
    profileOf,
} from '@/test/handlerHelpers'
import { createImportHandler } from '@/workers/importHandler'
import type { OperationSpec } from '@/workers/protocol'

const NONE: TextRules = {
    removeNonPrinting: false,
    lineBreaksToSpace: false,
    trimEnds: false,
    collapseSpaces: false,
    textCase: 'none',
    keepAddressCase: true,
}

const TIDY: Partial<TextRules> = {
    trimEnds: true,
    collapseSpaces: true,
    textCase: 'title',
}

function text(columnIds: string[], overrides: Partial<TextRules> = {}): OperationSpec {
    return { kind: 'text', options: { ...NONE, ...overrides, columnIds } }
}

const ALL = ['c1', 'c2', 'c3']

// Row numbers 2 to 6. Every value in a CSV file is text.
const CSV = [
    'Name,Qty,Email',
    '  asha   singh ,5,ASHA@X.COM',
    'RAVI,7, ravi@x.com',
    ',0,',
    'Zoe,3,zoe',
    '   ,,Zoe',
].join('\n')

function loaded() {
    const handle = createImportHandler()
    loadCsv(handle, CSV)
    return handle
}

describe('text cleaning in the worker: preview', () => {
    it('summarises the cleaning and marks the cells, without changing any data', () => {
        const handle = loaded()
        const { summary } = expectType(previewOf(handle, text(ALL, TIDY)), 'previewed')
        expect(summary.itemCount).toBe(5)
        expect(summary.text).toMatchObject({
            textCells: 12,
            nonTextCells: 0,
            changedCells: 5,
            removedChars: 0,
            keptAddresses: 2,
        })
        expect(
            summary.text?.columns.map((c) => [c.position, c.name, c.textCells, c.changedCount]),
        ).toEqual([
            [1, 'Name', 4, 3],
            [2, 'Qty', 4, 0],
            [3, 'Email', 4, 2],
        ])

        const page = pageOf(handle)
        expect(page.marks).toBeUndefined()
        expect(page.cellMarks).toEqual([[0], [0, 2], [], [2], [0]])
        expect(page.cellMarkKind).toBe('change')
        expect(page.rows[0]?.cells[0]).toBe('  asha   singh ')
    })

    it('says that filled cells are fills, and sends no kind when no cell would change', () => {
        const handle = loaded()
        previewOf(handle, {
            kind: 'missing',
            options: {
                columnIds: ['c1'],
                placeholders: [],
                action: { kind: 'fill', value: 'x' },
            },
        })
        expect(pageOf(handle).cellMarkKind).toBe('fill')

        previewOf(handle, { kind: 'duplicates', options: DEFAULT_DUPLICATE_OPTIONS })
        const page = pageOf(handle)
        expect(page.cellMarks).toBeUndefined()
        expect(page.cellMarkKind).toBeUndefined()
    })

    it('stops marking cells when the preview is cleared', () => {
        const handle = loaded()
        previewOf(handle, text(ALL, TIDY))
        clearPreviewOf(handle)
        const page = pageOf(handle)
        expect(page.cellMarks).toBeUndefined()
        expect(page.cellMarkKind).toBeUndefined()
    })

    it('lists the cells that would change, a page at a time', () => {
        const handle = loaded()
        previewOf(handle, text(ALL, TIDY))
        const first = expectType(previewPageOf(handle, 0, 2), 'previewPage')
        expect(first.itemCount).toBe(5)
        expect(first.items).toHaveLength(2)
        expect(first.items[0]).toMatchObject({
            kind: 'changedText',
            columnPosition: 1,
            columnName: 'Name',
            oldText: '  asha   singh ',
            newText: 'Asha Singh',
        })
        expect(first.items[1]).toMatchObject({ oldText: 'RAVI', newText: 'Ravi' })

        const last = expectType(previewPageOf(handle, 4, 10), 'previewPage')
        expect(last.items).toHaveLength(1)
        expect(last.items[0]).toMatchObject({ oldText: '   ', newText: null })
    })

    it('removes the previous preview when the new settings cannot be used', () => {
        const handle = loaded()
        previewOf(handle, text(ALL, TIDY))
        const error = expectType(previewOf(handle, text([], TIDY)), 'error')
        expect(error.kind).toBe('operation')
        expect(error.message).toBe('Choose at least one column to clean.')
        expectType(previewPageOf(handle, 0, 10), 'error')
        expect(pageOf(handle).cellMarks).toBeUndefined()
    })

    it('refuses to preview with no cleaning option chosen', () => {
        const handle = loaded()
        const error = expectType(previewOf(handle, text(ALL)), 'error')
        expect(error.kind).toBe('operation')
        expect(error.message).toBe('Choose at least one cleaning option.')
    })
})

describe('text cleaning in the worker: apply', () => {
    it('cleans the text and reports how many cells changed', () => {
        const handle = loaded()
        const { result } = expectType(applyOf(handle, text(ALL, TIDY)), 'applied')
        expect(result).toMatchObject({
            removedRows: 0,
            filledCells: 0,
            changedCells: 5,
            historyDepth: 1,
        })
        expect(result.summary.rowCount).toBe(5)
        expect(pageOf(handle).rows.map((row) => row.cells)).toEqual([
            ['Asha Singh', '5', 'ASHA@X.COM'],
            ['Ravi', '7', 'ravi@x.com'],
            [null, '0', null],
            ['Zoe', '3', 'Zoe'],
            [null, null, 'Zoe'],
        ])
    })

    it('reports the same number of changed cells as the preview listed', () => {
        const handle = loaded()
        const { summary } = expectType(previewOf(handle, text(ALL, TIDY)), 'previewed')
        const { result } = expectType(applyOf(handle, text(ALL, TIDY)), 'applied')
        expect(result.changedCells).toBe(summary.itemCount)
    })

    it('discards the preview', () => {
        const handle = loaded()
        previewOf(handle, text(ALL, TIDY))
        expectType(applyOf(handle, text(ALL, TIDY)), 'applied')
        expectType(previewPageOf(handle, 0, 10), 'error')
        const page = pageOf(handle)
        expect(page.cellMarks).toBeUndefined()
        expect(page.cellMarkKind).toBeUndefined()
    })

    it('makes rows that only differed by spaces or case identical, and the profile sees it', () => {
        const handle = createImportHandler()
        loadCsv(handle, 'Name\nAsha\n asha \nASHA')
        expect(profileOf(handle).duplicateRows).toBe(0)

        expectType(
            applyOf(handle, text(['c1'], { trimEnds: true, textCase: 'lower' })),
            'applied',
        )
        expect(profileOf(handle).duplicateRows).toBe(2)
    })

    it('adds a version to the history only when something changed', () => {
        const handle = loaded()
        expect(
            expectType(applyOf(handle, text(ALL, TIDY)), 'applied').result.historyDepth,
        ).toBe(1)
        const again = expectType(applyOf(handle, text(ALL, TIDY)), 'applied').result
        expect(again).toMatchObject({ changedCells: 0, historyDepth: 1 })
    })

    it('leaves the data alone when the settings cannot be used', () => {
        const handle = loaded()
        expectType(applyOf(handle, text([], TIDY)), 'error')
        expectType(applyOf(handle, text(ALL)), 'error')
        expect(pageOf(handle).rows[0]?.cells[0]).toBe('  asha   singh ')
    })
})