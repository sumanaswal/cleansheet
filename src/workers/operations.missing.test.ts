// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { MissingAction } from '@/engine/operations/missingValues'
import { OperationError } from '@/engine/operations/types'
import type { CellValue, Dataset } from '@/engine/types'
import {
    applyToDataset,
    buildPreview,
    countChangedCells,
} from '@/workers/operations'
import type { OperationSpec } from '@/workers/protocol'

function dataset(names: string[], rows: CellValue[][]): Dataset {
    return {
        columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
        rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
    }
}

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

// Row numbers 2 to 7. Name is missing in two rows, Qty in two, and City is
// missing in two (one of them only spaces). N/A is only a possible placeholder.
const people = dataset(
    ['Name', 'Qty', 'City'],
    [
        ['Asha', 5, 'Delhi'],
        [null, 7, 'Pune'],
        ['Ravi', null, ' '],
        ['N/A', 0, 'Mumbai'],
        [null, null, null],
        ['Zoe', 3, 'Chennai'],
    ],
)

describe('buildPreview: filling missing values', () => {
    it('summarises the fill and each chosen column', () => {
        const { summary } = buildPreview(people, missing(ALL, fill('0')))
        expect(summary).toMatchObject({
            totalRows: 6,
            removedRows: 0,
            retainedRows: 6,
            skippedRows: 0,
            itemCount: 6,
        })
        expect(summary.missing).toMatchObject({
            action: 'fill',
            fillValue: '0',
            missingCells: 6,
            placeholderCells: 0,
            filledCells: 6,
        })
        expect(
            summary.missing?.columns.map((c) => [
                c.position,
                c.name,
                c.missingCount,
                c.affectedCount,
                c.insertAs,
            ]),
        ).toEqual([
            [1, 'Name', 2, 2, 'text'],
            [2, 'Qty', 2, 2, 'number'],
            [3, 'City', 2, 2, 'text'],
        ])
    })

    it('counts chosen placeholders as well', () => {
        const { summary } = buildPreview(people, missing(ALL, fill('Unknown'), ['n/a']))
        expect(summary.itemCount).toBe(7)
        expect(summary.missing).toMatchObject({ missingCells: 6, placeholderCells: 1, filledCells: 7 })
        expect(summary.missing?.columns.map((c) => c.affectedCount)).toEqual([3, 2, 2])
    })

    it('lists each cell with its old and new value', () => {
        const preview = buildPreview(people, missing(ALL, fill('0')))
        expect(preview.items(0, 10)).toEqual([
            { kind: 'filledCell', row: people.rows[1], columnPosition: 1, columnName: 'Name', oldValue: null, newValue: '0' },
            { kind: 'filledCell', row: people.rows[2], columnPosition: 2, columnName: 'Qty', oldValue: null, newValue: 0 },
            { kind: 'filledCell', row: people.rows[2], columnPosition: 3, columnName: 'City', oldValue: ' ', newValue: '0' },
            { kind: 'filledCell', row: people.rows[4], columnPosition: 1, columnName: 'Name', oldValue: null, newValue: '0' },
            { kind: 'filledCell', row: people.rows[4], columnPosition: 2, columnName: 'Qty', oldValue: null, newValue: 0 },
            { kind: 'filledCell', row: people.rows[4], columnPosition: 3, columnName: 'City', oldValue: null, newValue: '0' },
        ])
    })

    it('lists the cells a page at a time', () => {
        const preview = buildPreview(people, missing(ALL, fill('0')))
        const describe = (offset: number, limit: number) =>
            preview
                .items(offset, limit)
                .map((item) =>
                    item.kind === 'filledCell' ? [item.row.sourceRow, item.columnName] : null,
                )
        expect(describe(2, 2)).toEqual([
            [4, 'City'],
            [6, 'Name'],
        ])
        expect(describe(5, 10)).toEqual([[6, 'City']])
        expect(describe(6, 10)).toEqual([])
    })

    it('marks the cells to fill, row by row, for any range of rows', () => {
        const preview = buildPreview(people, missing(ALL, fill('0')))
        expect(preview.cellMarks(0, 6)).toEqual([[], [0], [1, 2], [], [0, 1, 2], []])
        expect(preview.cellMarks(2, 3)).toEqual([[1, 2], [], [0, 1, 2]])
        expect(preview.cellMarks(1, 1)).toEqual([[0]])
        expect(preview.cellMarks(5, 1)).toEqual([[]])
    })

    it('does not mark whole rows', () => {
        const preview = buildPreview(people, missing(ALL, fill('0')))
        expect(preview.marksRows).toBe(false)
        expect([0, 1, 2, 3, 4, 5].map((index) => preview.mark(index))).toEqual([
            null, null, null, null, null, null,
        ])
    })

    it('does not change the dataset', () => {
        const before = JSON.stringify(people)
        buildPreview(people, missing(ALL, fill('0'), ['n/a'])).items(0, 10)
        expect(JSON.stringify(people)).toBe(before)
    })
})

describe('buildPreview: removing rows with missing values', () => {
    const preview = buildPreview(people, missing(ALL, remove('any')))

    it('summarises the rows that would go', () => {
        expect(preview.summary).toMatchObject({
            totalRows: 6,
            removedRows: 3,
            retainedRows: 3,
            skippedRows: 0,
            itemCount: 3,
        })
        expect(preview.summary.missing).toMatchObject({
            action: 'removeRows',
            fillValue: null,
            filledCells: 0,
        })
        expect(preview.summary.missing?.columns.map((c) => [c.affectedCount, c.insertAs])).toEqual([
            [2, null],
            [2, null],
            [2, null],
        ])
    })

    it('lists each row with the columns that were missing', () => {
        expect(preview.items(0, 10)).toEqual([
            {
                kind: 'removedMissingRow',
                row: people.rows[1],
                missingColumns: [{ position: 1, name: 'Name' }],
            },
            {
                kind: 'removedMissingRow',
                row: people.rows[2],
                missingColumns: [
                    { position: 2, name: 'Qty' },
                    { position: 3, name: 'City' },
                ],
            },
            {
                kind: 'removedMissingRow',
                row: people.rows[4],
                missingColumns: [
                    { position: 1, name: 'Name' },
                    { position: 2, name: 'Qty' },
                    { position: 3, name: 'City' },
                ],
            },
        ])
        expect(preview.items(1, 1)).toHaveLength(1)
    })

    it('marks the rows that would go and nothing else', () => {
        expect(preview.marksRows).toBe(true)
        expect([0, 1, 2, 3, 4, 5].map((index) => preview.mark(index))).toEqual([
            null, 'remove', 'remove', null, 'remove', null,
        ])
        expect(preview.cellMarks(0, 6)).toBeUndefined()
    })

    it('removes a row only when every chosen column is missing, if asked', () => {
        const all = buildPreview(people, missing(ALL, remove('all')))
        expect(all.summary.removedRows).toBe(1)
        expect([0, 1, 2, 3, 4, 5].map((index) => all.mark(index))).toEqual([
            null, null, null, null, 'remove', null,
        ])
    })
})

describe('applyToDataset: missing values', () => {
    it('fills the missing cells, putting a number into a number column', () => {
        const result = applyToDataset(people, missing(ALL, fill('0')))
        expect(result.rows.map((row) => row.cells)).toEqual([
            ['Asha', 5, 'Delhi'],
            ['0', 7, 'Pune'],
            ['Ravi', 0, '0'],
            ['N/A', 0, 'Mumbai'],
            ['0', 0, '0'],
            ['Zoe', 3, 'Chennai'],
        ])
    })

    it('removes the rows with missing values', () => {
        const result = applyToDataset(people, missing(ALL, remove('any')))
        expect(result.rows.map((row) => row.sourceRow)).toEqual([2, 5, 7])
    })

    it('returns the same dataset when there is nothing to do', () => {
        const data = dataset(['a'], [['x']])
        expect(applyToDataset(data, missing(['c1'], fill('0')))).toBe(data)
    })

    it('refuses settings that cannot be used', () => {
        expect(() => buildPreview(people, missing([], fill('0')))).toThrow(OperationError)
        expect(() => buildPreview(people, missing(ALL, fill('0'), ['0']))).toThrow(/real value/)
        expect(() => applyToDataset(people, missing(ALL, fill('')))).toThrow(
            'Type the value to insert in place of the missing values.',
        )
    })
})

describe('countChangedCells', () => {
    it('counts the cells a fill changed', () => {
        const after = applyToDataset(people, missing(ALL, fill('0')))
        expect(countChangedCells(people, after)).toBe(6)
    })

    it('counts nothing when the dataset is unchanged or has a different number of rows', () => {
        expect(countChangedCells(people, people)).toBe(0)
        const fewer = applyToDataset(people, missing(ALL, remove('any')))
        expect(countChangedCells(people, fewer)).toBe(0)
    })

    it('counts the cells that a short row was missing', () => {
        const short = dataset(['a', 'b'], [['x']])
        const after = applyToDataset(short, missing(['c1', 'c2'], fill('y')))
        expect(countChangedCells(short, after)).toBe(1)
    })
})