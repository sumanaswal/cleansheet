import { ImportError } from '@/engine/io/types'
import type { Row } from '@/engine/types'
import type {
    DatasetSummary,
    WorkerRequest,
    WorkerResponse,
} from '@/workers/protocol'

/** The part of a browser Worker that the client uses. Lets tests substitute one. */
export interface WorkerLike {
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null
    onerror: ((event: ErrorEvent) => void) | null
    postMessage(message: WorkerRequest, transfer: Transferable[]): void
    terminate(): void
}

export class ImportCancelledError extends Error {
    constructor() {
        super('The import was cancelled.')
        this.name = 'ImportCancelledError'
    }
}

export interface PageResult {
    readonly offset: number
    readonly rows: readonly Row[]
    readonly rowCount: number
}

export interface ImportClient {
    /**
     * Loads a file in the background. The bytes are transferred to the worker,
     * so the caller's ArrayBuffer is emptied by this call.
     */
    importFile(
        fileName: string,
        bytes: ArrayBuffer,
        sheetName?: string,
    ): Promise<DatasetSummary>
    /** Returns one page of rows of the loaded spreadsheet. */
    getPage(offset: number, limit: number): Promise<PageResult>
    /** Discards the loaded spreadsheet. */
    clear(): Promise<void>
    /**
     * Stops the background worker immediately. This discards the loaded
     * spreadsheet and rejects every request still waiting. The next request
     * starts a fresh worker. Also use it when the screen closes.
     */
    cancel(): void
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never
type RequestBody = DistributiveOmit<WorkerRequest, 'id'>

interface Pending {
    resolve: (response: WorkerResponse) => void
    reject: (error: Error) => void
}

const CRASH_MESSAGE =
    'The background processor stopped unexpectedly. Please try again.'
const UNEXPECTED_REPLY = 'Unexpected reply from the background processor.'

export function createImportClient(createWorker: () => WorkerLike): ImportClient {
    let worker: WorkerLike | null = null
    let nextId = 1
    const pending = new Map<number, Pending>()

    function rejectAll(error: Error): void {
        const entries = [...pending.values()]
        pending.clear()
        for (const entry of entries) entry.reject(error)
    }

    function stopWorker(): void {
        if (worker === null) return
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        worker = null
    }

    function getWorker(): WorkerLike {
        if (worker !== null) return worker
        const created = createWorker()
        created.onmessage = (event) => {
            const response = event.data
            const entry = pending.get(response.id)
            if (entry === undefined) return
            pending.delete(response.id)
            if (response.type === 'error') {
                entry.reject(
                    response.kind === 'import'
                        ? new ImportError(response.message)
                        : new Error(response.message),
                )
            } else {
                entry.resolve(response)
            }
        }
        created.onerror = () => {
            stopWorker()
            rejectAll(new Error(CRASH_MESSAGE))
        }
        worker = created
        return created
    }

    function send(body: RequestBody, transfer: Transferable[]): Promise<WorkerResponse> {
        return new Promise((resolve, reject) => {
            const id = nextId
            nextId += 1
            pending.set(id, { resolve, reject })
            try {
                getWorker().postMessage({ ...body, id } as WorkerRequest, transfer)
            } catch (error) {
                pending.delete(id)
                reject(error instanceof Error ? error : new Error(String(error)))
            }
        })
    }

    return {
        async importFile(fileName, bytes, sheetName) {
            const response = await send(
                { type: 'import', fileName, bytes, sheetName },
                [bytes],
            )
            if (response.type !== 'imported') throw new Error(UNEXPECTED_REPLY)
            return response.summary
        },
        async getPage(offset, limit) {
            const response = await send({ type: 'getPage', offset, limit }, [])
            if (response.type !== 'page') throw new Error(UNEXPECTED_REPLY)
            return {
                offset: response.offset,
                rows: response.rows,
                rowCount: response.rowCount,
            }
        },
        async clear() {
            const response = await send({ type: 'clear' }, [])
            if (response.type !== 'cleared') throw new Error(UNEXPECTED_REPLY)
        },
        cancel() {
            stopWorker()
            rejectAll(new ImportCancelledError())
        },
    }
}