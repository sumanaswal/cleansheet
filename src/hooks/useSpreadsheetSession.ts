import { useCallback, useEffect, useRef, useState } from 'react'

import { ImportError } from '@/engine/io/types'
import { validateFile } from '@/engine/io/validation'
import type { DatasetProfile } from '@/engine/profiling/types'
import {
    ImportCancelledError,
    type ImportClient,
    type PageResult,
    type PreviewPage,
} from '@/workers/importClient'
import type {
    AppliedResult,
    DatasetSummary,
    OperationPreviewSummary,
    OperationSpec,
} from '@/workers/protocol'

export type SessionStatus = 'empty' | 'loading' | 'ready'

export interface SpreadsheetSession {
    readonly status: SessionStatus
    /** Details of the loaded spreadsheet. The rows themselves stay in the background worker. */
    readonly summary: DatasetSummary | null
    /** Message about the most recent import that failed. */
    readonly error: string | null
    /** Opens a file. A failed attempt keeps the spreadsheet that was already loaded. */
    loadFile(file: File): Promise<void>
    /** Reads a different worksheet of the loaded .xlsx file. */
    selectSheet(sheetName: string): Promise<void>
    /** Stops any import in progress and discards the loaded spreadsheet. */
    reset(): void
    getPage(offset: number, limit: number): Promise<PageResult>
    /** The data quality profile of the loaded spreadsheet. */
    getProfile(): Promise<DatasetProfile>
    /** Works out what an operation would do, without changing anything. */
    previewOperation(operation: OperationSpec): Promise<OperationPreviewSummary>
    /** A page of the records that the previewed operation would affect. */
    getPreviewPage(offset: number, limit: number): Promise<PreviewPage>
    /** Discards the preview. */
    clearPreview(): Promise<void>
    /** Applies an operation and updates the summary to match the new data. */
    applyOperation(operation: OperationSpec): Promise<AppliedResult>
}

const UNREADABLE_FILE =
    'The file could not be read. It may have been moved, deleted or changed. Please choose it again.'
const UNEXPECTED_ERROR =
    'Something went wrong while opening the file. Please try again.'

async function readOrFail<T>(read: () => Promise<T>): Promise<T> {
    try {
        return await read()
    } catch {
        throw new ImportError(UNREADABLE_FILE)
    }
}

/**
 * Reads a file's bytes. The first few bytes are checked before the rest, so a
 * file that is too big or the wrong type is never read into memory.
 */
async function readBytes(file: File): Promise<ArrayBuffer> {
    const head = new Uint8Array(
        await readOrFail(() => file.slice(0, 8).arrayBuffer()),
    )
    validateFile(file.name, file.size, head)
    return readOrFail(() => file.arrayBuffer())
}

function describeError(error: unknown): string | null {
    if (error instanceof ImportCancelledError) return null
    if (error instanceof Error) return error.message
    return UNEXPECTED_ERROR
}

export function useSpreadsheetSession(client: ImportClient): SpreadsheetSession {
    const [summary, setSummary] = useState<DatasetSummary | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // The File object is only a handle to the file on disk, not a copy of it.
    // It is kept so that another worksheet can be read later.
    const fileRef = useRef<File | null>(null)
    const attemptRef = useRef(0)

    // Stop the background worker when the app closes.
    useEffect(() => {
        return () => {
            client.cancel()
        }
    }, [client])

    const open = useCallback(
        async (file: File, sheetName?: string): Promise<void> => {
            attemptRef.current += 1
            const attempt = attemptRef.current
            setLoading(true)
            setError(null)
            try {
                const bytes = await readBytes(file)
                const next = await client.importFile(file.name, bytes, sheetName)
                if (attemptRef.current !== attempt) return
                fileRef.current = file
                setSummary(next)
            } catch (caught) {
                if (attemptRef.current !== attempt) return
                setError(describeError(caught))
            } finally {
                if (attemptRef.current === attempt) setLoading(false)
            }
        },
        [client],
    )

    const loadFile = useCallback((file: File) => open(file), [open])

    const selectSheet = useCallback(
        async (sheetName: string): Promise<void> => {
            const file = fileRef.current
            if (file === null) return
            await open(file, sheetName)
        },
        [open],
    )

    const reset = useCallback((): void => {
        attemptRef.current += 1
        client.cancel()
        fileRef.current = null
        setSummary(null)
        setError(null)
        setLoading(false)
    }, [client])

    const getPage = useCallback(
        (offset: number, limit: number) => client.getPage(offset, limit),
        [client],
    )

    const getProfile = useCallback(() => client.getProfile(), [client])

    const previewOperation = useCallback(
        (operation: OperationSpec) => client.previewOperation(operation),
        [client],
    )

    const getPreviewPage = useCallback(
        (offset: number, limit: number) => client.getPreviewPage(offset, limit),
        [client],
    )

    const clearPreview = useCallback(() => client.clearPreview(), [client])

    const applyOperation = useCallback(
        async (operation: OperationSpec): Promise<AppliedResult> => {
            const attempt = attemptRef.current
            const result = await client.applyOperation(operation)
            // The summary is a new object, so the table and the Data Quality page
            // load the new data. Skipped if another file was opened or the data was
            // removed in the meantime.
            if (attemptRef.current === attempt) setSummary(result.summary)
            return result
        },
        [client],
    )

    const status: SessionStatus = loading
        ? 'loading'
        : summary === null
            ? 'empty'
            : 'ready'

    return {
        status,
        summary,
        error,
        loadFile,
        selectSheet,
        reset,
        getPage,
        getProfile,
        previewOperation,
        getPreviewPage,
        clearPreview,
        applyOperation,
    }
}