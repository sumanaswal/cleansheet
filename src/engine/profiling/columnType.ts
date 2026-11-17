import type { ColumnType } from '@/engine/profiling/types'
import type { CellValue } from '@/engine/types'

export type ValueKind =
    | 'number'
    | 'boolean'
    | 'date'
    | 'numberText'
    | 'idText'
    | 'dateText'
    | 'text'

export type KindCounts = Record<ValueKind, number>

export function emptyKindCounts(): KindCounts {
    return {
        number: 0,
        boolean: 0,
        date: 0,
        numberText: 0,
        idText: 0,
        dateText: 0,
        text: 0,
    }
}

/** A column gets a type when at least this share of its values fit it. */
const MATCH_PERCENT = 90

const LEADING_ZERO_NUMBER = /^0[0-9]+$/
const NUMBER_TEXT = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/
const DAY_OR_MONTH_FIRST = /^(\d{1,2})[/.-](\d{1,2})[/.-](?:\d{2}|\d{4})$/
const YEAR_FIRST =
    /^\d{4}[/.-](\d{1,2})[/.-](\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/
const MONTH_NAME =
    /^\d{1,2}[ -](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?[ -]\d{2,4}$/i

function inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max
}

/**
 * True when text has the shape of a plausible date. Nothing is interpreted:
 * 03/04/2026 is flagged as a date without deciding which part is the month.
 */
function looksLikeDate(text: string): boolean {
    const first = DAY_OR_MONTH_FIRST.exec(text)
    if (first !== null) {
        const a = Number(first[1])
        const b = Number(first[2])
        return inRange(a, 1, 31) && inRange(b, 1, 31) && Math.min(a, b) <= 12
    }
    const yearFirst = YEAR_FIRST.exec(text)
    if (yearFirst !== null) {
        return (
            inRange(Number(yearFirst[1]), 1, 12) && inRange(Number(yearFirst[2]), 1, 31)
        )
    }
    return MONTH_NAME.test(text)
}

function classifyText(raw: string): ValueKind {
    const text = raw.trim()
    if (LEADING_ZERO_NUMBER.test(text)) return 'idText'
    if (NUMBER_TEXT.test(text)) return 'numberText'
    if (looksLikeDate(text)) return 'dateText'
    return 'text'
}

/** Classifies one value. Callers skip missing cells before calling this. */
export function classifyValue(value: CellValue): ValueKind {
    if (typeof value === 'string') return classifyText(value)
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    return value === null ? 'text' : 'date'
}

function total(counts: KindCounts): number {
    return (
        counts.number +
        counts.boolean +
        counts.date +
        counts.numberText +
        counts.idText +
        counts.dateText +
        counts.text
    )
}

/**
 * Decides a column's type from the kinds of its values. `counts` excludes
 * missing cells and possible placeholders. A type is chosen when at least 90%
 * of the values fit it, and the others are counted as exceptions.
 */
export function detectColumnType(
    counts: KindCounts,
    placeholderCount: number,
): { type: ColumnType; exceptionCount: number } {
    const all = total(counts)
    if (all === 0) {
        // Only placeholders: there is something in the column, but no clear type.
        return { type: placeholderCount > 0 ? 'text' : 'empty', exceptionCount: 0 }
    }

    const groups: ReadonlyArray<readonly [ColumnType, number]> = [
        ['number', counts.number],
        ['boolean', counts.boolean],
        ['date', counts.date],
        // One value with leading zeros makes converting to numbers unsafe.
        [counts.idText > 0 ? 'idText' : 'numberText', counts.numberText + counts.idText],
        ['dateText', counts.dateText],
        ['text', counts.text],
    ]

    let bestType: ColumnType = 'text'
    let bestCount = -1
    for (const [type, count] of groups) {
        if (count > bestCount) {
            bestType = type
            bestCount = count
        }
    }

    // Whole-number arithmetic, so a column of exactly 90% passes.
    if (bestCount * 100 >= all * MATCH_PERCENT) {
        return { type: bestType, exceptionCount: all - bestCount }
    }
    return { type: 'mixed', exceptionCount: 0 }
}