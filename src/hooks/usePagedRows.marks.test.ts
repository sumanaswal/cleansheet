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

describe('usePagedRows: marks', () => {
    it('returns the marks that come with a page', async () => {
        const getPage = vi.fn().mockResolvedValue({
            offset: 0,
            rows: rowsFor(2),
            rowCount: 2,
            marks: ['keep', 'remove'],
        })
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 2))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.marks).toEqual(['keep', 'remove'])
    })

    it('has no marks when the page has none', async () => {
        const getPage = vi
            .fn()
            .mockResolvedValue({ offset: 0, rows: rowsFor(2), rowCount: 2 })
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 2))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.marks).toBeUndefined()
    })

    it('loads the page again when the refresh key changes and never shows old marks', async () => {
        const first: PageResult = {
            offset: 0,
            rows: rowsFor(1),
            rowCount: 1,
            marks: ['remove'],
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
        await waitFor(() => expect(result.current.marks).toEqual(['remove']))

        rerender({ key: 1 })
        // The rows stay, but marks from before the change are hidden.
        expect(result.current.marks).toBeUndefined()
        expect(result.current.rows).toHaveLength(1)
        expect(result.current.loading).toBe(false)

        await act(async () => {
            second.resolve({ offset: 0, rows: rowsFor(1), rowCount: 1, marks: ['keep'] })
        })
        expect(result.current.marks).toEqual(['keep'])
        expect(getPage).toHaveBeenCalledTimes(2)
    })
})