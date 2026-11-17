// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { displayCell, MAX_DISPLAY_LENGTH } from '@/components/workspace/cellDisplay'

describe('displayCell', () => {
    it('shows nothing for empty cells', () => {
        for (const value of [null, undefined, '']) {
            expect(displayCell(value)).toEqual({ kind: 'empty', text: '' })
        }
    })

    it('shows booleans the way Excel does', () => {
        expect(displayCell(true)).toEqual({ kind: 'boolean', text: 'TRUE' })
        expect(displayCell(false)).toEqual({ kind: 'boolean', text: 'FALSE' })
    })

    it('shows numbers as stored, including zero', () => {
        expect(displayCell(0)).toEqual({ kind: 'number', text: '0' })
        expect(displayCell(-1.5)).toEqual({ kind: 'number', text: '-1.5' })
        expect(displayCell(30010.5)).toEqual({ kind: 'number', text: '30010.5' })
    })

    it('shows a date as Excel displays it, with the serial number on hover', () => {
        expect(
            displayCell({ kind: 'date', serial: 46000, text: '09-12-2025' }),
        ).toEqual({
            kind: 'date',
            text: '09-12-2025',
            title: 'Excel date, serial number 46000',
        })
    })

    it('falls back to the serial number when a date has no display text', () => {
        expect(displayCell({ kind: 'date', serial: 46000, text: '' }).text).toBe('46000')
    })

    it('labels text that is only whitespace', () => {
        expect(displayCell('   ')).toEqual({
            kind: 'blank',
            text: '(blank text)',
            title: 'Contains only whitespace (3 characters)',
        })
        expect(displayCell(' ').title).toBe('Contains only whitespace (1 character)')
        expect(displayCell('\t\n').kind).toBe('blank')
    })

    it('shows ordinary text as it is, keeping its spaces', () => {
        expect(displayCell('  Asha  ')).toEqual({ kind: 'text', text: '  Asha  ' })
    })

    it('keeps leading zeros', () => {
        expect(displayCell('00123')).toEqual({ kind: 'text', text: '00123' })
    })

    it('replaces line breaks and tabs and keeps the original on hover', () => {
        expect(displayCell('a\r\nb\nc\td')).toEqual({
            kind: 'text',
            text: 'a↵b↵c→d',
            title: 'a\r\nb\nc\td',
        })
    })

    it('cuts long text and keeps the full text on hover, up to a limit', () => {
        const long = displayCell('x'.repeat(300))
        expect(long.text).toHaveLength(MAX_DISPLAY_LENGTH)
        expect(long.text.endsWith('…')).toBe(true)
        expect(long.title).toBe('x'.repeat(300))
        expect(displayCell('x'.repeat(5000)).title).toHaveLength(1000)
    })
})