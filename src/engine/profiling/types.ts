import type { ColumnId } from '@/engine/types'

export type ColumnType =
    | 'text'
    | 'number'
    | 'date'
    | 'boolean'
    /** Text values that look like numbers, such as "123" in a CSV file. */
    | 'numberText'
    /** Text values that look like dates, such as "03/04/2026". Never interpreted here. */
    | 'dateText'
    /** Numbers written with leading zeros, such as "00123". Converting would lose the zeros. */
    | 'idText'
    | 'mixed'
    | 'empty'

export interface ColumnProfile {
    readonly id: ColumnId
    readonly name: string
    /** Position of the column, starting at 1. Tells apart columns with the same name. */
    readonly position: number
    readonly type: ColumnType
    /** Empty cells and cells with only whitespace. */
    readonly missingCount: number
    /** Values such as N/A or NULL. Reported, but not counted as missing. */
    readonly placeholderCount: number
    /** Values that do not fit the detected type. 0 for Mixed and Empty columns. */
    readonly exceptionCount: number
    /** Number cells below zero, and text that is clearly a negative number. Informational only. */
    readonly negativeCount: number
    /** True when the column has something worth checking. Negative numbers do not count. */
    readonly hasIssues: boolean
}

export interface DatasetProfile {
    /** Data rows, not counting the header row. */
    readonly totalRows: number
    readonly totalColumns: number
    /** Rows identical to an earlier row in every column. Empty rows are not counted. */
    readonly duplicateRows: number
    readonly missingCells: number
    /** Rows in which every cell is missing. */
    readonly emptyRows: number
    /** Columns in which every data cell is missing. */
    readonly emptyColumns: number
    /** Negative numbers in the whole dataset. Informational only. */
    readonly negativeNumbers: number
    readonly columns: readonly ColumnProfile[]
}