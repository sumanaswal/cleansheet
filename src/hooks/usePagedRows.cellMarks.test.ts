import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Row } from '@/engine/types'
import { PAGE_SIZE, usePagedRows } from '@/hooks/usePagedRows'
import type { PageResult } from '@/workers/importClient'

function rowsFor(count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
        sourceRow: i + 2,
        cells: [String(i)],
    }))
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('usePagedRows: cell marks', () => {
    it('returns the cell marks that come with a page', async () => {
        const getPage = vi.fn().mockResolvedValue({
            offset: 0,
            rows: rowsFor(2),
            rowCount: 2,
            cellMarks: [[0], []],
        })
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 2))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.cellMarks).toEqual([[0], []])
        expect(result.current.marks).toBeUndefined()
    })

    it('has no cell marks when the page has none', async () => {
        const getPage = vi
            .fn()
            .mockResolvedValue({ offset: 0, rows: rowsFor(2), rowCount: 2 })
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 2))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.cellMarks).toBeUndefined()
    })

    it('hides old cell marks until the page is loaded again after a change', async () => {
        const first: PageResult = {
            offset: 0,
            rows: rowsFor(1),
            rowCount: 1,
            cellMarks: [[0]],
        }
        const second = deferred<PageResult>()
        const getPage = vi
            .fn()
            .mockResolvedValueOnce(first)
            .mockReturnValueOnce(second.promise)
        const version = {}
        const { result, rerender } = renderHook(
            ({ key }) => usePagedRows(getPage, version, 1, PAGE_SIZE, key),
            { initialProps: { key: 0 } },
        )
        await waitFor(() => expect(result.current.cellMarks).toEqual([[0]]))

        rerender({ key: 1 })
        expect(result.current.cellMarks).toBeUndefined()
        expect(result.current.rows).toHaveLength(1)

        await act(async () => {
            second.resolve({ offset: 0, rows: rowsFor(1), rowCount: 1 })
        })
        expect(result.current.cellMarks).toBeUndefined()
        expect(getPage).toHaveBeenCalledTimes(2)
    })
})