import type { CellValue } from '@/engine/types'

/**
 * A cell is missing when it is empty or holds only whitespace.
 * Zero, false and text such as "N/A" are real values and are never missing.
 */
export function isMissing(value: CellValue | undefined): boolean {
    if (value === undefined || value === null) return true
    return typeof value === 'string' && value.trim() === ''
}

const PLACEHOLDERS: ReadonlySet<string> = new Set([
    'n/a',
    'na',
    '#n/a',
    'null',
    'nil',
    'none',
    'nan',
    '-',
    '--',
])

/**
 * Text that often stands in for a missing value. It is only reported as a
 * possible placeholder, because "NA" or "None" can be real data.
 */
export function isPossiblePlaceholder(value: CellValue | undefined): boolean {
    if (typeof value !== 'string') return false
    return PLACEHOLDERS.has(value.trim().toLowerCase())
}