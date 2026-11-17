import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Row } from '@/engine/types'
import { PAGE_SIZE, usePagedRows } from '@/hooks/usePagedRows'
import type { PageResult } from '@/workers/importClient'

function rowsFor(offset: number, count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
        sourceRow: offset + i + 2,
        cells: [String(offset + i)],
    }))
}

function makeGetPage(rowCount: number) {
    return vi.fn(
        async (offset: number, limit: number): Promise<PageResult> => ({
            offset,
            rows: rowsFor(offset, Math.max(0, Math.min(limit, rowCount - offset))),
            rowCount,
        }),
    )
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('usePagedRows', () => {
    it('loads the first page', async () => {
        const getPage = makeGetPage(250)
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 250))
        expect(result.current.loading).toBe(true)
        expect(result.current.rows).toEqual([])

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(getPage).toHaveBeenCalledWith(0, PAGE_SIZE)
        expect(result.current.rows).toHaveLength(100)
        expect(result.current.pageIndex).toBe(0)
        expect(result.current.pageCount).toBe(3)
        expect(result.current.error).toBeNull()
    })

    it('loads another page', async () => {
        const getPage = makeGetPage(250)
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 250))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => {
            result.current.goToPage(2)
        })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(getPage).toHaveBeenLastCalledWith(200, PAGE_SIZE)
        expect(result.current.pageIndex).toBe(2)
        expect(result.current.rows).toHaveLength(50)
        expect(result.current.rows[0]?.sourceRow).toBe(202)
    })

    it('keeps the page number within range', async () => {
        const getPage = makeGetPage(250)
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 250))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => {
            result.current.goToPage(99)
        })
        expect(result.current.pageIndex).toBe(2)
        act(() => {
            result.current.goToPage(-5)
        })
        expect(result.current.pageIndex).toBe(0)
        act(() => {
            result.current.goToPage(Number.NaN)
        })
        expect(result.current.pageIndex).toBe(0)
    })

    it('returns to the first page and hides the old rows when the data changes', async () => {
        const pageOne: PageResult = { offset: 0, rows: rowsFor(0, 100), rowCount: 250 }
        const pageTwo: PageResult = { offset: 100, rows: rowsFor(100, 100), rowCount: 250 }
        const pending = new Promise<PageResult>(() => { })
        const getPage = vi
            .fn()
            .mockResolvedValueOnce(pageOne)
            .mockResolvedValueOnce(pageTwo)
            .mockReturnValueOnce(pending)
        const first = {}
        const second = {}
        const { result, rerender } = renderHook(
            ({ version }) => usePagedRows(getPage, version, 250),
            { initialProps: { version: first } },
        )
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => {
            result.current.goToPage(1)
        })
        await waitFor(() => expect(result.current.rows[0]?.sourceRow).toBe(102))

        rerender({ version: second })
        expect(result.current.pageIndex).toBe(0)
        expect(result.current.rows).toEqual([])
        expect(result.current.loading).toBe(true)
    })

    it('ignores a reply that arrives after the user moved to another page', async () => {
        const slow = deferred<PageResult>()
        const fast = deferred<PageResult>()
        const getPage = vi
            .fn()
            .mockReturnValueOnce(slow.promise)
            .mockReturnValueOnce(fast.promise)
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 250))

        act(() => {
            result.current.goToPage(1)
        })
        await act(async () => {
            fast.resolve({ offset: 100, rows: rowsFor(100, 100), rowCount: 250 })
        })
        await act(async () => {
            slow.resolve({ offset: 0, rows: rowsFor(0, 100), rowCount: 250 })
        })

        expect(result.current.pageIndex).toBe(1)
        expect(result.current.rows[0]?.sourceRow).toBe(102)
    })

    it('reports an error when the rows cannot be loaded', async () => {
        const getPage = vi.fn().mockRejectedValue(new Error('boom'))
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 250))
        await waitFor(() => expect(result.current.error).toBe('boom'))
        expect(result.current.loading).toBe(false)
        expect(result.current.rows).toEqual([])
    })

    it('has one empty page when there are no rows', async () => {
        const getPage = makeGetPage(0)
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 0))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.pageCount).toBe(1)
        expect(result.current.rows).toEqual([])
    })
})