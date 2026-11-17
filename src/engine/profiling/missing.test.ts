// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isMissing, isPossiblePlaceholder } from '@/engine/profiling/missing'

describe('isMissing', () => {
    it('treats empty cells and whitespace-only text as missing', () => {
        for (const value of [null, undefined, '', ' ', '   ', '\t', '\n', ' \t\r\n ']) {
            expect(isMissing(value), JSON.stringify(value)).toBe(true)
        }
    })

    it('never treats zero, false or ordinary text as missing', () => {
        for (const value of [0, -1, false, true, '0', 'false', 'N/A', 'NULL', 'a', ' a ']) {
            expect(isMissing(value), JSON.stringify(value)).toBe(false)
        }
    })

    it('does not treat a date cell as missing', () => {
        expect(isMissing({ kind: 'date', serial: 0, text: '' })).toBe(false)
    })
})

describe('isPossiblePlaceholder', () => {
    it('recognises common placeholders, ignoring case and surrounding spaces', () => {
        for (const value of ['N/A', 'n/a', ' NA ', '#N/A', 'NULL', 'Nil', 'None', 'NaN', '-', '--']) {
            expect(isPossiblePlaceholder(value), value).toBe(true)
        }
    })

    it('does not flag ordinary values', () => {
        for (const value of ['Asha', 'nano', 'n/a/x', '---', '', ' ', 0, false, null, undefined]) {
            expect(isPossiblePlaceholder(value), JSON.stringify(value)).toBe(false)
        }
    })
})