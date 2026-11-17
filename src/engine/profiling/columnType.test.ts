// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    classifyValue,
    detectColumnType,
    emptyKindCounts,
    type KindCounts,
} from '@/engine/profiling/columnType'

function counts(partial: Partial<KindCounts>): KindCounts {
    return { ...emptyKindCounts(), ...partial }
}

describe('classifyValue', () => {
    it('classifies numbers, booleans and date cells', () => {
        expect(classifyValue(5)).toBe('number')
        expect(classifyValue(0)).toBe('number')
        expect(classifyValue(true)).toBe('boolean')
        expect(classifyValue(false)).toBe('boolean')
        expect(
            classifyValue({ kind: 'date', serial: 46000, text: '09-12-2025' }),
        ).toBe('date')
    })

    it('recognises text that looks like a number, and text with leading zeros', () => {
        for (const value of ['123', '0', '-5', '+7', '1,234', '1,234,567.50', '12.5', ' 42 ']) {
            expect(classifyValue(value), value).toBe('numberText')
        }
        for (const value of ['00123', '007', '00']) {
            expect(classifyValue(value), value).toBe('idText')
        }
    })

    it('recognises text that looks like a date without interpreting it', () => {
        for (const value of [
            '03/04/2026',
            '3-4-26',
            '2026-04-03',
            '2026/4/3',
            '31/12/2026',
            '12/31/2026',
            '03.04.2026',
            '2026-04-03T10:30:00',
            '2026-04-03 10:30',
            '12 Jan 2024',
            '12-Jan-24',
            '12 January, 2024',
            '12-January-2024',
        ]) {
            expect(classifyValue(value), value).toBe('dateText')
        }
    })

    it('keeps text that only resembles a date or number as text', () => {
        for (const value of [
            '13/13/2026',
            '32/01/2026',
            '00/05/2026',
            '2026-13-01',
            '2026-04-32',
            '12/2026',
            '1/2/3',
            '12 Foo 2024',
            'Asha',
            'abc 12',
        ]) {
            expect(classifyValue(value), value).toBe('text')
        }
    })
})

describe('detectColumnType', () => {
    it('gives a column of one kind that type with no exceptions', () => {
        expect(detectColumnType(counts({ number: 5 }), 0)).toEqual({
            type: 'number',
            exceptionCount: 0,
        })
        expect(detectColumnType(counts({ text: 5 }), 0)).toEqual({
            type: 'text',
            exceptionCount: 0,
        })
    })

    it('accepts a column that is exactly 90 percent one type and counts the rest', () => {
        expect(detectColumnType(counts({ number: 9, text: 1 }), 0)).toEqual({
            type: 'number',
            exceptionCount: 1,
        })
    })

    it('calls a column mixed when no type reaches 90 percent', () => {
        expect(detectColumnType(counts({ number: 8, text: 2 }), 0)).toEqual({
            type: 'mixed',
            exceptionCount: 0,
        })
        expect(
            detectColumnType(counts({ number: 1, text: 1, boolean: 1 }), 0).type,
        ).toBe('mixed')
    })

    it('labels a column ID-like when any value has leading zeros', () => {
        expect(detectColumnType(counts({ numberText: 4, idText: 1 }), 0)).toEqual({
            type: 'idText',
            exceptionCount: 0,
        })
        expect(detectColumnType(counts({ idText: 9, text: 1 }), 0)).toEqual({
            type: 'idText',
            exceptionCount: 1,
        })
    })

    it('labels numbers stored as text when none has leading zeros', () => {
        expect(detectColumnType(counts({ numberText: 5 }), 0)).toEqual({
            type: 'numberText',
            exceptionCount: 0,
        })
    })

    it('tells an empty column from one that holds only placeholders', () => {
        expect(detectColumnType(counts({}), 0)).toEqual({
            type: 'empty',
            exceptionCount: 0,
        })
        expect(detectColumnType(counts({}), 3)).toEqual({
            type: 'text',
            exceptionCount: 0,
        })
    })

    it('detects boolean, date and date-like text columns', () => {
        expect(detectColumnType(counts({ boolean: 3 }), 0).type).toBe('boolean')
        expect(detectColumnType(counts({ date: 3 }), 0).type).toBe('date')
        expect(detectColumnType(counts({ dateText: 3 }), 0).type).toBe('dateText')
    })

    it('keeps a mostly-text column as text and counts the odd values as exceptions', () => {
        expect(detectColumnType(counts({ text: 95, number: 5 }), 0)).toEqual({
            type: 'text',
            exceptionCount: 5,
        })
    })
})