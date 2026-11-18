// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { profileDataset } from '@/engine/profiling/profile'
import type { ColumnProfile, DatasetProfile } from '@/engine/profiling/types'
import type { CellValue, Dataset } from '@/engine/types'

function dataset(names: string[], rows: CellValue[][]): Dataset {
    return {
        columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
        rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
    }
}

function column(profile: DatasetProfile, index: number): ColumnProfile {
    const found = profile.columns[index]
    if (found === undefined) throw new Error(`No column profile at ${index}`)
    return found
}

describe('profileDataset: counts', () => {
    const data = dataset(
        ['ID', 'Name', 'Qty'],
        [
            ['001', 'Asha', 5],
            ['002', 'Ravi', null],
            ['003', '  ', 0],
            [null, null, null],
            ['001', 'Asha', 5],
            ['004', 'N/A', 7],
        ],
    )

    it('counts rows, columns, missing cells, empty rows and duplicates', () => {
        const profile = profileDataset(data)
        expect(profile.totalRows).toBe(6)
        expect(profile.totalColumns).toBe(3)
        expect(profile.missingCells).toBe(5)
        expect(profile.emptyRows).toBe(1)
        expect(profile.duplicateRows).toBe(1)
        expect(profile.emptyColumns).toBe(0)
    })

    it('profiles each column', () => {
        const profile = profileDataset(data)
        expect(column(profile, 0)).toMatchObject({
            name: 'ID',
            type: 'idText',
            missingCount: 1,
            placeholderCount: 0,
            exceptionCount: 0,
            hasIssues: true,
        })
        expect(column(profile, 1)).toMatchObject({
            name: 'Name',
            type: 'text',
            missingCount: 2,
            placeholderCount: 1,
            exceptionCount: 0,
        })
        expect(column(profile, 2)).toMatchObject({
            name: 'Qty',
            type: 'number',
            missingCount: 2,
            placeholderCount: 0,
            exceptionCount: 0,
        })
    })

    it('does not change the dataset', () => {
        const before = JSON.stringify(data)
        profileDataset(data)
        expect(JSON.stringify(data)).toBe(before)
    })
})

describe('profileDataset: duplicates', () => {
    it('matches exactly: type, case and spaces all matter', () => {
        const profile = profileDataset(
            dataset(
                ['a', 'b'],
                [
                    ['1', 'a'],
                    [1, 'a'],
                    ['1', 'A'],
                    ['1', 'a '],
                    ['1', 'a'],
                    ['x', null],
                    ['x', ' '],
                ],
            ),
        )
        expect(profile.duplicateRows).toBe(1)
    })

    it('counts fully empty rows as empty and never as duplicates', () => {
        const profile = profileDataset(
            dataset(
                ['a', 'b'],
                [
                    [null, null],
                    [null, null],
                    [' ', null],
                ],
            ),
        )
        expect(profile.emptyRows).toBe(3)
        expect(profile.duplicateRows).toBe(0)
    })

    it('treats identical date cells as duplicates', () => {
        const date = (text: string): CellValue => ({ kind: 'date', serial: 46000, text })
        const profile = profileDataset(
            dataset(
                ['d'],
                [[date('09-12-2025')], [date('09-12-2025')], [date('9/12/2025')]],
            ),
        )
        expect(profile.duplicateRows).toBe(1)
    })

    it('does not confuse values that contain the separator character', () => {
        const profile = profileDataset(
            dataset(
                ['a', 'b'],
                [
                    ['a|b', 'c'],
                    ['a', 'b|c'],
                    ['a', 'bc'],
                    ['ab', 'c'],
                ],
            ),
        )
        expect(profile.duplicateRows).toBe(0)
    })
})

describe('profileDataset: column types', () => {
    it('detects the type of each column', () => {
        const d = (n: number): CellValue => ({ kind: 'date', serial: n, text: String(n) })
        const profile = profileDataset(
            dataset(
                ['Num', 'Text', 'Bool', 'Date', 'NumText', 'IdText', 'DateText', 'Mixed', 'Empty'],
                [
                    [1, 'a', true, d(1), '1', '001', '03/04/2026', 1, null],
                    [2, 'b', false, d(2), '2', '2', '2026-04-03', 'a', ' '],
                    [3, 'c', true, d(3), '3', '3', '31/12/2026', true, null],
                ],
            ),
        )
        expect(profile.columns.map((c) => c.type)).toEqual([
            'number',
            'text',
            'boolean',
            'date',
            'numberText',
            'idText',
            'dateText',
            'mixed',
            'empty',
        ])
        expect(profile.emptyColumns).toBe(1)
        expect(profile.emptyRows).toBe(0)
    })

    it('reports values that do not fit the detected type as exceptions', () => {
        const rows: CellValue[][] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n])
        rows.push(['abc'])
        const profile = profileDataset(dataset(['n'], rows))
        expect(column(profile, 0)).toMatchObject({
            type: 'number',
            exceptionCount: 1,
            hasIssues: true,
        })
    })

    it('keeps placeholders out of type detection and reports them separately', () => {
        const profile = profileDataset(
            dataset(['n'], [[1], [2], [3], ['N/A'], ['n/a']]),
        )
        expect(column(profile, 0)).toMatchObject({
            type: 'number',
            placeholderCount: 2,
            exceptionCount: 0,
            missingCount: 0,
        })
    })

    it('does not call a column with only placeholders empty', () => {
        const profile = profileDataset(dataset(['n'], [['N/A'], ['-']]))
        expect(column(profile, 0)).toMatchObject({ type: 'text', placeholderCount: 2 })
        expect(profile.emptyColumns).toBe(0)
    })
})

describe('profileDataset: edge cases', () => {
    it('never treats zero or false as missing', () => {
        const profile = profileDataset(dataset(['v'], [[0], [false], ['0']]))
        expect(profile.missingCells).toBe(0)
        expect(column(profile, 0).missingCount).toBe(0)
    })

    it('counts cells missing from a short row as missing', () => {
        const profile = profileDataset(dataset(['a', 'b'], [['x']]))
        expect(profile.missingCells).toBe(1)
        expect(column(profile, 1).missingCount).toBe(1)
        expect(profile.emptyRows).toBe(0)
    })

    it('handles a sheet with a header and no data rows', () => {
        const profile = profileDataset(dataset(['a', 'b'], []))
        expect(profile.totalRows).toBe(0)
        expect(profile.totalColumns).toBe(2)
        expect(profile.missingCells).toBe(0)
        expect(profile.duplicateRows).toBe(0)
        expect(profile.emptyRows).toBe(0)
        expect(profile.emptyColumns).toBe(2)
        expect(profile.columns.map((c) => c.type)).toEqual(['empty', 'empty'])
    })

    it('flags only columns that have something worth checking', () => {
        const profile = profileDataset(
            dataset(
                ['Clean', 'Texty', 'Gaps', 'NumText', 'Id'],
                [
                    [1, 'a', 1, '1', '01'],
                    [2, 'b', null, '2', '02'],
                ],
            ),
        )
        expect(profile.columns.map((c) => c.hasIssues)).toEqual([
            false,
            false,
            true,
            true,
            false,
        ])
    })

    it('tells columns with the same name apart by id and position', () => {
        const profile = profileDataset(dataset(['Name', 'Name'], [['a', 'b']]))
        expect(profile.columns.map((c) => c.id)).toEqual(['c1', 'c2'])
        expect(profile.columns.map((c) => c.position)).toEqual([1, 2])
        expect(profile.columns.map((c) => c.name)).toEqual(['Name', 'Name'])
    })
})

describe('profileDataset: negative numbers', () => {
    it('counts negative numbers and negative text per column and in total', () => {
        const profile = profileDataset(
            dataset(
                ['Amount', 'Name'],
                [
                    [-5, 'a'],
                    ['-1,250.50', 'b'],
                    [3, 'c'],
                    [0, 'd'],
                    ['-0', 'e'],
                    ['-', 'f'],
                    ['(500)', 'g'],
                    [-0.5, 'h'],
                ],
            ),
        )
        expect(profile.negativeNumbers).toBe(3)
        expect(column(profile, 0).negativeCount).toBe(3)
        expect(column(profile, 1).negativeCount).toBe(0)
    })

    it('never counts date cells, booleans or empty cells', () => {
        const profile = profileDataset(
            dataset(
                ['v'],
                [[{ kind: 'date', serial: -5, text: '-5' }], [false], [null], [' ']],
            ),
        )
        expect(profile.negativeNumbers).toBe(0)
        expect(column(profile, 0).negativeCount).toBe(0)
    })

    it('does not make a column worth checking', () => {
        const profile = profileDataset(dataset(['Qty'], [[-1], [2], [3]]))
        expect(column(profile, 0)).toMatchObject({
            type: 'number',
            negativeCount: 1,
            missingCount: 0,
            placeholderCount: 0,
            exceptionCount: 0,
            hasIssues: false,
        })
    })
})