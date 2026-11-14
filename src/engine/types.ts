/**
 * Core data model for the cleaning engine.
 * Pure TypeScript: no React and no browser APIs (enforced by ESLint).
 */

/**
 * Stable identifier for a column. It is assigned once at import and never
 * reused, so duplicate or renamed headers cannot confuse an operation.
 */
export type ColumnId = string

/**
 * An Excel date cell. It keeps the raw serial number and the text Excel
 * displays, so serial dates stay distinct from text dates.
 */
export interface DateCell {
    readonly kind: 'date'
    readonly serial: number
    readonly text: string
}

/** One cell. `null` means empty. */
export type CellValue = string | number | boolean | null | DateCell

export interface Column {
    readonly id: ColumnId
    /** Header text. May be duplicated, so never use it as an identifier. */
    readonly name: string
}

export interface Row {
    /**
     * Row number in the source sheet, counting from 1 and including the header
     * row, so it matches what the user sees in Excel. Stable across operations.
     */
    readonly sourceRow: number
    /** Cells in the same order as `Dataset.columns`. */
    readonly cells: readonly CellValue[]
}

/** A table of data. Treated as immutable: operations return a new Dataset. */
export interface Dataset {
    readonly columns: readonly Column[]
    readonly rows: readonly Row[]
}

export interface SourceFileInfo {
    readonly name: string
    readonly sizeBytes: number
    readonly format: 'xlsx' | 'csv'
}

export function isDateCell(value: CellValue): value is DateCell {
    return typeof value === 'object' && value !== null
}