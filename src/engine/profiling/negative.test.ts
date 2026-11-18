// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isNegativeNumber } from '@/engine/profiling/negative'

describe('isNegativeNumber', () => {
    it('counts number cells below zero', () => {
        for (const value of [-1, -0.5, -1250.5, -1e-9]) {
            expect(isNegativeNumber(value), String(value)).toBe(true)
        }
    })

    it('does not count zero, negative zero or positive numbers', () => {
        for (const value of [0, -0, 1, 0.5, 1250]) {
            expect(isNegativeNumber(value), String(value)).toBe(false)
        }
    })

    it('counts text that is clearly a negative number', () => {
        for (const value of ['-1', '-12', '-1,250.50', '-0.5', ' -7 ', '-007']) {
            expect(isNegativeNumber(value), value).toBe(true)
        }
    })

    it('does not count other text, placeholders or accounting brackets', () => {
        for (const value of [
            '-',
            '--',
            '-0',
            '-0.00',
            '5',
            '+5',
            '(500)',
            '-12abc',
            '1-2',
            '--5',
            '- 5',
            '-,500',
            '-1,25',
            'abc',
            '',
        ]) {
            expect(isNegativeNumber(value), value).toBe(false)
        }
    })

    it('never counts booleans, date cells or empty cells', () => {
        expect(isNegativeNumber(false)).toBe(false)
        expect(isNegativeNumber(true)).toBe(false)
        expect(isNegativeNumber({ kind: 'date', serial: -5, text: '-5' })).toBe(false)
        expect(isNegativeNumber(null)).toBe(false)
        expect(isNegativeNumber(undefined)).toBe(false)
    })
})