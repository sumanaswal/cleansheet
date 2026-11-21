import { resolveColumnIndexes } from '@/engine/operations/columns'
import { OperationError } from '@/engine/operations/types'
import { classifyValue } from '@/engine/profiling/columnType'
import { isMissing } from '@/engine/profiling/missing'
import {
    isDateCell,
    type CellValue,
    type ColumnId,
    type Dataset,
    type Row,
} from '@/engine/types'

export type MissingAction =
    /** Put this value into every missing cell of the chosen columns. */
    | { readonly kind: 'fill'; readonly value: string }
    /** Remove rows that are missing a value in any (or in all) of the chosen columns. */
    | { readonly kind: 'removeRows'; readonly when: 'any' | 'all' }

export interface MissingOptions {
    /** Columns to look at. Leave a column out to ignore it. */
    readonly columnIds: readonly ColumnId[]
    /**
     * Text to treat as missing as well, such as "N/A" or "unknown". Matched after
     * trimming and ignoring capital letters. Empty and whitespace-only cells are
     * always missing. Numbers and true/false are never missing.
     */
    readonly placeholders: readonly string[]
    readonly action: MissingAction
}

export interface MissingColumnPlan {
    readonly columnId: ColumnId
    /** Position of the column in the dataset. */
    readonly columnIndex: number
    /** Empty and whitespace-only cells. */
    readonly missingCount: number
    /** Cells matched by the chosen placeholders. */
    readonly placeholderCount: number
    /**
     * Filling: cells that would be filled. Removing: removed rows in which this
     * column was missing.
     */
    readonly affectedCount: number
    /** Filling only: how the typed value goes into this column. Null when removing rows. */
    readonly insertAs: 'text' | 'number' | null
    /** Filling only: the column holds Excel dates, and a typed value is not a real date. */
    readonly dateColumn: boolean
}

export interface MissingPlan {
    readonly totalRows: number
    readonly action: 'fill' | 'removeRows'
    /** One entry per chosen column, in column order. */
    readonly columns: readonly MissingColumnPlan[]
    /** Empty and whitespace-only cells in the chosen columns. */
    readonly missingCells: number
    /** Cells matched by the chosen placeholders. */
    readonly placeholderCells: number
    readonly filledCells: number
    readonly removedRows: number
    readonly retainedRows: number
    /** Filling: the value that would be inserted, with spaces at its ends removed. */
    readonly fillValue: string | null
    /**
     * Filling: the cells that would be filled, as two lists of the same length in
     * row order, then column order. Position of the row, position of the column.
     */
    readonly cellRows: readonly number[]
    readonly cellColumns: readonly number[]
    /** Removing: positions of the rows that would be removed, in file order. */
    readonly removedIndexes: readonly number[]
    /** Removing: for each removed row, the positions of its columns that were missing. */
    readonly removedMissing: readonly (readonly number[])[]
}

/**
 * Turns the typed placeholders into the words that are matched. Numbers and
 * true/false are refused: they are real values and are never missing.
 */
export function resolvePlaceholders(
    entries: readonly string[],
): ReadonlySet<string> {
    const words = new Set<string>()
    for (const entry of entries) {
        const word = entry.trim().toLowerCase()
        if (word === '') continue
        const kind = classifyValue(word)
        if (
            word === 'true' ||
            word === 'false' ||
            kind === 'numberText' ||
            kind === 'idText'
        ) {
            throw new OperationError(
                `"${entry.trim()}" is a real value (a number or true/false), so it cannot be treated as missing.`,
            )
        }
        words.add(word)
    }
    return words
}

function resolveFillValue(value: string, placeholders: ReadonlySet<string>): string {
    const text = value.trim()
    if (text === '') {
        throw new OperationError(
            'Type the value to insert in place of the missing values.',
        )
    }
    if (placeholders.has(text.toLowerCase())) {
        throw new OperationError(
            'The value to insert is also one of the placeholders being treated as missing. Choose a different value.',
        )
    }
    return text
}

/**
 * The number a typed value stands for, or null. Only a value that reads back
 * exactly the same is a plain number, so 05, 5.0, 0.50, 1e3, +5 and -0 stay
 * text and nothing the user typed is changed.
 */
function plainNumber(text: string): number | null {
    const value = Number(text)
    return Number.isFinite(value) && String(value) === text ? value : null
}

type Finding = 'missing' | 'placeholder' | null

function classifyCell(
    cell: CellValue,
    placeholders: ReadonlySet<string>,
): Finding {
    if (isMissing(cell)) return 'missing'
    if (typeof cell === 'string' && placeholders.has(cell.trim().toLowerCase())) {
        return 'placeholder'
    }
    return null
}

interface ColumnStat {
    missing: number
    placeholders: number
    affected: number
    /** Cells that are not missing, by kind. */
    numbers: number
    dates: number
    others: number
}

/**
 * Works out what the operation would do without changing anything. Empty and
 * whitespace-only cells are missing, as on the Data Quality page. Placeholders
 * are missing only when chosen. Zero, false and other numbers never are.
 */
export function planMissingValues(
    dataset: Dataset,
    options: MissingOptions,
): MissingPlan {
    const indexes = resolveColumnIndexes(
        dataset,
        options.columnIds,
        'Choose at least one column to look at.',
    )
    const placeholders = resolvePlaceholders(options.placeholders)
    const { action } = options
    const fillText =
        action.kind === 'fill' ? resolveFillValue(action.value, placeholders) : null
    const fillNumber = fillText === null ? null : plainNumber(fillText)

    const stats: ColumnStat[] = indexes.map(() => ({
        missing: 0,
        placeholders: 0,
        affected: 0,
        numbers: 0,
        dates: 0,
        others: 0,
    }))
    const cellRows: number[] = []
    const cellColumns: number[] = []
    const removedIndexes: number[] = []
    const removedMissing: number[][] = []

    for (const [rowIndex, row] of dataset.rows.entries()) {
        // Positions, within the chosen columns, that are missing in this row.
        const hits: number[] = []
        for (const [k, columnIndex] of indexes.entries()) {
            const stat = stats[k]
            if (stat === undefined) continue
            const cell = row.cells[columnIndex] ?? null
            const finding = classifyCell(cell, placeholders)
            if (finding === 'missing') stat.missing += 1
            else if (finding === 'placeholder') stat.placeholders += 1
            else if (typeof cell === 'number') stat.numbers += 1
            else if (isDateCell(cell)) stat.dates += 1
            else stat.others += 1
            if (finding !== null) hits.push(k)
        }
        if (hits.length === 0) continue

        if (action.kind === 'fill') {
            for (const k of hits) {
                const columnIndex = indexes[k]
                const stat = stats[k]
                if (columnIndex === undefined || stat === undefined) continue
                cellRows.push(rowIndex)
                cellColumns.push(columnIndex)
                stat.affected += 1
            }
        } else if (action.when === 'any' || hits.length === indexes.length) {
            removedIndexes.push(rowIndex)
            const positions: number[] = []
            for (const k of hits) {
                const columnIndex = indexes[k]
                const stat = stats[k]
                if (columnIndex === undefined || stat === undefined) continue
                positions.push(columnIndex)
                stat.affected += 1
            }
            removedMissing.push(positions)
        }
    }

    const filling = action.kind === 'fill'
    const columns: MissingColumnPlan[] = []
    let missingCells = 0
    let placeholderCells = 0
    for (const [k, columnIndex] of indexes.entries()) {
        const stat = stats[k]
        const column = dataset.columns[columnIndex]
        if (stat === undefined || column === undefined) continue
        missingCells += stat.missing
        placeholderCells += stat.placeholders
        // A number goes into a column only when every value left in it is a number.
        const onlyNumbers = stat.numbers > 0 && stat.dates === 0 && stat.others === 0
        const onlyDates = stat.dates > 0 && stat.numbers === 0 && stat.others === 0
        columns.push({
            columnId: column.id,
            columnIndex,
            missingCount: stat.missing,
            placeholderCount: stat.placeholders,
            affectedCount: stat.affected,
            insertAs: filling ? (fillNumber !== null && onlyNumbers ? 'number' : 'text') : null,
            dateColumn: filling && onlyDates,
        })
    }

    return {
        totalRows: dataset.rows.length,
        action: action.kind,
        columns,
        missingCells,
        placeholderCells,
        filledCells: cellRows.length,
        removedRows: removedIndexes.length,
        retainedRows: dataset.rows.length - removedIndexes.length,
        fillValue: fillText,
        cellRows,
        cellColumns,
        removedIndexes,
        removedMissing,
    }
}

/**
 * Returns the dataset with the missing values filled in, or the rows with
 * missing values removed. Rows that are not touched are the same objects as
 * before and nothing is reordered. When there is nothing to do, the same
 * dataset is returned.
 */
export function applyMissingValues(
    dataset: Dataset,
    options: MissingOptions,
): Dataset {
    const plan = planMissingValues(dataset, options)

    if (plan.action === 'removeRows') {
        if (plan.removedRows === 0) return dataset
        const drop = new Set(plan.removedIndexes)
        return {
            columns: dataset.columns,
            rows: dataset.rows.filter((_, index) => !drop.has(index)),
        }
    }

    const text = plan.fillValue
    if (text === null || plan.filledCells === 0) return dataset
    const values = new Map<number, CellValue>()
    for (const column of plan.columns) {
        values.set(
            column.columnIndex,
            column.insertAs === 'number' ? Number(text) : text,
        )
    }

    const width = dataset.columns.length
    const rows: Row[] = dataset.rows.slice()
    let i = 0
    while (i < plan.cellRows.length) {
        const rowIndex = plan.cellRows[i]
        const original = rowIndex === undefined ? undefined : dataset.rows[rowIndex]
        if (rowIndex === undefined || original === undefined) {
            i += 1
            continue
        }
        const cells: CellValue[] = original.cells.slice()
        while (cells.length < width) cells.push(null)
        while (i < plan.cellRows.length && plan.cellRows[i] === rowIndex) {
            const columnIndex = plan.cellColumns[i]
            const value = columnIndex === undefined ? undefined : values.get(columnIndex)
            if (columnIndex !== undefined && value !== undefined) {
                cells[columnIndex] = value
            }
            i += 1
        }
        rows[rowIndex] = { sourceRow: original.sourceRow, cells }
    }
    return { columns: dataset.columns, rows }
}