// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { encodeCell, encodeRow, EXACT_MATCH, type KeyOptions } from '@/engine/cellKey'
import type { CellValue } from '@/engine/types'

const both: KeyOptions = { caseInsensitive: true, normalizeSpaces: true }
const spaces: KeyOptions = { caseInsensitive: false, normalizeSpaces: true }
const letters: KeyOptions = { caseInsensitive: true, normalizeSpaces: false }

describe('encodeCell: exact matching', () => {
    it('keeps text, numbers, booleans and empty cells apart', () => {
        const codes = [
            encodeCell('1'),
            encodeCell(1),
            encodeCell(true),
            encodeCell('true'),
            encodeCell(false),
            encodeCell(null),
            encodeCell(''),
        ]
        expect(new Set(codes).size).toBe(codes.length)
    })

    it('keeps case, spaces and leading zeros distinct', () => {
        expect(encodeCell('Asha')).not.toBe(encodeCell('asha'))
        expect(encodeCell('Asha')).not.toBe(encodeCell('Asha '))
        expect(encodeCell('001')).not.toBe(encodeCell('1'))
    })

    it('matches identical values', () => {
        expect(encodeCell('Asha', EXACT_MATCH)).toBe(encodeCell('Asha'))
        expect(encodeCell(0)).toBe(encodeCell(0))
        const date = (text: string): CellValue => ({ kind: 'date', serial: 46000, text })
        expect(encodeCell(date('09-12-2025'))).toBe(encodeCell(date('09-12-2025')))
        expect(encodeCell(date('09-12-2025'))).not.toBe(encodeCell(date('9/12/2025')))
    })
})

describe('encodeCell: options', () => {
    it('ignores case only when asked', () => {
        expect(encodeCell('Asha', letters)).toBe(encodeCell('ASHA', letters))
        expect(encodeCell('Asha ', letters)).not.toBe(encodeCell('Asha', letters))
    })

    it('trims and collapses spaces, tabs, line breaks and non-breaking spaces', () => {
        const base = encodeCell('Asha Singh', spaces)
        for (const text of [' Asha  Singh', 'Asha\tSingh', 'Asha\nSingh ', 'Asha\u00a0Singh']) {
            expect(encodeCell(text, spaces), JSON.stringify(text)).toBe(base)
        }
        expect(encodeCell('ASHA Singh', spaces)).not.toBe(base)
    })

    it('treats whitespace-only text as an empty cell when spaces are ignored', () => {
        expect(encodeCell('  \t ', spaces)).toBe(encodeCell(null))
        expect(encodeCell('  \t ', EXACT_MATCH)).not.toBe(encodeCell(null))
    })

    it('never changes numbers, booleans or dates', () => {
        const date: CellValue = { kind: 'date', serial: 46000, text: 'ABC' }
        for (const value of [1, 0, -2.5, true, false, date]) {
            expect(encodeCell(value, both)).toBe(encodeCell(value))
        }
        expect(encodeCell('1', both)).not.toBe(encodeCell(1, both))
    })
})

describe('encodeRow', () => {
    it('does not let separators inside values cause clashes', () => {
        const all = [0, 1]
        expect(encodeRow(['a|b', 'c'], all)).not.toBe(encodeRow(['a', 'b|c'], all))
        expect(encodeRow(['a', 'bc'], all)).not.toBe(encodeRow(['ab', 'c'], all))
    })

    it('uses only the chosen columns, and treats a missing cell as empty', () => {
        expect(encodeRow(['a', 'x'], [0])).toBe(encodeRow(['a', 'y'], [0]))
        expect(encodeRow(['a'], [0, 1])).toBe(encodeRow(['a', null], [0, 1]))
    })
})