import { useCallback, useEffect, useState } from 'react'

import type { PreviewPage } from '@/workers/importClient'
import type { PreviewItem } from '@/workers/protocol'

/** Records shown per page of the preview list. */
export const PREVIEW_PAGE_SIZE = 20

interface Fetched {
    readonly version: object
    readonly index: number
    readonly items: readonly PreviewItem[]
}

interface Failure {
    readonly version: object
    readonly index: number
    readonly message: string
}

export interface PreviewItems {
    readonly pageIndex: number
    readonly pageCount: number
    readonly items: readonly PreviewItem[]
    readonly loading: boolean
    readonly error: string | null
    goToPage(index: number): void
}

/**
 * Loads the records of a preview one page at a time. `version` identifies the
 * preview. When it changes, the list starts again at the first page and
 * records of the previous preview are never shown.
 */
export function usePreviewItems(
    getPreviewPage: (offset: number, limit: number) => Promise<PreviewPage>,
    version: object,
    itemCount: number,
    pageSize: number = PREVIEW_PAGE_SIZE,
): PreviewItems {
    const [requested, setRequested] = useState<{ version: object; index: number }>({
        version,
        index: 0,
    })
    const [fetched, setFetched] = useState<Fetched | null>(null)
    const [failure, setFailure] = useState<Failure | null>(null)

    const pageCount = Math.max(1, Math.ceil(itemCount / pageSize))
    const requestedIndex = requested.version === version ? requested.index : 0
    const pageIndex = Math.min(Math.max(0, requestedIndex), pageCount - 1)

    useEffect(() => {
        let cancelled = false
        getPreviewPage(pageIndex * pageSize, pageSize).then(
            (page) => {
                if (cancelled) return
                setFailure(null)
                setFetched({ version, index: pageIndex, items: page.items })
            },
            (error: unknown) => {
                if (cancelled) return
                setFailure({
                    version,
                    index: pageIndex,
                    message:
                        error instanceof Error ? error.message : 'The records could not be loaded.',
                })
            },
        )
        return () => {
            cancelled = true
        }
    }, [getPreviewPage, version, pageIndex, pageSize])

    const goToPage = useCallback(
        (index: number): void => {
            const whole = Number.isFinite(index) ? Math.floor(index) : 0
            setRequested({
                version,
                index: Math.min(Math.max(0, whole), pageCount - 1),
            })
        },
        [version, pageCount],
    )

    const current = fetched !== null && fetched.version === version ? fetched : null
    const error =
        failure !== null && failure.version === version && failure.index === pageIndex
            ? failure.message
            : null
    const loading = error === null && (current === null || current.index !== pageIndex)

    return {
        pageIndex,
        pageCount,
        items: current?.items ?? [],
        loading,
        error,
        goToPage,
    }
}