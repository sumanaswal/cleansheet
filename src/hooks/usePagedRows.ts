import { useCallback, useEffect, useState } from 'react'

import type { Row } from '@/engine/types'
import type { PageResult } from '@/workers/importClient'
import type { RowMark } from '@/workers/protocol'

/** Rows shown per page. Must not exceed the worker's page size limit. */
export const PAGE_SIZE = 100

interface Fetched {
  readonly version: object
  readonly index: number
  readonly refreshKey: number
  readonly rows: readonly Row[]
  readonly marks: readonly (RowMark | null)[] | undefined
}

interface Failure {
  readonly version: object
  readonly index: number
  readonly message: string
}

export interface PagedRows {
  /** Zero-based index of the current page. */
  readonly pageIndex: number
  readonly pageCount: number
  /** Rows of the current page. Empty while the first load of this data is pending. */
  readonly rows: readonly Row[]
  /**
   * How each row is marked while an operation is being previewed. Undefined
   * when there is no preview, and while marks for the current preview state
   * are still being loaded, so old marks are never shown.
   */
  readonly marks: readonly (RowMark | null)[] | undefined
  readonly loading: boolean
  readonly error: string | null
  goToPage(index: number): void
}

/**
 * Loads one page of rows at a time from the background worker.
 * `version` identifies the loaded data. When it changes (a different file or
 * worksheet), the view returns to the first page and rows from the previous
 * data are never shown. `refreshKey` is bumped when the preview of an
 * operation changes, so the page is loaded again with up-to-date marks.
 */
export function usePagedRows(
  getPage: (offset: number, limit: number) => Promise<PageResult>,
  version: object,
  rowCount: number,
  pageSize: number = PAGE_SIZE,
  refreshKey: number = 0,
): PagedRows {
  const [requested, setRequested] = useState<{ version: object; index: number }>({
    version,
    index: 0,
  })
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize))
  const requestedIndex = requested.version === version ? requested.index : 0
  const pageIndex = Math.min(Math.max(0, requestedIndex), pageCount - 1)

  useEffect(() => {
    let cancelled = false
    getPage(pageIndex * pageSize, pageSize).then(
      (page) => {
        if (cancelled) return
        setFailure(null)
        setFetched({
          version,
          index: pageIndex,
          refreshKey,
          rows: page.rows,
          marks: page.marks,
        })
      },
      (error: unknown) => {
        if (cancelled) return
        setFailure({
          version,
          index: pageIndex,
          message:
            error instanceof Error ? error.message : 'The rows could not be loaded.',
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [getPage, version, pageIndex, pageSize, refreshKey])

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
  const marks =
    current !== null && current.refreshKey === refreshKey ? current.marks : undefined
  const error =
    failure !== null && failure.version === version && failure.index === pageIndex
      ? failure.message
      : null
  const loading = error === null && (current === null || current.index !== pageIndex)

  return {
    pageIndex,
    pageCount,
    rows: current?.rows ?? [],
    marks,
    loading,
    error,
    goToPage,
  }
}