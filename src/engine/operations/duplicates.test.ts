// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    DEFAULT_DUPLICATE_OPTIONS,
    planDuplicateRemoval,
    removeDuplicates,
    type DuplicateOptions,
    type DuplicatePlan,
} from '@/engine/operations/duplicates'
import { OperationError } from '@/engine/operations/types'
import { profileDataset } from '@/engine/profiling/profile'
import type { CellValue, Dataset } from '@/engine/types'

function dataset(names: string[], rows: CellValue[][]): Dataset {
    return {
        columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
        rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
    }
}

function options(overrides: Partial<DuplicateOptions> = {}): DuplicateOptions {
    return { ...DEFAULT_DUPLICATE_OPTIONS, ...overrides }
}

/** [removed row, kept row] as row numbers of the source file. */
function pairs(plan: DuplicatePlan, data: Dataset): number[][] {
    return plan.removed.map((entry) => [
        data.rows[entry.index]?.sourceRow ?? -1,
        data.rows[entry.keptIndex]?.sourceRow ?? -1,
    ])
}

function rowNumbers(data: Dataset): number[] {
    return data.rows.map((row) => row.sourceRow)
}

const letters = dataset(['v'], [['A'], ['B'], ['A'], ['C'], ['A']])

describe('removeDuplicates: keeping first or last', () => {
    it('removes later copies and keeps the first by default', () => {
        const plan = planDuplicateRemoval(letters, options())
        expect(pairs(plan, letters)).toEqual([
            [4, 2],
            [6, 2],
        ])
        expect(plan.totalRows).toBe(5)
        expect(rowNumbers(removeDuplicates(letters, options()))).toEqual([2, 3, 5])
    })

    it('keeps the last copy when asked, without reordering', () => {
        const plan = planDuplicateRemoval(letters, options({ keep: 'last' }))
        expect(pairs(plan, letters)).toEqual([
            [2, 6],
            [4, 6],
        ])
        expect(rowNumbers(removeDuplicates(letters, options({ keep: 'last' })))).toEqual([
            3, 5, 6,
        ])
    })

    it('handles interleaved groups when keeping the last', () => {
        const data = dataset(['v'], [['A'], ['B'], ['A'], ['B']])
        const plan = planDuplicateRemoval(data, options({ keep: 'last' }))
        expect(pairs(plan, data)).toEqual([
            [2, 4],
            [3, 5],
        ])
        expect(rowNumbers(removeDuplicates(data, options({ keep: 'last' })))).toEqual([4, 5])
    })

    it('lists removed rows in file order', () => {
        const plan = planDuplicateRemoval(letters, options({ keep: 'last' }))
        const indexes = plan.removed.map((entry) => entry.index)
        expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
    })
})

describe('removeDuplicates: the result', () => {
    it('keeps the same row objects and column list, not copies', () => {
        const result = removeDuplicates(letters, options())
        expect(result.columns).toBe(letters.columns)
        expect(result.rows[0]).toBe(letters.rows[0])
        expect(result.rows[1]).toBe(letters.rows[1])
        expect(result.rows[2]).toBe(letters.rows[3])
    })

    it('returns the same dataset when there is nothing to remove', () => {
        const data = dataset(['v'], [['A'], ['B'], ['C']])
        expect(removeDuplicates(data, options())).toBe(data)
    })

    it('does not change the dataset it is given', () => {
        const before = JSON.stringify(letters)
        planDuplicateRemoval(letters, options())
        removeDuplicates(letters, options())
        expect(JSON.stringify(letters)).toBe(before)
    })
})

describe('removeDuplicates: all columns', () => {
    it('needs every column to match', () => {
        const data = dataset(
            ['a', 'b'],
            [
                ['a', 'x'],
                ['a', 'y'],
                ['a', 'x'],
            ],
        )
        expect(pairs(planDuplicateRemoval(data, options()), data)).toEqual([[4, 2]])
    })

    it('treats leading zeros and number versus text as different values', () => {
        const data = dataset(['id'], [['001'], ['1'], [1], ['001']])
        expect(pairs(planDuplicateRemoval(data, options()), data)).toEqual([[5, 2]])
    })

    it('skips fully empty rows: they are never duplicates of each other', () => {
        const data = dataset(
            ['a', 'b'],
            [
                [null, null],
                [null, null],
                [' ', null],
                ['x', 'y'],
                ['x', 'y'],
            ],
        )
        const plan = planDuplicateRemoval(data, options())
        expect(pairs(plan, data)).toEqual([[6, 5]])
        expect(plan.skippedRows).toBe(3)
    })

    it('lets partly empty rows be duplicates', () => {
        const data = dataset(['a', 'b'], [['x', null], ['x', null]])
        const plan = planDuplicateRemoval(data, options())
        expect(pairs(plan, data)).toEqual([[3, 2]])
        expect(plan.skippedRows).toBe(0)
    })

    it('finds exactly the rows the Data Quality page counts as duplicates', () => {
        const data = dataset(
            ['ID', 'Name', 'Qty'],
            [
                ['001', 'Asha', 5],
                ['002', 'Ravi', null],
                ['003', '  ', 0],
                [null, null, null],
                ['001', 'Asha', 5],
                ['004', 'N/A', 7],
                ['001', 'Asha', 5],
            ],
        )
        const profile = profileDataset(data)
        const first = planDuplicateRemoval(data, options())
        const last = planDuplicateRemoval(data, options({ keep: 'last' }))
        expect(first.removed.length).toBe(profile.duplicateRows)
        expect(last.removed.length).toBe(profile.duplicateRows)
        expect(first.skippedRows).toBe(profile.emptyRows)
        expect(profile.duplicateRows).toBe(2)
    })
})

describe('removeDuplicates: selected columns', () => {
    const people = dataset(
        ['Name', 'City'],
        [
            ['Asha', 'Delhi'],
            ['Asha', 'Pune'],
            ['Ravi', 'Pune'],
            ['Asha', 'Delhi'],
        ],
    )

    it('compares only the chosen columns', () => {
        const plan = planDuplicateRemoval(people, options({ columnIds: ['c1'] }))
        expect(pairs(plan, people)).toEqual([
            [3, 2],
            [5, 2],
        ])
    })

    it('needs every chosen column to match', () => {
        const plan = planDuplicateRemoval(people, options({ columnIds: ['c1', 'c2'] }))
        expect(pairs(plan, people)).toEqual([[5, 2]])
    })

    it('skips rows where a chosen column is missing, so blanks never match', () => {
        const data = dataset(
            ['Name', 'Phone'],
            [
                ['Asha', null],
                ['Asha', null],
                ['Ravi', ' '],
                ['Ravi', ' '],
                ['Zoe', '1'],
                ['Zoe', '1'],
            ],
        )
        const plan = planDuplicateRemoval(data, options({ columnIds: ['c1', 'c2'] }))
        expect(pairs(plan, data)).toEqual([[7, 6]])
        expect(plan.skippedRows).toBe(4)
    })

    it('ignores missing values in columns that are not chosen', () => {
        const data = dataset(['Name', 'Phone'], [['Asha', null], ['Asha', null]])
        const plan = planDuplicateRemoval(data, options({ columnIds: ['c1'] }))
        expect(pairs(plan, data)).toEqual([[3, 2]])
        expect(plan.skippedRows).toBe(0)
    })

    it('tells columns with the same name apart by id', () => {
        const data = dataset(
            ['Name', 'Name'],
            [
                ['a', 'x'],
                ['a', 'y'],
            ],
        )
        expect(
            planDuplicateRemoval(data, options({ columnIds: ['c1'] })).removed,
        ).toHaveLength(1)
        expect(
            planDuplicateRemoval(data, options({ columnIds: ['c2'] })).removed,
        ).toHaveLength(0)
    })

    it('counts a column chosen twice only once', () => {
        const once = planDuplicateRemoval(people, options({ columnIds: ['c1'] }))
        const twice = planDuplicateRemoval(people, options({ columnIds: ['c1', 'c1'] }))
        expect(twice).toEqual(once)
    })

    it('refuses to run with no columns chosen', () => {
        expect(() => planDuplicateRemoval(people, options({ columnIds: [] }))).toThrow(
            OperationError,
        )
        expect(() => planDuplicateRemoval(people, options({ columnIds: [] }))).toThrow(
            'Choose at least one column to compare.',
        )
    })

    it('refuses to run when a chosen column no longer exists', () => {
        expect(() =>
            planDuplicateRemoval(people, options({ columnIds: ['c1', 'c9'] })),
        ).toThrow(/no longer exists/)
    })
})

describe('removeDuplicates: matching options', () => {
    it('is exact by default', () => {
        const data = dataset(['v'], [['Asha'], ['ASHA'], ['Asha ']])
        expect(planDuplicateRemoval(data, options()).removed).toHaveLength(0)
    })

    it('ignores case when asked, but not spaces', () => {
        const data = dataset(['v'], [['Asha'], ['ASHA'], ['asha ']])
        const plan = planDuplicateRemoval(data, options({ caseInsensitive: true }))
        expect(pairs(plan, data)).toEqual([[3, 2]])
    })

    it('ignores extra spaces when asked, but not case', () => {
        const data = dataset(
            ['v'],
            [[' Asha  Singh'], ['Asha Singh'], ['Asha\tSingh'], ['Asha\u00a0Singh'], ['ASHA Singh']],
        )
        const plan = planDuplicateRemoval(data, options({ normalizeSpaces: true }))
        expect(pairs(plan, data)).toEqual([
            [3, 2],
            [4, 2],
            [5, 2],
        ])
    })

    it('combines both options', () => {
        const data = dataset(['v'], [[' Asha  Singh'], ['ASHA singh']])
        const plan = planDuplicateRemoval(
            data,
            options({ caseInsensitive: true, normalizeSpaces: true }),
        )
        expect(pairs(plan, data)).toEqual([[3, 2]])
    })

    it('never changes numbers: 1 still differs from the text "1"', () => {
        const data = dataset(['v'], [[1], ['1'], [1]])
        const plan = planDuplicateRemoval(
            data,
            options({ caseInsensitive: true, normalizeSpaces: true }),
        )
        expect(pairs(plan, data)).toEqual([[4, 2]])
    })

    it('lets a whitespace-only cell match an empty cell when spaces are ignored', () => {
        const data = dataset(['a', 'b'], [['x', null], ['x', ' ']])
        expect(planDuplicateRemoval(data, options()).removed).toHaveLength(0)
        expect(
            planDuplicateRemoval(data, options({ normalizeSpaces: true })).removed,
        ).toHaveLength(1)
    })
})