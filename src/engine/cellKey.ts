import type { CellValue } from '@/engine/types'

/** How strictly two cells are compared. The default is exact matching. */
export interface KeyOptions {
    readonly caseInsensitive: boolean
    /** Trim text and collapse runs of spaces, tabs and line breaks into one space. */
    readonly normalizeSpaces: boolean
}

export const EXACT_MATCH: KeyOptions = {
    caseInsensitive: false,
    normalizeSpaces: false,
}

function normalizeText(text: string, options: KeyOptions): string {
    let result = text
    if (options.normalizeSpaces) result = result.replace(/\s+/g, ' ').trim()
    if (options.caseInsensitive) result = result.toLowerCase()
    return result
}

/**
 * Encodes one cell so that two cells have the same code only when they match.
 * The text "1" differs from the number 1, and by default case and spaces
 * matter. Options only ever change text: numbers, true/false and dates are
 * never altered. When spaces are ignored, text that is only whitespace counts
 * as an empty cell. Text is length-prefixed, so separators inside values
 * cannot cause clashes.
 */
export function encodeCell(
    cell: CellValue,
    options: KeyOptions = EXACT_MATCH,
): string {
    if (cell === null) return 'n'
    if (typeof cell === 'string') {
        const text = normalizeText(cell, options)
        if (options.normalizeSpaces && text === '') return 'n'
        return `s${text.length}:${text}`
    }
    if (typeof cell === 'number') return `d${cell};`
    if (typeof cell === 'boolean') return cell ? 'b1' : 'b0'
    return `t${cell.serial}:${cell.text.length}:${cell.text}`
}

/** Encodes the cells at the given column positions of one row. */
export function encodeRow(
    cells: readonly CellValue[],
    indexes: readonly number[],
    options: KeyOptions = EXACT_MATCH,
): string {
    const parts: string[] = []
    for (const index of indexes) {
        parts.push(encodeCell(cells[index] ?? null, options))
    }
    return parts.join('|')
}