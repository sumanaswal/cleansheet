// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    applyMissingValues,
    planMissingValues,
    resolvePlaceholders,
    type MissingAction,
    type MissingOptions,
} from '@/engine/operations/missingValues'
import { OperationError } from '@/engine/operations/types'
import { isPossiblePlaceholder, PLACEHOLDER_WORDS } from '@/engine/profiling/missing'
import { profileDataset } from '@/engine/profiling/profile'
import type { CellValue, Dataset } from '@/engine/types'

function dataset(names: string[], rows: CellValue[][]): Dataset {
    return {
        columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
        rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
    }
}

function opts(
    columnIds: string[],
    action: MissingAction,
    placeholders: string[] = [],
): MissingOptions {
    return { columnIds, placeholders, action }
}

const fillWith = (value: string): MissingAction => ({ kind: 'fill', value })
const removeWhen = (when: 'any' | 'all'): MissingAction => ({
    kind: 'removeRows',
    when,
})

const ALL = ['c1', 'c2', 'c3']

// Row numbers 2 to 7. Position 1: Name missing. Position 2: Qty missing and
// City is only spaces. Position 3: Name is the text N/A. Position 4: all missing.
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

function rowNumbers(data: Dataset): number[] {
    return data.rows.map((row) => row.sourceRow)
}

describe('resolvePlaceholders', () => {
    it('trims, ignores case and drops blank entries and repeats', () => {
        expect([...resolvePlaceholders([' N/A ', 'n/a', '', '  ', 'Unknown'])]).toEqual([
            'n/a',
            'unknown',
        ])
    })

    it.each(['0', 'false', 'TRUE', ' False ', '-5', '1,000', '007', '12.5'])(
        'refuses %s, because it is a real value',
        (entry) => {
            expect(() => resolvePlaceholders([entry])).toThrow(OperationError)
            expect(() => resolvePlaceholders([entry])).toThrow(/real value/)
        },
    )

    it.each(['-', '--', '?', 'unknown', 'n.a.', '#N/A'])('accepts %s', (entry) => {
        expect(resolvePlaceholders([entry]).size).toBe(1)
    })

    it('accepts every built-in placeholder word, and the profile recognises them all', () => {
        expect(() => resolvePlaceholders([...PLACEHOLDER_WORDS])).not.toThrow()
        for (const word of PLACEHOLDER_WORDS) {
            expect(isPossiblePlaceholder(word), word).toBe(true)
        }
    })
})

describe('planMissingValues: what counts as missing', () => {
    it('counts empty and whitespace-only cells, per column and in total', () => {
        const plan = planMissingValues(people, opts(ALL, fillWith('x')))
        expect(
            plan.columns.map((c) => [c.missingCount, c.placeholderCount, c.affectedCount]),
        ).toEqual([
            [2, 0, 2],
            [2, 0, 2],
            [2, 0, 2],
        ])
        expect(plan.missingCells).toBe(6)
        expect(plan.placeholderCells).toBe(0)
        expect(plan.filledCells).toBe(6)
        expect(plan.totalRows).toBe(6)
        expect(plan.cellRows).toEqual([1, 2, 2, 4, 4, 4])
        expect(plan.cellColumns).toEqual([0, 1, 2, 0, 1, 2])
    })

    it('counts chosen placeholders separately, ignoring case and spaces', () => {
        const plan = planMissingValues(people, opts(ALL, fillWith('x'), [' n/a ']))
        expect(
            plan.columns.map((c) => [c.missingCount, c.placeholderCount, c.affectedCount]),
        ).toEqual([
            [2, 1, 3],
            [2, 0, 2],
            [2, 0, 2],
        ])
        expect(plan.missingCells).toBe(6)
        expect(plan.placeholderCells).toBe(1)
        expect(plan.filledCells).toBe(7)
        expect(plan.cellRows).toEqual([1, 2, 2, 3, 4, 4, 4])
        expect(plan.cellColumns).toEqual([0, 1, 2, 0, 0, 1, 2])
    })

    it('does not treat placeholders as missing unless they are chosen', () => {
        const plan = planMissingValues(people, opts(['c1'], fillWith('x')))
        expect(plan.placeholderCells).toBe(0)
        expect(plan.cellRows).toEqual([1, 4])
    })

    it('never treats zero, false or the text 0 as missing', () => {
        const data = dataset(['v'], [[0], [false], ['0'], ['N/A'], [null]])
        expect(planMissingValues(data, opts(['c1'], fillWith('x'))).filledCells).toBe(1)
        const plan = planMissingValues(data, opts(['c1'], fillWith('x'), ['n/a']))
        expect(plan.filledCells).toBe(2)
        expect(plan.cellRows).toEqual([3, 4])
    })

    it('agrees with the Data Quality page on missing cells and placeholders', () => {
        const profile = profileDataset(people)
        const plan = planMissingValues(
            people,
            opts(ALL, fillWith('x'), [...PLACEHOLDER_WORDS]),
        )
        expect(plan.missingCells).toBe(profile.missingCells)
        expect(plan.placeholderCells).toBe(
            profile.columns.reduce((sum, column) => sum + column.placeholderCount, 0),
        )
    })

    it('looks only at the chosen columns', () => {
        const plan = planMissingValues(people, opts(['c2'], fillWith('x')))
        expect(plan.columns).toHaveLength(1)
        expect(plan.columns[0]?.columnId).toBe('c2')
        expect(plan.cellRows).toEqual([2, 4])
        expect(plan.cellColumns).toEqual([1, 1])
    })

    it('does not change the dataset', () => {
        const before = JSON.stringify(people)
        planMissingValues(people, opts(ALL, fillWith('x'), ['n/a']))
        applyMissingValues(people, opts(ALL, fillWith('x'), ['n/a']))
        applyMissingValues(people, opts(ALL, removeWhen('any'), ['n/a']))
        expect(JSON.stringify(people)).toBe(before)
    })
})

describe('planMissingValues: how a typed value goes in', () => {
    const qty = dataset(['Qty'], [[5], [null], [7], [' ']])

    it.each([
        ['0', 'number'],
        ['5', 'number'],
        ['-3', 'number'],
        ['0.5', 'number'],
        ['05', 'text'],
        ['5.0', 'text'],
        ['0.50', 'text'],
        ['1e3', 'text'],
        ['+5', 'text'],
        ['.5', 'text'],
        ['-0', 'text'],
        ['1,000', 'text'],
        ['abc', 'text'],
    ])('inserts %s into a number column as %s', (typed, expected) => {
        const plan = planMissingValues(qty, opts(['c1'], fillWith(typed)))
        expect(plan.columns[0]?.insertAs).toBe(expected)
    })

    it('inserts text into a column that holds text', () => {
        const data = dataset(['v'], [['a'], [null]])
        expect(planMissingValues(data, opts(['c1'], fillWith('0'))).columns[0]?.insertAs).toBe(
            'text',
        )
    })

    it('inserts text into a column that mixes numbers with text or true/false', () => {
        for (const other of ['x', false]) {
            const data = dataset(['v'], [[5], [other], [null]])
            expect(
                planMissingValues(data, opts(['c1'], fillWith('0'))).columns[0]?.insertAs,
            ).toBe('text')
        }
    })

    it('inserts text when nothing is left in the column to show what it holds', () => {
        const data = dataset(['v'], [[null], [' ']])
        expect(planMissingValues(data, opts(['c1'], fillWith('5'))).columns[0]?.insertAs).toBe(
            'text',
        )
    })

    it('keeps placeholders out of the decision', () => {
        const data = dataset(['v'], [[5], ['N/A'], [7]])
        const plan = planMissingValues(data, opts(['c1'], fillWith('0'), ['n/a']))
        expect(plan.columns[0]?.insertAs).toBe('number')
    })

    it('decides for each column separately', () => {
        const plan = planMissingValues(people, opts(ALL, fillWith('0')))
        expect(plan.columns.map((c) => c.insertAs)).toEqual(['text', 'number', 'text'])
    })

    it('flags a column of Excel dates, which a typed value is not', () => {
        const date = (serial: number): CellValue => ({
            kind: 'date',
            serial,
            text: String(serial),
        })
        const data = dataset(['d'], [[date(1)], [null], [date(2)]])
        const plan = planMissingValues(data, opts(['c1'], fillWith('unknown')))
        expect(plan.columns[0]).toMatchObject({ insertAs: 'text', dateColumn: true })
        expect(planMissingValues(qty, opts(['c1'], fillWith('0'))).columns[0]?.dateColumn).toBe(
            false,
        )
    })

    it('removes spaces at the ends of the typed value', () => {
        const plan = planMissingValues(people, opts(['c1'], fillWith('  Unknown  ')))
        expect(plan.fillValue).toBe('Unknown')
    })

    it('refuses a blank value', () => {
        for (const blank of ['', '   ']) {
            expect(() => planMissingValues(people, opts(ALL, fillWith(blank)))).toThrow(
                'Type the value to insert in place of the missing values.',
            )
        }
    })

    it('refuses a value that would itself count as missing', () => {
        expect(() => planMissingValues(people, opts(ALL, fillWith('n/a'), ['N/A']))).toThrow(
            /also one of the placeholders/,
        )
        expect(() => planMissingValues(people, opts(ALL, fillWith('N/A')))).not.toThrow()
    })
})

describe('applyMissingValues: filling', () => {
    it('fills the missing cells, putting a number into a number column', () => {
        const result = applyMissingValues(people, opts(ALL, fillWith('0')))
        expect(result.rows.map((row) => row.cells)).toEqual([
            ['Asha', 5, 'Delhi'],
            ['0', 7, 'Pune'],
            ['Ravi', 0, '0'],
            ['N/A', 0, 'Mumbai'],
            ['0', 0, '0'],
            ['Zoe', 3, 'Chennai'],
        ])
        expect(typeof result.rows[2]?.cells[1]).toBe('number')
        expect(typeof result.rows[1]?.cells[0]).toBe('string')
    })

    it('keeps the row numbers and the order, and shares rows it did not touch', () => {
        const result = applyMissingValues(people, opts(ALL, fillWith('0')))
        expect(rowNumbers(result)).toEqual([2, 3, 4, 5, 6, 7])
        expect(result.columns).toBe(people.columns)
        expect(result.rows[0]).toBe(people.rows[0])
        expect(result.rows[3]).toBe(people.rows[3])
        expect(result.rows[5]).toBe(people.rows[5])
        expect(result.rows[1]).not.toBe(people.rows[1])
    })

    it('also fills chosen placeholders', () => {
        const result = applyMissingValues(people, opts(ALL, fillWith('Unknown'), ['n/a']))
        expect(result.rows[3]?.cells).toEqual(['Unknown', 0, 'Mumbai'])
        expect(result.rows[1]?.cells).toEqual(['Unknown', 7, 'Pune'])
    })

    it('leaves columns that were not chosen alone', () => {
        const result = applyMissingValues(people, opts(['c1'], fillWith('x')))
        expect(result.rows[1]?.cells).toEqual(['x', 7, 'Pune'])
        expect(result.rows[4]?.cells).toEqual(['x', null, null])
        expect(result.rows[2]).toBe(people.rows[2])
    })

    it('keeps text such as 05 exactly as typed', () => {
        const data = dataset(['Qty'], [[5], [null]])
        expect(applyMissingValues(data, opts(['c1'], fillWith('05'))).rows[1]?.cells).toEqual([
            '05',
        ])
        expect(applyMissingValues(data, opts(['c1'], fillWith('7'))).rows[1]?.cells).toEqual([7])
    })

    it('inserts text into a column of Excel dates', () => {
        const date: CellValue = { kind: 'date', serial: 1, text: '1' }
        const data = dataset(['d'], [[date], [null]])
        const result = applyMissingValues(data, opts(['c1'], fillWith('unknown')))
        expect(result.rows[1]?.cells).toEqual(['unknown'])
        expect(result.rows[0]).toBe(data.rows[0])
    })

    it('fills the cells that a short row is missing', () => {
        const data = dataset(['a', 'b'], [['x']])
        const result = applyMissingValues(data, opts(['c1', 'c2'], fillWith('y')))
        expect(result.rows[0]?.cells).toEqual(['x', 'y'])
    })

    it('returns the same dataset when there is nothing to fill', () => {
        const data = dataset(['a'], [['x'], ['y']])
        expect(applyMissingValues(data, opts(['c1'], fillWith('0')))).toBe(data)
    })
})

describe('removing rows with missing values', () => {
    it('removes a row when any chosen column is missing, and says which', () => {
        const plan = planMissingValues(people, opts(ALL, removeWhen('any')))
        expect(plan.removedIndexes).toEqual([1, 2, 4])
        expect(plan.removedMissing).toEqual([[0], [1, 2], [0, 1, 2]])
        expect(plan.removedRows).toBe(3)
        expect(plan.retainedRows).toBe(3)
        expect(plan.filledCells).toBe(0)
        expect(plan.columns.map((c) => c.affectedCount)).toEqual([2, 2, 2])
        expect(plan.columns.map((c) => c.insertAs)).toEqual([null, null, null])
        expect(plan.fillValue).toBeNull()
        expect(rowNumbers(applyMissingValues(people, opts(ALL, removeWhen('any'))))).toEqual([
            2, 5, 7,
        ])
    })

    it('removes a row only when all chosen columns are missing, if asked', () => {
        const plan = planMissingValues(people, opts(ALL, removeWhen('all')))
        expect(plan.removedIndexes).toEqual([4])
        expect(plan.removedMissing).toEqual([[0, 1, 2]])
        expect(rowNumbers(applyMissingValues(people, opts(ALL, removeWhen('all'))))).toEqual([
            2, 3, 4, 5, 7,
        ])
    })

    it('applies "all" to the chosen columns only', () => {
        const plan = planMissingValues(people, opts(['c1', 'c3'], removeWhen('all')))
        expect(plan.removedIndexes).toEqual([4])
    })

    it('ignores columns that were left out', () => {
        const plan = planMissingValues(people, opts(['c1'], removeWhen('any')))
        expect(plan.removedIndexes).toEqual([1, 4])
        expect(plan.removedMissing).toEqual([[0], [0]])
    })

    it('removes rows with chosen placeholders as well', () => {
        const plan = planMissingValues(people, opts(['c1'], removeWhen('any'), ['n/a']))
        expect(plan.removedIndexes).toEqual([1, 3, 4])
    })

    it('keeps the remaining rows in order, as the same objects', () => {
        const result = applyMissingValues(people, opts(ALL, removeWhen('any')))
        expect(result.columns).toBe(people.columns)
        expect(result.rows[0]).toBe(people.rows[0])
        expect(result.rows[1]).toBe(people.rows[3])
        expect(result.rows[2]).toBe(people.rows[5])
    })

    it('returns the same dataset when nothing would be removed', () => {
        const data = dataset(['a'], [['x'], ['y']])
        expect(applyMissingValues(data, opts(['c1'], removeWhen('any')))).toBe(data)
    })
})

describe('choosing columns', () => {
    it('refuses to run with no columns chosen', () => {
        expect(() => planMissingValues(people, opts([], removeWhen('any')))).toThrow(
            'Choose at least one column to look at.',
        )
    })

    it('refuses to run when a chosen column no longer exists', () => {
        expect(() => planMissingValues(people, opts(['c1', 'c9'], fillWith('x')))).toThrow(
            /no longer exists/,
        )
    })

    it('counts a column chosen twice only once', () => {
        const once = planMissingValues(people, opts(['c1'], fillWith('x')))
        const twice = planMissingValues(people, opts(['c1', 'c1'], fillWith('x')))
        expect(twice).toEqual(once)
    })

    it('tells columns with the same name apart by id', () => {
        const data = dataset(['Name', 'Name'], [['a', null], [null, 'b']])
        expect(planMissingValues(data, opts(['c1'], fillWith('x'))).cellRows).toEqual([1])
        expect(planMissingValues(data, opts(['c2'], fillWith('x'))).cellRows).toEqual([0])
    })
})