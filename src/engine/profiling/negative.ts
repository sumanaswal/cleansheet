import type { CellValue } from '@/engine/types'

// A minus sign, then digits with optional thousands commas and decimals.
const NEGATIVE_NUMBER_TEXT = /^-(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/

/**
 * True for a number below zero, and for text that is clearly a negative
 * number, such as "-12" or "-1,250.50" (CSV files store numbers as text).
 * Zero and -0 are not negative. A lone "-" is not a number. Accounting
 * brackets such as (500) are not treated as numbers.
 */
export function isNegativeNumber(value: CellValue | undefined): boolean {
    if (typeof value === 'number') return value < 0
    if (typeof value !== 'string') return false
    const text = value.trim()
    if (!NEGATIVE_NUMBER_TEXT.test(text)) return false
    return Number(text.replaceAll(',', '')) < 0
}