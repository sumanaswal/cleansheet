import { isDateCell, type CellValue } from '@/engine/types'

export type CellKind = 'empty' | 'blank' | 'text' | 'number' | 'boolean' | 'date'

export interface CellDisplay {
    readonly kind: CellKind
    /** What to show in the cell. */
    readonly text: string
    /** Extra detail shown on hover. */
    readonly title?: string
}

/** Longest text shown in one cell. Longer text is cut and shown in full on hover. */
export const MAX_DISPLAY_LENGTH = 200
const MAX_TITLE_LENGTH = 1000

/**
 * Decides how a cell appears in the table. Display only: it never changes the
 * data, and numbers show their stored value, not Excel's number format.
 */
export function displayCell(value: CellValue | undefined): CellDisplay {
    if (value === undefined || value === null) return { kind: 'empty', text: '' }
    if (typeof value === 'boolean') {
        return { kind: 'boolean', text: value ? 'TRUE' : 'FALSE' }
    }
    if (typeof value === 'number') return { kind: 'number', text: String(value) }
    if (isDateCell(value)) {
        return {
            kind: 'date',
            text: value.text !== '' ? value.text : String(value.serial),
            title: `Excel date, serial number ${value.serial}`,
        }
    }

    if (value === '') return { kind: 'empty', text: '' }
    if (value.trim() === '') {
        return {
            kind: 'blank',
            text: '(blank text)',
            title: `Contains only whitespace (${value.length} character${value.length === 1 ? '' : 's'})`,
        }
    }

    const flattened = value.replace(/\r\n|\r|\n/g, '↵').replace(/\t/g, '→')
    const tooLong = flattened.length > MAX_DISPLAY_LENGTH
    const text = tooLong
        ? `${flattened.slice(0, MAX_DISPLAY_LENGTH - 1)}…`
        : flattened
    if (tooLong || flattened !== value) {
        return { kind: 'text', text, title: value.slice(0, MAX_TITLE_LENGTH) }
    }
    return { kind: 'text', text }
}