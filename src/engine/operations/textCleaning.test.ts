// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    DEFAULT_DUPLICATE_OPTIONS,
    planDuplicateRemoval,
} from '@/engine/operations/duplicates'
import {
    applyTextCleaning,
    cleanText,
    DEFAULT_TEXT_RULES,
    planTextCleaning,
    type TextCleaningOptions,
    type TextRules,
} from '@/engine/operations/textCleaning'
import { OperationError } from '@/engine/operations/types'
import type { CellValue, Dataset } from '@/engine/types'

// Every rule off, so each test says exactly which rules it uses.
const NONE: TextRules = {
    removeNonPrinting: false,
    lineBreaksToSpace: false,
    trimEnds: false,
    collapseSpaces: false,
    textCase: 'none',
    keepAddressCase: true,
}

function rules(overrides: Partial<TextRules> = {}): TextRules {
    return { ...NONE, ...overrides }
}

function clean(text: string, overrides: Partial<TextRules> = {}) {
    return cleanText(text, rules(overrides))
}

describe('DEFAULT_TEXT_RULES', () => {
    it('starts with the safe clean-up rules on, and the case alone', () => {
        expect(DEFAULT_TEXT_RULES).toEqual({
            removeNonPrinting: true,
            lineBreaksToSpace: false,
            trimEnds: true,
            collapseSpaces: true,
            textCase: 'none',
            keepAddressCase: true,
        })
    })
})

describe('cleanText: non-printing characters', () => {
    it('removes control characters, zero-width characters, the soft hyphen and the byte order mark', () => {
        const result = clean('a\u200Bb\u0000c\u00ADd\uFEFFe\u2060f', {
            removeNonPrinting: true,
        })
        expect(result.text).toBe('abcdef')
        expect(result.removedChars).toBe(5)
        expect(result.changed).toBe(true)
        expect(result.changedBy.nonPrinting).toBe(true)
    })

    it('keeps tabs and line breaks, and removes delete and the C1 controls', () => {
        const result = clean('a\tb\nc\rd\u007Fe\u0085f\u0001g', {
            removeNonPrinting: true,
        })
        expect(result.text).toBe('a\tb\nc\rdefg')
        expect(result.removedChars).toBe(3)
    })

    it('keeps joiners and direction marks that scripts such as Hindi and Persian need', () => {
        const marks = 'a\u200Db\u200Cc\u200Ed\u200Fe'
        expect(clean(marks, { removeNonPrinting: true }).changed).toBe(false)
        const hindi = 'क\u094D\u200Dष'
        const result = clean(hindi, { removeNonPrinting: true })
        expect(result.text).toBe(hindi)
        expect(result.changed).toBe(false)
    })

    it('keeps emoji', () => {
        const result = clean('a😀b', { removeNonPrinting: true })
        expect(result.text).toBe('a😀b')
        expect(result.changed).toBe(false)
    })

    it('leaves the characters alone when the rule is off', () => {
        const result = clean('a\u200Bb')
        expect(result.text).toBe('a\u200Bb')
        expect(result.changed).toBe(false)
        expect(result.removedChars).toBe(0)
    })

    it('leaves nothing, not an empty string, when only invisible characters were there', () => {
        const result = clean('\u200B\u200B', { removeNonPrinting: true })
        expect(result.text).toBeNull()
        expect(result.changed).toBe(true)
    })
})

describe('cleanText: trimming', () => {
    it('removes whitespace at both ends, including tabs, line breaks and non-breaking spaces', () => {
        const result = clean(' \t\u00A0a b\n ', { trimEnds: true })
        expect(result.text).toBe('a b')
        expect(result.changedBy.trim).toBe(true)
    })

    it('keeps the spaces inside the text', () => {
        expect(clean(' a  b ', { trimEnds: true }).text).toBe('a  b')
    })

    it('runs after the non-printing rule, so an invisible character cannot shield a space', () => {
        expect(clean('\u200B a', { trimEnds: true }).text).toBe('\u200B a')
        expect(clean('\u200B a', { trimEnds: true, removeNonPrinting: true }).text).toBe('a')
    })

    it('leaves nothing, not an empty string, for a cell that is only whitespace', () => {
        const result = clean('   ', { trimEnds: true })
        expect(result.text).toBeNull()
        expect(result.changed).toBe(true)
    })

    it('does nothing when the rule is off', () => {
        expect(clean('  a ').text).toBe('  a ')
    })
})

describe('cleanText: line breaks', () => {
    it('replaces every kind of line break with a space when asked', () => {
        const result = clean('a\nb\r\nc\rd\u2028e', { lineBreaksToSpace: true })
        expect(result.text).toBe('a b c d e')
        expect(result.changedBy.lineBreaks).toBe(true)
    })

    it('keeps line breaks by default', () => {
        expect(clean('a\nb').text).toBe('a\nb')
        expect(clean('a\nb', { trimEnds: true, collapseSpaces: true }).text).toBe('a\nb')
    })

    it('leaves two spaces for two line breaks, unless spaces are also collapsed', () => {
        expect(clean('a\n\nb', { lineBreaksToSpace: true }).text).toBe('a  b')
        expect(
            clean('a\n\nb', { lineBreaksToSpace: true, collapseSpaces: true }).text,
        ).toBe('a b')
    })

    it('leaves a line break at the end to the trim rule', () => {
        const result = clean('a\n', { lineBreaksToSpace: true, trimEnds: true })
        expect(result.text).toBe('a')
        expect(result.changedBy.trim).toBe(true)
        expect(result.changedBy.lineBreaks).toBe(false)
    })
})

describe('cleanText: collapsing spaces', () => {
    it.each([
        ['a   b', 'a b'],
        ['a\t\tb', 'a b'],
        ['a\u00A0\u00A0b', 'a b'],
        ['a \t \u00A0b', 'a b'],
        ['a\tb', 'a b'],
        ['a\u00A0b', 'a b'],
        ['  a', ' a'],
    ])('turns %j into %j', (input, expected) => {
        const result = clean(input, { collapseSpaces: true })
        expect(result.text).toBe(expected)
        expect(result.changedBy.collapse).toBe(true)
    })

    it('leaves a single space and line breaks alone', () => {
        for (const text of ['a b', 'a \n b', 'a\n\nb']) {
            const result = clean(text, { collapseSpaces: true })
            expect(result.text).toBe(text)
            expect(result.changed).toBe(false)
        }
    })
})

describe('cleanText: changing case', () => {
    it('changes to upper and lower case', () => {
        expect(clean('Asha Singh', { textCase: 'upper' }).text).toBe('ASHA SINGH')
        expect(clean('Asha Singh', { textCase: 'lower' }).text).toBe('asha singh')
        expect(clean('abc123', { textCase: 'upper' }).text).toBe('ABC123')
    })

    it('uses the standard Unicode rules', () => {
        expect(clean('straße', { textCase: 'upper' }).text).toBe('STRASSE')
    })

    it.each([
        ['ASHA SINGH', 'Asha Singh'],
        ['asha singh', 'Asha Singh'],
        ["mary-jane o'brien", "Mary-Jane O'brien"],
        ['north/south (east) [west] {up}', 'North/South (East) [West] {Up}'],
        ['3rd place', '3rd Place'],
        ["DON'T", "Don't"],
        ['mcdonald', 'Mcdonald'],
        ['  leading', '  Leading'],
    ])('title case turns %j into %j', (input, expected) => {
        expect(clean(input, { textCase: 'title' }).text).toBe(expected)
    })

    it('does not change text that is already in the right case', () => {
        const result = clean('Asha Singh', { textCase: 'title' })
        expect(result.changed).toBe(false)
        expect(result.changedBy.textCase).toBe(false)
    })

    it('does nothing when no case is chosen', () => {
        expect(clean('Asha SINGH').text).toBe('Asha SINGH')
    })

    it('leaves scripts without capital letters alone', () => {
        for (const mode of ['upper', 'lower', 'title'] as const) {
            const result = clean('नमस्ते', { textCase: mode })
            expect(result.text).toBe('नमस्ते')
            expect(result.changed).toBe(false)
        }
    })

    it('leaves text that looks like a number alone', () => {
        expect(clean('00123', { textCase: 'title' }).text).toBe('00123')
    })
})

describe('cleanText: email and web addresses', () => {
    it.each([
        ['JOHN@EXAMPLE.COM', 'lower'],
        ['John@Example.com', 'upper'],
        ['WWW.EXAMPLE.COM', 'lower'],
        ['HTTPS://EXAMPLE.COM', 'lower'],
        ['https://Example.com/Path', 'title'],
    ] as const)('keeps the case of %s when changing to %s', (text, mode) => {
        const result = clean(text, { textCase: mode })
        expect(result.text).toBe(text)
        expect(result.changed).toBe(false)
        expect(result.keptAddress).toBe(true)
        expect(result.changedBy.textCase).toBe(false)
    })

    it('changes the case of an address when asked to', () => {
        const result = clean('JOHN@EXAMPLE.COM', {
            textCase: 'lower',
            keepAddressCase: false,
        })
        expect(result.text).toBe('john@example.com')
        expect(result.keptAddress).toBe(false)
        expect(result.changedBy.textCase).toBe(true)
    })

    it('does not count an address whose case would not change anyway', () => {
        const result = clean('john@example.com', { textCase: 'lower' })
        expect(result.changed).toBe(false)
        expect(result.keptAddress).toBe(false)
    })

    it('only protects a cell that is entirely an address', () => {
        expect(clean('mail john@x.com', { textCase: 'title' }).text).toBe('Mail John@x.com')
    })

    it('still applies the other rules to an address', () => {
        const result = clean('  JOHN@X.COM ', {
            trimEnds: true,
            textCase: 'lower',
        })
        expect(result.text).toBe('JOHN@X.COM')
        expect(result.changedBy.trim).toBe(true)
        expect(result.keptAddress).toBe(true)
    })
})

describe('cleanText: all the rules together', () => {
    it('runs the rules in order', () => {
        const result = clean(' \u200BASHA   SINGH\n', {
            removeNonPrinting: true,
            trimEnds: true,
            collapseSpaces: true,
            textCase: 'title',
        })
        expect(result.text).toBe('Asha Singh')
        expect(result.changed).toBe(true)
        expect(result.removedChars).toBe(1)
        expect(result.changedBy).toEqual({
            nonPrinting: true,
            trim: true,
            lineBreaks: false,
            collapse: true,
            textCase: true,
        })
    })

    it('reports no change for text that is already clean', () => {
        const result = clean('Asha Singh', {
            removeNonPrinting: true,
            trimEnds: true,
            lineBreaksToSpace: true,
            collapseSpaces: true,
        })
        expect(result.text).toBe('Asha Singh')
        expect(result.changed).toBe(false)
        expect(Object.values(result.changedBy).some(Boolean)).toBe(false)
        expect(result.removedChars).toBe(0)
        expect(result.keptAddress).toBe(false)
    })
})

// --- Working on a dataset ---------------------------------------------------

function dataset(names: string[], rows: CellValue[][]): Dataset {
    return {
        columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
        rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
    }
}

function options(
    columnIds: string[],
    overrides: Partial<TextRules> = {},
): TextCleaningOptions {
    return { ...rules(overrides), columnIds }
}

const ALL = ['c1', 'c2', 'c3']
const tidy: Partial<TextRules> = {
    trimEnds: true,
    collapseSpaces: true,
    textCase: 'title',
}
const date: CellValue = { kind: 'date', serial: 1, text: '1' }

// Row numbers 2 to 6.
const people = dataset(
    ['Name', 'Qty', 'Email'],
    [
        ['  asha   singh ', 5, 'ASHA@X.COM'],
        ['RAVI', 7, ' ravi@x.com'],
        [null, 0, '\u200B'],
        ['Zoe', true, 'zoe'],
        ['  ', date, 'Zoe'],
    ],
)

describe('planTextCleaning', () => {
    const plan = planTextCleaning(people, options(ALL, tidy))

    it('counts the cells that would change, and the ones that are left alone', () => {
        expect(plan.totalRows).toBe(5)
        expect(plan.changedCells).toBe(5)
        expect(plan.textCells).toBe(9)
        expect(plan.nonTextCells).toBe(5)
        expect(plan.keptAddresses).toBe(2)
        expect(plan.removedChars).toBe(0)
    })

    it('lists the cells in row order, then column order', () => {
        expect(plan.cellRows).toEqual([0, 1, 1, 3, 4])
        expect(plan.cellColumns).toEqual([0, 0, 2, 2, 0])
    })

    it('counts each chosen column', () => {
        expect(
            plan.columns.map((c) => [c.columnId, c.textCells, c.nonTextCells, c.changedCount]),
        ).toEqual([
            ['c1', 4, 0, 3],
            ['c2', 0, 5, 0],
            ['c3', 5, 0, 2],
        ])
        expect(plan.columns[0]?.ruleCounts).toEqual({
            nonPrinting: 0,
            trim: 2,
            lineBreaks: 0,
            collapse: 1,
            textCase: 2,
        })
        expect(plan.columns[2]?.ruleCounts).toEqual({
            nonPrinting: 0,
            trim: 1,
            lineBreaks: 0,
            collapse: 0,
            textCase: 1,
        })
        expect(plan.columns[2]?.keptAddressCount).toBe(2)
    })

    it('never counts numbers, true/false and dates as text', () => {
        expect(plan.columns[1]).toMatchObject({ textCells: 0, nonTextCells: 5, changedCount: 0 })
    })

    it('counts the characters the non-printing rule would remove', () => {
        const noisy = dataset(['v'], [['a\u200Bb\u200B'], ['c\u0000'], ['d']])
        const result = planTextCleaning(noisy, options(['c1'], { removeNonPrinting: true }))
        expect(result.removedChars).toBe(3)
        expect(result.changedCells).toBe(2)
        expect(result.columns[0]?.ruleCounts.nonPrinting).toBe(2)
    })

    it('counts the cells changed by the line break rule', () => {
        const data = dataset(['v'], [['a\nb'], ['c']])
        const result = planTextCleaning(data, options(['c1'], { lineBreaksToSpace: true }))
        expect(result.columns[0]?.ruleCounts.lineBreaks).toBe(1)
        expect(result.changedCells).toBe(1)
    })

    it('looks only at the chosen columns', () => {
        const only = planTextCleaning(people, options(['c1'], tidy))
        expect(only.columns).toHaveLength(1)
        expect(only.changedCells).toBe(3)
        expect(only.cellColumns).toEqual([0, 0, 0])
    })

    it('tells columns with the same name apart by id', () => {
        const data = dataset(['Name', 'Name'], [[' a', ' b']])
        expect(planTextCleaning(data, options(['c1'], tidy)).cellColumns).toEqual([0])
        expect(planTextCleaning(data, options(['c2'], tidy)).cellColumns).toEqual([1])
    })

    it('counts a column chosen twice only once', () => {
        expect(planTextCleaning(people, options(['c1', 'c1'], tidy))).toEqual(
            planTextCleaning(people, options(['c1'], tidy)),
        )
    })

    it('does not change the dataset', () => {
        const before = JSON.stringify(people)
        planTextCleaning(people, options(ALL, tidy))
        applyTextCleaning(people, options(ALL, tidy))
        expect(JSON.stringify(people)).toBe(before)
    })
})

describe('planTextCleaning: settings that cannot be used', () => {
    it('refuses to run with no columns chosen', () => {
        expect(() => planTextCleaning(people, options([], tidy))).toThrow(OperationError)
        expect(() => planTextCleaning(people, options([], tidy))).toThrow(
            'Choose at least one column to clean.',
        )
    })

    it('refuses to run when a chosen column no longer exists', () => {
        expect(() => planTextCleaning(people, options(['c1', 'c9'], tidy))).toThrow(
            /no longer exists/,
        )
    })

    it('refuses to run with no cleaning option chosen', () => {
        expect(() => planTextCleaning(people, options(ALL))).toThrow(OperationError)
        expect(() => planTextCleaning(people, options(ALL))).toThrow(
            'Choose at least one cleaning option.',
        )
    })

    it('does not count protecting addresses as a cleaning option', () => {
        expect(() =>
            planTextCleaning(people, options(ALL, { keepAddressCase: true })),
        ).toThrow('Choose at least one cleaning option.')
    })
})

describe('applyTextCleaning', () => {
    const result = applyTextCleaning(people, options(ALL, tidy))

    it('cleans the text and leaves everything else alone', () => {
        expect(result.rows.map((row) => row.cells)).toEqual([
            ['Asha Singh', 5, 'ASHA@X.COM'],
            ['Ravi', 7, 'ravi@x.com'],
            [null, 0, '\u200B'],
            ['Zoe', true, 'Zoe'],
            [null, date, 'Zoe'],
        ])
    })

    it('keeps the row numbers and the order, and shares rows it did not touch', () => {
        expect(result.rows.map((row) => row.sourceRow)).toEqual([2, 3, 4, 5, 6])
        expect(result.columns).toBe(people.columns)
        expect(result.rows[2]).toBe(people.rows[2])
        expect(result.rows[0]).not.toBe(people.rows[0])
    })

    it('leaves a cell that is only whitespace empty, not as an empty string', () => {
        expect(result.rows[4]?.cells[0]).toBeNull()
    })

    it('only cleans the chosen columns', () => {
        const only = applyTextCleaning(people, options(['c1'], tidy))
        expect(only.rows[1]?.cells).toEqual(['Ravi', 7, ' ravi@x.com'])
    })

    it('keeps text that looks like a number as text', () => {
        const data = dataset(['id'], [[' 007 ']])
        const cleaned = applyTextCleaning(data, options(['c1'], { trimEnds: true }))
        expect(cleaned.rows[0]?.cells[0]).toBe('007')
    })

    it('returns the same dataset when there is nothing to change', () => {
        const data = dataset(['v'], [['Asha'], ['Zoe'], [3], [null]])
        expect(applyTextCleaning(data, options(['c1'], tidy))).toBe(data)
    })

    it('fills out a short row so it lines up with the columns', () => {
        const data = dataset(['a', 'b'], [['  x']])
        const cleaned = applyTextCleaning(data, options(['c1', 'c2'], { trimEnds: true }))
        expect(cleaned.rows[0]?.cells).toEqual(['x', null])
    })

    it('makes rows that only differed by spaces or case identical, so duplicates can be found', () => {
        const names = dataset(['Name'], [['Asha'], [' asha '], ['ASHA'], ['Ravi']])
        expect(planDuplicateRemoval(names, DEFAULT_DUPLICATE_OPTIONS).removed).toHaveLength(0)
        const cleaned = applyTextCleaning(
            names,
            options(['c1'], { trimEnds: true, textCase: 'lower' }),
        )
        expect(planDuplicateRemoval(cleaned, DEFAULT_DUPLICATE_OPTIONS).removed).toHaveLength(2)
    })
})