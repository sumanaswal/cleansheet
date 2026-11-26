import {
    planDuplicateRemoval,
    removeDuplicates,
    type DuplicateOptions,
} from '@/engine/operations/duplicates'
import {
    applyMissingValues,
    planMissingValues,
    type MissingPlan,
} from '@/engine/operations/missingValues'
import {
    applyTextCleaning,
    cleanText,
    planTextCleaning,
    type TextCleaningOptions,
    type TextPlan,
} from '@/engine/operations/textCleaning'
import type { CellValue, Dataset } from '@/engine/types'
import type {
    CellMarkKind,
    MissingPreviewDetails,
    OperationPreviewSummary,
    OperationSpec,
    PreviewItem,
    RowMark,
    TextPreviewDetails,
} from '@/workers/protocol'

/** A calculated preview. Holds the plan so records can be listed page by page. */
export interface OperationPreview {
    readonly summary: OperationPreviewSummary
    /** A page of affected records. */
    items(offset: number, limit: number): PreviewItem[]
    /** Whether table pages should carry a mark for each row. */
    readonly marksRows: boolean
    /** How the row at this position of the dataset is marked, if at all. */
    mark(index: number): RowMark | null
    /** What a highlighted cell means. Only used when the operation changes cells. */
    readonly cellMarkKind: CellMarkKind
    /**
     * For the rows at positions offset to offset + count - 1, the positions of
     * the columns whose cell would change. Undefined when the operation changes
     * no cells.
     */
    cellMarks(offset: number, count: number): number[][] | undefined
}

/** Index of the first value that is not below the target, in a list sorted from low to high. */
function lowerBound(values: readonly number[], target: number): number {
    let low = 0
    let high = values.length
    while (low < high) {
        const middle = (low + high) >>> 1
        const value = values[middle]
        if (value !== undefined && value < target) low = middle + 1
        else high = middle
    }
    return low
}

/**
 * Given the changed cells as two lists in row order (row position, column
 * position), returns for each of `count` rows from `offset` the positions of
 * the columns that change. The first changed cell on the page is found with a
 * binary search, so a page does not need one object per changed cell.
 */
function markCells(
    cellRows: readonly number[],
    cellColumns: readonly number[],
    total: number,
    offset: number,
    count: number,
): number[][] {
    const marks: number[][] = Array.from({ length: count }, () => [])
    let k = lowerBound(cellRows, offset)
    while (k < total) {
        const rowIndex = cellRows[k]
        const columnIndex = cellColumns[k]
        if (
            rowIndex === undefined ||
            columnIndex === undefined ||
            rowIndex >= offset + count
        ) {
            break
        }
        marks[rowIndex - offset]?.push(columnIndex)
        k += 1
    }
    return marks
}

function previewDuplicates(
    dataset: Dataset,
    options: DuplicateOptions,
): OperationPreview {
    const plan = planDuplicateRemoval(dataset, options)
    const removed = new Set(plan.removed.map((entry) => entry.index))
    const kept = new Set(plan.removed.map((entry) => entry.keptIndex))
    return {
        summary: {
            totalRows: plan.totalRows,
            removedRows: plan.removed.length,
            retainedRows: plan.totalRows - plan.removed.length,
            skippedRows: plan.skippedRows,
            itemCount: plan.removed.length,
        },
        marksRows: true,
        cellMarkKind: 'fill',
        items(offset, limit) {
            const items: PreviewItem[] = []
            for (const entry of plan.removed.slice(offset, offset + limit)) {
                const row = dataset.rows[entry.index]
                const keptRow = dataset.rows[entry.keptIndex]
                if (row === undefined || keptRow === undefined) continue
                items.push({
                    kind: 'removedRow',
                    row,
                    keptSourceRow: keptRow.sourceRow,
                })
            }
            return items
        },
        mark(index) {
            if (removed.has(index)) return 'remove'
            if (kept.has(index)) return 'keep'
            return null
        },
        cellMarks() {
            return undefined
        },
    }
}

function missingDetails(
    dataset: Dataset,
    plan: MissingPlan,
): MissingPreviewDetails {
    return {
        action: plan.action,
        fillValue: plan.fillValue,
        missingCells: plan.missingCells,
        placeholderCells: plan.placeholderCells,
        filledCells: plan.filledCells,
        columns: plan.columns.map((column) => ({
            columnId: column.columnId,
            position: column.columnIndex + 1,
            name: dataset.columns[column.columnIndex]?.name ?? '',
            missingCount: column.missingCount,
            placeholderCount: column.placeholderCount,
            affectedCount: column.affectedCount,
            insertAs: column.insertAs,
            dateColumn: column.dateColumn,
        })),
    }
}

function previewFill(dataset: Dataset, plan: MissingPlan): OperationPreview {
    // What goes into each chosen column: a number or the typed text.
    const newValues = new Map<number, CellValue>()
    if (plan.fillValue !== null) {
        for (const column of plan.columns) {
            newValues.set(
                column.columnIndex,
                column.insertAs === 'number' ? Number(plan.fillValue) : plan.fillValue,
            )
        }
    }
    return {
        summary: {
            totalRows: plan.totalRows,
            removedRows: 0,
            retainedRows: plan.totalRows,
            skippedRows: 0,
            itemCount: plan.filledCells,
            missing: missingDetails(dataset, plan),
        },
        marksRows: false,
        cellMarkKind: 'fill',
        items(offset, limit) {
            const items: PreviewItem[] = []
            const end = Math.min(plan.filledCells, offset + limit)
            for (let k = offset; k < end; k += 1) {
                const rowIndex = plan.cellRows[k]
                const columnIndex = plan.cellColumns[k]
                if (rowIndex === undefined || columnIndex === undefined) continue
                const row = dataset.rows[rowIndex]
                const column = dataset.columns[columnIndex]
                const newValue = newValues.get(columnIndex)
                if (row === undefined || column === undefined || newValue === undefined) {
                    continue
                }
                items.push({
                    kind: 'filledCell',
                    row,
                    columnPosition: columnIndex + 1,
                    columnName: column.name,
                    oldValue: row.cells[columnIndex] ?? null,
                    newValue,
                })
            }
            return items
        },
        mark() {
            return null
        },
        cellMarks(offset, count) {
            return markCells(plan.cellRows, plan.cellColumns, plan.filledCells, offset, count)
        },
    }
}

function previewRemoval(dataset: Dataset, plan: MissingPlan): OperationPreview {
    const removed = new Set(plan.removedIndexes)
    return {
        summary: {
            totalRows: plan.totalRows,
            removedRows: plan.removedRows,
            retainedRows: plan.retainedRows,
            skippedRows: 0,
            itemCount: plan.removedRows,
            missing: missingDetails(dataset, plan),
        },
        marksRows: true,
        cellMarkKind: 'fill',
        items(offset, limit) {
            const items: PreviewItem[] = []
            const end = Math.min(plan.removedRows, offset + limit)
            for (let k = offset; k < end; k += 1) {
                const rowIndex = plan.removedIndexes[k]
                const row = rowIndex === undefined ? undefined : dataset.rows[rowIndex]
                if (row === undefined) continue
                items.push({
                    kind: 'removedMissingRow',
                    row,
                    missingColumns: (plan.removedMissing[k] ?? []).map((columnIndex) => ({
                        position: columnIndex + 1,
                        name: dataset.columns[columnIndex]?.name ?? '',
                    })),
                })
            }
            return items
        },
        mark(index) {
            return removed.has(index) ? 'remove' : null
        },
        cellMarks() {
            return undefined
        },
    }
}

function textDetails(dataset: Dataset, plan: TextPlan): TextPreviewDetails {
    return {
        textCells: plan.textCells,
        nonTextCells: plan.nonTextCells,
        changedCells: plan.changedCells,
        removedChars: plan.removedChars,
        keptAddresses: plan.keptAddresses,
        columns: plan.columns.map((column) => ({
            columnId: column.columnId,
            position: column.columnIndex + 1,
            name: dataset.columns[column.columnIndex]?.name ?? '',
            textCells: column.textCells,
            nonTextCells: column.nonTextCells,
            changedCount: column.changedCount,
            ruleCounts: column.ruleCounts,
            removedChars: column.removedChars,
            keptAddressCount: column.keptAddressCount,
        })),
    }
}

function previewText(
    dataset: Dataset,
    plan: TextPlan,
    options: TextCleaningOptions,
): OperationPreview {
    return {
        summary: {
            totalRows: plan.totalRows,
            removedRows: 0,
            retainedRows: plan.totalRows,
            skippedRows: 0,
            itemCount: plan.changedCells,
            text: textDetails(dataset, plan),
        },
        marksRows: false,
        cellMarkKind: 'change',
        items(offset, limit) {
            const items: PreviewItem[] = []
            const end = Math.min(plan.changedCells, offset + limit)
            for (let k = offset; k < end; k += 1) {
                const rowIndex = plan.cellRows[k]
                const columnIndex = plan.cellColumns[k]
                if (rowIndex === undefined || columnIndex === undefined) continue
                const row = dataset.rows[rowIndex]
                const column = dataset.columns[columnIndex]
                const old = row?.cells[columnIndex]
                if (row === undefined || column === undefined || typeof old !== 'string') {
                    continue
                }
                items.push({
                    kind: 'changedText',
                    row,
                    columnPosition: columnIndex + 1,
                    columnName: column.name,
                    oldText: old,
                    newText: cleanText(old, options).text,
                })
            }
            return items
        },
        mark() {
            return null
        },
        cellMarks(offset, count) {
            return markCells(plan.cellRows, plan.cellColumns, plan.changedCells, offset, count)
        },
    }
}

/**
 * Works out what an operation would do, without changing the dataset.
 * Throws an OperationError when the settings cannot be used.
 */
export function buildPreview(
    dataset: Dataset,
    operation: OperationSpec,
): OperationPreview {
    switch (operation.kind) {
        case 'duplicates':
            return previewDuplicates(dataset, operation.options)
        case 'missing': {
            const plan = planMissingValues(dataset, operation.options)
            return plan.action === 'fill'
                ? previewFill(dataset, plan)
                : previewRemoval(dataset, plan)
        }
        case 'text':
            return previewText(
                dataset,
                planTextCleaning(dataset, operation.options),
                operation.options,
            )
    }
}

/**
 * Applies an operation and returns the new dataset. The same dataset object is
 * returned when the operation changes nothing. Always works from the settings,
 * never from a stored preview.
 */
export function applyToDataset(
    dataset: Dataset,
    operation: OperationSpec,
): Dataset {
    switch (operation.kind) {
        case 'duplicates':
            return removeDuplicates(dataset, operation.options)
        case 'missing':
            return applyMissingValues(dataset, operation.options)
        case 'text':
            return applyTextCleaning(dataset, operation.options)
    }
}

/**
 * Counts the cells that differ between a dataset and the one an operation made
 * from it. Meant for operations that keep every row in place, such as filling
 * or text cleaning: rows that were not touched are the same objects and are
 * skipped. Returns 0 when the datasets have a different number of rows.
 */
export function countChangedCells(before: Dataset, after: Dataset): number {
    if (before === after || before.rows.length !== after.rows.length) return 0
    let changed = 0
    for (const [index, row] of after.rows.entries()) {
        const original = before.rows[index]
        if (original === undefined || original === row) continue
        const width = Math.max(row.cells.length, original.cells.length)
        for (let i = 0; i < width; i += 1) {
            if ((row.cells[i] ?? null) !== (original.cells[i] ?? null)) changed += 1
        }
    }
    return changed
}