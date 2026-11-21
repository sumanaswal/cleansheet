import { OperationError } from '@/engine/operations/types'
import type { ColumnId, Dataset } from '@/engine/types'

/**
 * Turns chosen column ids into column positions, in ascending order with each
 * column once. Throws an OperationError, with a message for the user, when no
 * column is chosen or a chosen column no longer exists.
 */
export function resolveColumnIndexes(
    dataset: Dataset,
    columnIds: readonly ColumnId[],
    emptyMessage: string,
): number[] {
    if (columnIds.length === 0) {
        throw new OperationError(emptyMessage)
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