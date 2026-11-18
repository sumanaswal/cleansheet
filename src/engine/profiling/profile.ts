import { encodeRow } from '@/engine/cellKey'
import {
    classifyValue,
    detectColumnType,
    emptyKindCounts,
    type KindCounts,
} from '@/engine/profiling/columnType'
import { isMissing, isPossiblePlaceholder } from '@/engine/profiling/missing'
import { isNegativeNumber } from '@/engine/profiling/negative'
import type {
    ColumnProfile,
    ColumnType,
    DatasetProfile,
} from '@/engine/profiling/types'
import type { Dataset } from '@/engine/types'

interface Tally {
    kinds: KindCounts
    missing: number
    placeholders: number
    negatives: number
}

const PROBLEM_TYPES: ReadonlySet<ColumnType> = new Set<ColumnType>([
    'mixed',
    'empty',
    'numberText',
    'dateText',
])

/**
 * Analyses a dataset without changing it. Missing cells are empty cells and
 * cells with only whitespace. Duplicate rows are rows identical to an earlier
 * row in every column (exact match); fully empty rows are counted as empty
 * rows and never as duplicates. Negative numbers are counted for information
 * and never mark a column as worth checking.
 */
export function profileDataset(dataset: Dataset): DatasetProfile {
    const { columns, rows } = dataset
    const width = columns.length
    const allColumns = columns.map((_, index) => index)
    const tallies: Tally[] = columns.map(() => ({
        kinds: emptyKindCounts(),
        missing: 0,
        placeholders: 0,
        negatives: 0,
    }))

    let missingCells = 0
    let emptyRows = 0
    let duplicateRows = 0
    let negativeNumbers = 0
    const seen = new Set<string>()

    for (const row of rows) {
        let allMissing = true
        for (let i = 0; i < width; i += 1) {
            const tally = tallies[i]
            if (tally === undefined) continue
            const cell = row.cells[i] ?? null
            if (isMissing(cell)) {
                tally.missing += 1
                missingCells += 1
                continue
            }
            allMissing = false
            if (isPossiblePlaceholder(cell)) {
                tally.placeholders += 1
                continue
            }
            if (isNegativeNumber(cell)) {
                tally.negatives += 1
                negativeNumbers += 1
            }
            tally.kinds[classifyValue(cell)] += 1
        }

        if (width > 0 && allMissing) {
            emptyRows += 1
            continue
        }
        const key = encodeRow(row.cells, allColumns)
        if (seen.has(key)) {
            duplicateRows += 1
        } else {
            seen.add(key)
        }
    }

    const columnProfiles: ColumnProfile[] = []
    let emptyColumns = 0
    for (let i = 0; i < width; i += 1) {
        const column = columns[i]
        const tally = tallies[i]
        if (column === undefined || tally === undefined) continue
        const { type, exceptionCount } = detectColumnType(
            tally.kinds,
            tally.placeholders,
        )
        if (type === 'empty') emptyColumns += 1
        columnProfiles.push({
            id: column.id,
            name: column.name,
            position: i + 1,
            type,
            missingCount: tally.missing,
            placeholderCount: tally.placeholders,
            exceptionCount,
            negativeCount: tally.negatives,
            hasIssues:
                tally.missing > 0 ||
                tally.placeholders > 0 ||
                exceptionCount > 0 ||
                PROBLEM_TYPES.has(type),
        })
    }

    return {
        totalRows: rows.length,
        totalColumns: width,
        duplicateRows,
        missingCells,
        emptyRows,
        emptyColumns,
        negativeNumbers,
        columns: columnProfiles,
    }
}