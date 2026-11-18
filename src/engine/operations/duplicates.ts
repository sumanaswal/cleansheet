import { encodeRow, type KeyOptions } from '@/engine/cellKey'
import { OperationError } from '@/engine/operations/types'
import { isMissing } from '@/engine/profiling/missing'
import type { CellValue, ColumnId, Dataset } from '@/engine/types'

export interface DuplicateOptions {
    /** Columns to compare, or null to compare every column. */
    readonly columnIds: readonly ColumnId[] | null
    /** Which row of each group of duplicates stays. */
    readonly keep: 'first' | 'last'
    readonly caseInsensitive: boolean
    readonly normalizeSpaces: boolean
}

export const DEFAULT_DUPLICATE_OPTIONS: DuplicateOptions = {
    columnIds: null,
    keep: 'first',
    caseInsensitive: false,
    normalizeSpaces: false,
}

export interface RemovedRow {
    /** Position of the row that would be removed (index into dataset.rows). */
    readonly index: number
    /** Position of the row that is kept instead. */
    readonly keptIndex: number
}

export interface DuplicatePlan {
    readonly totalRows: number
    /** Rows that would be removed, in file order. */
    readonly removed: readonly RemovedRow[]
    /**
     * Rows that were never compared because they have no usable values: fully
     * empty rows when comparing every column, or rows where any selected
     * column is missing when comparing selected columns.
     */
    readonly skippedRows: number
}

function resolveColumns(
    dataset: Dataset,
    columnIds: readonly ColumnId[] | null,
): number[] {
    if (columnIds === null) return dataset.columns.map((_, index) => index)
    if (columnIds.length === 0) {
        throw new OperationError('Choose at least one column to compare.')
    }
    const positions = new Map<ColumnId, number>(
        dataset.columns.map((column, index) => [column.id, index] as const),
    )
    const indexes = new Set<number>()
    for (const id of columnIds) {
        const position = positions.get(id)
        if (position === undefined) {
            throw new OperationError(
                'One of the selected columns no longer exists. Please choose the columns again.',
            )
        }
        indexes.add(position)
    }
    return [...indexes].sort((a, b) => a - b)
}

function isSkipped(
    cells: readonly CellValue[],
    indexes: readonly number[],
    allColumns: boolean,
): boolean {
    if (allColumns) {
        return indexes.length > 0 && indexes.every((i) => isMissing(cells[i]))
    }
    return indexes.some((i) => isMissing(cells[i]))
}

/**
 * Works out which rows are duplicates without changing anything. Rows with
 * missing values in the compared columns are skipped, never matched, so two
 * blank identifiers are not treated as the same identifier.
 */
export function planDuplicateRemoval(
    dataset: Dataset,
    options: DuplicateOptions,
): DuplicatePlan {
    const indexes = resolveColumns(dataset, options.columnIds)
    const allColumns = options.columnIds === null
    const keyOptions: KeyOptions = {
        caseInsensitive: options.caseInsensitive,
        normalizeSpaces: options.normalizeSpaces,
    }

    // The row that stays for each distinct key: the first one seen, or the last.
    const keys: Array<string | null> = []
    const kept = new Map<string, number>()
    let skippedRows = 0
    for (const [index, row] of dataset.rows.entries()) {
        if (isSkipped(row.cells, indexes, allColumns)) {
            skippedRows += 1
            keys.push(null)
            continue
        }
        const key = encodeRow(row.cells, indexes, keyOptions)
        keys.push(key)
        if (options.keep === 'last' || !kept.has(key)) kept.set(key, index)
    }

    const removed: RemovedRow[] = []
    for (const [index, key] of keys.entries()) {
        if (key === null) continue
        const keptIndex = kept.get(key)
        if (keptIndex !== undefined && keptIndex !== index) {
            removed.push({ index, keptIndex })
        }
    }

    return { totalRows: dataset.rows.length, removed, skippedRows }
}

/**
 * Returns a dataset without the duplicate rows. The kept rows stay in their
 * original order and are the same objects as before. When there is nothing to
 * remove, the same dataset is returned.
 */
export function removeDuplicates(
    dataset: Dataset,
    options: DuplicateOptions,
): Dataset {
    const plan = planDuplicateRemoval(dataset, options)
    if (plan.removed.length === 0) return dataset
    const drop = new Set(plan.removed.map((entry) => entry.index))
    return {
        columns: dataset.columns,
        rows: dataset.rows.filter((_, index) => !drop.has(index)),
    }
}