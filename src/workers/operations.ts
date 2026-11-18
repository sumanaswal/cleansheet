import {
    planDuplicateRemoval,
    removeDuplicates,
} from '@/engine/operations/duplicates'
import type { Dataset } from '@/engine/types'
import type {
    OperationPreviewSummary,
    OperationSpec,
    PreviewItem,
    RowMark,
} from '@/workers/protocol'

/** A calculated preview. Holds the plan so records can be listed page by page. */
export interface OperationPreview {
    readonly summary: OperationPreviewSummary
    /** A page of affected records. */
    items(offset: number, limit: number): PreviewItem[]
    /** How the row at this position of the dataset is marked, if at all. */
    mark(index: number): RowMark | null
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
        case 'duplicates': {
            const plan = planDuplicateRemoval(dataset, operation.options)
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
            }
        }
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
    }
}