// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { MissingAction } from '@/engine/operations/missingValues'
import {
    applyOf,
    clearPreviewOf,
    expectType,
    loadCsv,
    loadWorkbook,
    pageOf,
    previewOf,
    previewPageOf,
    profileOf,
} from '@/test/handlerHelpers'
import { createImportHandler } from '@/workers/importHandler'
import type { OperationSpec } from '@/workers/protocol'

function missing(
    columnIds: string[],
    action: MissingAction,
    placeholders: string[] = [],
): OperationSpec {
    return { kind: 'missing', options: { columnIds, placeholders, action } }
}

const fill = (value: string): MissingAction => ({ kind: 'fill', value })
const remove = (when: 'any' | 'all'): MissingAction => ({ kind: 'removeRows', when })
const ALL = ['c1', 'c2', 'c3']

// Row numbers 2 to 7. Every value is text, as in any CSV file.
const CSV = [
    'Name,Qty,City',
    'Asha,5,Delhi',
    ',7,Pune',
    'Ravi,, ',
    'N/A,0,Mumbai',
    ',,',
    'Zoe,3,Chennai',
].join('\n')

function loaded() {
    const handle = createImportHandler()
    loadCsv(handle, CSV)
    return handle
}

describe('missing values in the worker: preview a fill', () => {
    it('summarises the fill and marks the cells on the page, without changing any data', () => {
        const handle = loaded()
        const { summary } = expectType(previewOf(handle, missing(ALL, fill('0'))), 'previewed')
        expect(summary.itemCount).toBe(6)
        expect(summary.removedRows).toBe(0)
        expect(summary.missing).toMatchObject({
            action: 'fill',
            fillValue: '0',
            missingCells: 6,
            filledCells: 6,
        })
        // Every value in a CSV file is text, so nothing here is a number column.
        expect(summary.missing?.columns.map((c) => c.insertAs)).toEqual(['text', 'text', 'text'])

        const page = pageOf(handle)
        expect(page.marks).toBeUndefined()
        expect(page.cellMarks).toEqual([[], [0], [1, 2], [], [0, 1, 2], []])
        expect(page.rows[1]?.cells).toEqual([null, '7', 'Pune'])
    })

    it('stops marking cells when the preview is cleared', () => {
        const handle = loaded()
        previewOf(handle, missing(ALL, fill('0')))
        clearPreviewOf(handle)
        expect(pageOf(handle).cellMarks).toBeUndefined()
    })

    it('lists the cells that would be filled, a page at a time', () => {
        const handle = loaded()
        previewOf(handle, missing(ALL, fill('0')))
        const first = expectType(previewPageOf(handle, 0, 2), 'previewPage')
        expect(first.itemCount).toBe(6)
        expect(first.items).toHaveLength(2)
        expect(first.items[0]).toMatchObject({
            kind: 'filledCell',
            columnName: 'Name',
            oldValue: null,
            newValue: '0',
        })
        expect(first.items[1]).toMatchObject({ kind: 'filledCell', columnName: 'Qty' })
        const last = expectType(previewPageOf(handle, 4, 10), 'previewPage')
        expect(last.items).toHaveLength(2)
    })

    it('removes the previous preview when the new settings cannot be used', () => {
        const handle = loaded()
        previewOf(handle, missing(ALL, fill('0')))
        const error = expectType(previewOf(handle, missing([], fill('0'))), 'error')
        expect(error.kind).toBe('operation')
        expect(error.message).toBe('Choose at least one column to look at.')
        expectType(previewPageOf(handle, 0, 10), 'error')
        expect(pageOf(handle).cellMarks).toBeUndefined()
    })
})

describe('missing values in the worker: apply a fill', () => {
    it('fills the cells and reports how many', () => {
        const handle = loaded()
        const { result } = expectType(applyOf(handle, missing(ALL, fill('0'))), 'applied')
        expect(result).toMatchObject({ removedRows: 0, filledCells: 6, historyDepth: 1 })
        expect(result.summary.rowCount).toBe(6)
        expect(pageOf(handle).rows.map((row) => row.cells)).toEqual([
            ['Asha', '5', 'Delhi'],
            ['0', '7', 'Pune'],
            ['Ravi', '0', '0'],
            ['N/A', '0', 'Mumbai'],
            ['0', '0', '0'],
            ['Zoe', '3', 'Chennai'],
        ])
    })

    it('discards the preview and works out the data quality profile again', () => {
        const handle = loaded()
        expect(profileOf(handle).missingCells).toBe(6)
        previewOf(handle, missing(ALL, fill('0')))
        expectType(applyOf(handle, missing(ALL, fill('0'))), 'applied')

        expectType(previewPageOf(handle, 0, 10), 'error')
        expect(pageOf(handle).cellMarks).toBeUndefined()
        expect(profileOf(handle).missingCells).toBe(0)
    })

    it('also fills the placeholders that were chosen', () => {
        const handle = loaded()
        const { result } = expectType(
            applyOf(handle, missing(ALL, fill('Unknown'), ['n/a'])),
            'applied',
        )
        expect(result.filledCells).toBe(7)
        expect(pageOf(handle).rows[3]?.cells).toEqual(['Unknown', '0', 'Mumbai'])
    })

    it('puts a number into a column of numbers', () => {
        const handle = createImportHandler()
        loadWorkbook(handle, [
            ['Name', 'Qty'],
            ['a', 5],
            ['b', null],
            ['c', 7],
        ])
        const { summary } = expectType(previewOf(handle, missing(['c2'], fill('0'))), 'previewed')
        expect(summary.missing?.columns[0]?.insertAs).toBe('number')

        expectType(applyOf(handle, missing(['c2'], fill('0'))), 'applied')
        expect(pageOf(handle).rows.map((row) => row.cells[1])).toEqual([5, 0, 7])
    })

    it('adds nothing to the history when nothing is missing', () => {
        const handle = createImportHandler()
        loadCsv(handle, 'a\nx\ny')
        const { result } = expectType(applyOf(handle, missing(['c1'], fill('0'))), 'applied')
        expect(result).toMatchObject({ filledCells: 0, removedRows: 0, historyDepth: 0 })
    })

    it('leaves the data alone when the settings cannot be used', () => {
        const handle = loaded()
        for (const action of [fill(''), fill('  ')]) {
            const error = expectType(applyOf(handle, missing(ALL, action)), 'error')
            expect(error.kind).toBe('operation')
        }
        const badPlaceholder = expectType(
            applyOf(handle, missing(ALL, fill('0'), ['0'])),
            'error',
        )
        expect(badPlaceholder.message).toMatch(/real value/)
        expect(pageOf(handle).rowCount).toBe(6)
        expect(pageOf(handle).rows[1]?.cells).toEqual([null, '7', 'Pune'])
    })
})

describe('missing values in the worker: removing rows', () => {
    it('previews the rows that would go and marks them', () => {
        const handle = loaded()
        const { summary } = expectType(previewOf(handle, missing(ALL, remove('any'))), 'previewed')
        expect(summary).toMatchObject({ removedRows: 3, retainedRows: 3, itemCount: 3 })
        expect(summary.missing?.action).toBe('removeRows')

        const page = pageOf(handle)
        expect(page.marks).toEqual([null, 'remove', 'remove', null, 'remove', null])
        expect(page.cellMarks).toBeUndefined()

        const records = expectType(previewPageOf(handle, 0, 10), 'previewPage')
        expect(records.items[1]).toMatchObject({
            kind: 'removedMissingRow',
            missingColumns: [
                { position: 2, name: 'Qty' },
                { position: 3, name: 'City' },
            ],
        })
    })

    it('removes the rows and reports how many', () => {
        const handle = loaded()
        const { result } = expectType(applyOf(handle, missing(ALL, remove('any'))), 'applied')
        expect(result).toMatchObject({ removedRows: 3, filledCells: 0, historyDepth: 1 })
        expect(result.summary.rowCount).toBe(3)
        expect(pageOf(handle).rows.map((row) => row.sourceRow)).toEqual([2, 5, 7])
    })

    it('removes only the rows where every chosen column is missing, if asked', () => {
        const handle = loaded()
        const { result } = expectType(applyOf(handle, missing(ALL, remove('all'))), 'applied')
        expect(result.removedRows).toBe(1)
        expect(pageOf(handle).rows.map((row) => row.sourceRow)).toEqual([2, 3, 4, 5, 7])
    })

    it('ignores the columns that were left out', () => {
        const handle = loaded()
        const { result } = expectType(applyOf(handle, missing(['c1'], remove('any'))), 'applied')
        expect(result.removedRows).toBe(2)
    })
})