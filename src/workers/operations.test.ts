// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
    DEFAULT_DUPLICATE_OPTIONS,
    type DuplicateOptions,
} from '@/engine/operations/duplicates'
import { OperationError } from '@/engine/operations/types'
import type { CellValue, Dataset } from '@/engine/types'
import { applyToDataset, buildPreview } from '@/workers/operations'
import type { OperationSpec } from '@/workers/protocol'

function dataset(names: string[], rows: CellValue[][]): Dataset {
    return {
        columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
        rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
    }
}

function duplicates(overrides: Partial<DuplicateOptions> = {}): OperationSpec {
    return {
        kind: 'duplicates',
        options: { ...DEFAULT_DUPLICATE_OPTIONS, ...overrides },
    }
}

// Row numbers 2 to 6: A, B, A, C, A
const letters = dataset(['v'], [['A'], ['B'], ['A'], ['C'], ['A']])

describe('buildPreview: duplicates', () => {
    it('counts the rows that would be removed and kept', () => {
        expect(buildPreview(letters, duplicates()).summary).toEqual({
            totalRows: 5,
            removedRows: 2,
            retainedRows: 3,
            skippedRows: 0,
            itemCount: 2,
        })
    })

    it('reports rows that were skipped because they have no usable values', () => {
        const data = dataset(['v'], [[null], [' '], ['A'], ['A']])
        const { summary } = buildPreview(data, duplicates())
        expect(summary.skippedRows).toBe(2)
        expect(summary.removedRows).toBe(1)
    })

    it('lists each removed row with the row that stays instead', () => {
        const preview = buildPreview(letters, duplicates())
        expect(preview.items(0, 10)).toEqual([
            { kind: 'removedRow', row: letters.rows[2], keptSourceRow: 2 },
            { kind: 'removedRow', row: letters.rows[4], keptSourceRow: 2 },
        ])
    })

    it('lists records a page at a time', () => {
        const preview = buildPreview(letters, duplicates())
        expect(preview.items(0, 1).map((item) => item.row.sourceRow)).toEqual([4])
        expect(preview.items(1, 1).map((item) => item.row.sourceRow)).toEqual([6])
        expect(preview.items(2, 10)).toEqual([])
    })

    it('names the later row as the one that stays when keeping the last', () => {
        const preview = buildPreview(letters, duplicates({ keep: 'last' }))
        expect(
            preview
                .items(0, 10)
                .map((item) => [
                    item.row.sourceRow,
                    item.kind === 'removedRow' ? item.keptSourceRow : -1,
                ]),
        ).toEqual([
            [2, 6],
            [4, 6],
        ])
    })

    it('marks removed rows and the rows that stay instead', () => {
        const preview = buildPreview(letters, duplicates())
        expect([0, 1, 2, 3, 4].map((index) => preview.mark(index))).toEqual([
            'keep',
            null,
            'remove',
            null,
            'remove',
        ])
    })

    it('marks rows the other way round when keeping the last', () => {
        const preview = buildPreview(letters, duplicates({ keep: 'last' }))
        expect([0, 1, 2, 3, 4].map((index) => preview.mark(index))).toEqual([
            'remove',
            null,
            'remove',
            null,
            'keep',
        ])
    })

    it('does not change the dataset', () => {
        const before = JSON.stringify(letters)
        buildPreview(letters, duplicates())
        expect(JSON.stringify(letters)).toBe(before)
    })

    it('refuses settings that cannot be used', () => {
        expect(() => buildPreview(letters, duplicates({ columnIds: [] }))).toThrow(
            OperationError,
        )
    })
})

describe('applyToDataset: duplicates', () => {
    it('returns a dataset without the duplicate rows', () => {
        const result = applyToDataset(letters, duplicates())
        expect(result.rows.map((row) => row.sourceRow)).toEqual([2, 3, 5])
    })

    it('returns the same dataset when nothing would change', () => {
        const data = dataset(['v'], [['A'], ['B']])
        expect(applyToDataset(data, duplicates())).toBe(data)
    })

    it('refuses settings that cannot be used', () => {
        expect(() => applyToDataset(letters, duplicates({ columnIds: [] }))).toThrow(
            'Choose at least one column to compare.',
        )
    })
})