import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PREVIEW_PAGE_SIZE, usePreviewItems } from '@/hooks/usePreviewItems'
import type { PreviewPage } from '@/workers/importClient'

function pageFor(offset: number, limit: number, total: number): PreviewPage {
    const count = Math.max(0, Math.min(limit, total - offset))
    return {
        offset,
        itemCount: total,
        items: Array.from({ length: count }, (_, i) => ({
            kind: 'removedRow' as const,
            row: { sourceRow: offset + i + 2, cells: ['v'] },
            keptSourceRow: 1,
        })),
    }
}

function makeGetPreviewPage(total: number) {
    return vi.fn(async (offset: number, limit: number) => pageFor(offset, limit, total))
}

describe('usePreviewItems', () => {
    it('loads the first page of records', async () => {
        const getPreviewPage = makeGetPreviewPage(45)
        const version = {}
        const { result } = renderHook(() =>
            usePreviewItems(getPreviewPage, version, 45),
        )
        expect(result.current.loading).toBe(true)
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(getPreviewPage).toHaveBeenCalledWith(0, PREVIEW_PAGE_SIZE)
        expect(result.current.items).toHaveLength(20)
        expect(result.current.pageCount).toBe(3)
    })

    it('loads another page and keeps the page number in range', async () => {
        const getPreviewPage = makeGetPreviewPage(45)
        const version = {}
        const { result } = renderHook(() =>
            usePreviewItems(getPreviewPage, version, 45),
        )
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => {
            result.current.goToPage(2)
        })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(getPreviewPage).toHaveBeenLastCalledWith(40, PREVIEW_PAGE_SIZE)
        expect(result.current.items).toHaveLength(5)

        act(() => {
            result.current.goToPage(99)
        })
        expect(result.current.pageIndex).toBe(2)
        act(() => {
            result.current.goToPage(Number.NaN)
        })
        expect(result.current.pageIndex).toBe(0)
    })

    it('starts again at the first page and hides old records when the preview changes', async () => {
        const getPreviewPage = vi
            .fn()
            .mockResolvedValueOnce(pageFor(0, 20, 45))
            .mockResolvedValueOnce(pageFor(20, 20, 45))
            .mockReturnValueOnce(new Promise<PreviewPage>(() => { }))
        const v1 = {}
        const v2 = {}
        const { result, rerender } = renderHook(
            ({ version }) => usePreviewItems(getPreviewPage, version, 45),
            { initialProps: { version: v1 } },
        )
        await waitFor(() => expect(result.current.loading).toBe(false))
        act(() => {
            result.current.goToPage(1)
        })
        await waitFor(() => expect(result.current.items[0]?.row.sourceRow).toBe(22))

        rerender({ version: v2 })
        expect(result.current.pageIndex).toBe(0)
        expect(result.current.items).toEqual([])
        expect(result.current.loading).toBe(true)
    })

    it('reports an error when the records cannot be loaded', async () => {
        const getPreviewPage = vi.fn().mockRejectedValue(new Error('boom'))
        const version = {}
        const { result } = renderHook(() =>
            usePreviewItems(getPreviewPage, version, 45),
        )
        await waitFor(() => expect(result.current.error).toBe('boom'))
        expect(result.current.loading).toBe(false)
    })
})