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

describe('usePagedRows: what cell marks mean', () => {
    it('returns the kind that comes with the marks', async () => {
        const getPage = vi.fn().mockResolvedValue({
            offset: 0,
            rows: rowsFor(1),
            rowCount: 1,
            cellMarks: [[0]],
            cellMarkKind: 'change',
        })
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 1))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.cellMarks).toEqual([[0]])
        expect(result.current.cellMarkKind).toBe('change')
    })

    it('has no kind when the page has no cell marks', async () => {
        const getPage = vi
            .fn()
            .mockResolvedValue({ offset: 0, rows: rowsFor(1), rowCount: 1 })
        const version = {}
        const { result } = renderHook(() => usePagedRows(getPage, version, 1))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.cellMarkKind).toBeUndefined()
    })

    it('hides the kind together with the marks until the page is loaded again', async () => {
        const first: PageResult = {
            offset: 0,
            rows: rowsFor(1),
            rowCount: 1,
            cellMarks: [[0]],
            cellMarkKind: 'fill',
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
        await waitFor(() => expect(result.current.cellMarkKind).toBe('fill'))

        rerender({ key: 1 })
        expect(result.current.cellMarks).toBeUndefined()
        expect(result.current.cellMarkKind).toBeUndefined()

        await act(async () => {
            second.resolve({
                offset: 0,
                rows: rowsFor(1),
                rowCount: 1,
                cellMarks: [[0]],
                cellMarkKind: 'change',
            })
        })
        expect(result.current.cellMarkKind).toBe('change')
    })
})