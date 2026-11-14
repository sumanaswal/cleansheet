// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isDateCell, type CellValue } from '@/engine/types'

describe('isDateCell', () => {
    it('recognises a date cell', () => {
        const cell: CellValue = { kind: 'date', serial: 46000, text: '09-12-2025' }
        expect(isDateCell(cell)).toBe(true)
    })

    it('rejects every other kind of cell', () => {
        const others: CellValue[] = ['text', '00123', '', 0, 42, true, false, null]
        for (const value of others) {
            expect(isDateCell(value)).toBe(false)
        }
    })
})