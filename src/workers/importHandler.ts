import { importFile, type ImportedFile } from '@/engine/io/importFile'
import { ImportError } from '@/engine/io/types'
import { OperationError } from '@/engine/operations/types'
import { profileDataset } from '@/engine/profiling/profile'
import type { DatasetProfile } from '@/engine/profiling/types'
import type { Dataset } from '@/engine/types'
import {
    applyToDataset,
    buildPreview,
    countChangedCells,
    type OperationPreview,
} from '@/workers/operations'
import {
    MAX_HISTORY_DEPTH,
    MAX_PAGE_SIZE,
    MAX_PREVIEW_PAGE_SIZE,
    type DatasetSummary,
    type WorkerRequest,
    type WorkerResponse,
} from '@/workers/protocol'

const NO_DATASET = 'No spreadsheet is loaded.'
const NO_PREVIEW =
    'There is no preview to show. Please preview the operation again.'
// Deliberately generic: an error message could contain spreadsheet content.
const INTERNAL_ERROR =
    'Something went wrong while processing the file. If the file is large, the browser may have run out of memory. Please try again, or try a smaller file.'

function toWholeNumber(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.floor(value) : fallback
}

function failure(
    id: number,
    kind: 'import' | 'operation' | 'internal',
    message: string,
): WorkerResponse {
    return { id, type: 'error', kind, message }
}

function summarize(imported: ImportedFile): DatasetSummary {
    return {
        source: imported.source,
        sheetName: imported.sheetName,
        sheetNames: imported.sheetNames,
        warnings: imported.warnings,
        columns: imported.dataset.columns,
        rowCount: imported.dataset.rows.length,
    }
}

/**
 * Creates the worker's request handler. It owns the loaded dataset, so each
 * handler (and each worker) has its own separate state.
 * `maxHistory` is how many earlier versions of the data are kept.
 */
export function createImportHandler(
    maxHistory: number = MAX_HISTORY_DEPTH,
): (request: WorkerRequest) => WorkerResponse {
    let current: ImportedFile | null = null
    // Computed the first time it is asked for, then kept until the data changes.
    let profile: DatasetProfile | null = null
    // What an operation would do. Valid only until the data changes.
    let preview: OperationPreview | null = null
    // Earlier versions of the data, oldest first. Unchanged rows are shared
    // between versions, not copied.
    let history: Dataset[] = []

    return (request) => {
        try {
            switch (request.type) {
                case 'import': {
                    const imported = importFile(
                        request.fileName,
                        new Uint8Array(request.bytes),
                        { sheetName: request.sheetName },
                    )
                    // Only replace the loaded spreadsheet once the new one succeeded.
                    current = imported
                    profile = null
                    preview = null
                    history = []
                    return {
                        id: request.id,
                        type: 'imported',
                        summary: summarize(imported),
                    }
                }
                case 'getPage': {
                    const loaded = current
                    if (loaded === null) return failure(request.id, 'import', NO_DATASET)
                    const offset = Math.max(0, toWholeNumber(request.offset, 0))
                    const limit = Math.min(
                        MAX_PAGE_SIZE,
                        Math.max(1, toWholeNumber(request.limit, 1)),
                    )
                    const rows = loaded.dataset.rows.slice(offset, offset + limit)
                    const active = preview
                    const marks =
                        active !== null && active.marksRows
                            ? rows.map((_, i) => active.mark(offset + i))
                            : undefined
                    const cellMarks =
                        active === null ? undefined : active.cellMarks(offset, rows.length)
                    return {
                        id: request.id,
                        type: 'page',
                        offset,
                        rows,
                        rowCount: loaded.dataset.rows.length,
                        ...(marks === undefined ? {} : { marks }),
                        ...(cellMarks === undefined ? {} : { cellMarks }),
                    }
                }
                case 'getProfile': {
                    const loaded = current
                    if (loaded === null) return failure(request.id, 'import', NO_DATASET)
                    const computed = profile ?? profileDataset(loaded.dataset)
                    profile = computed
                    return { id: request.id, type: 'profile', profile: computed }
                }
                case 'previewOperation': {
                    const loaded = current
                    if (loaded === null) return failure(request.id, 'import', NO_DATASET)
                    // A preview that fails must not leave an older one behind.
                    preview = null
                    const built = buildPreview(loaded.dataset, request.operation)
                    preview = built
                    return { id: request.id, type: 'previewed', summary: built.summary }
                }
                case 'getPreviewPage': {
                    const active = preview
                    if (active === null) return failure(request.id, 'operation', NO_PREVIEW)
                    const offset = Math.max(0, toWholeNumber(request.offset, 0))
                    const limit = Math.min(
                        MAX_PREVIEW_PAGE_SIZE,
                        Math.max(1, toWholeNumber(request.limit, 1)),
                    )
                    return {
                        id: request.id,
                        type: 'previewPage',
                        offset,
                        items: active.items(offset, limit),
                        itemCount: active.summary.itemCount,
                    }
                }
                case 'clearPreview':
                    preview = null
                    return { id: request.id, type: 'previewCleared' }
                case 'applyOperation': {
                    const loaded = current
                    if (loaded === null) return failure(request.id, 'import', NO_DATASET)
                    preview = null
                    const next = applyToDataset(loaded.dataset, request.operation)
                    if (next === loaded.dataset) {
                        // Nothing changed: no new version, and the profile stays valid.
                        return {
                            id: request.id,
                            type: 'applied',
                            result: {
                                summary: summarize(loaded),
                                removedRows: 0,
                                filledCells: 0,
                                historyDepth: history.length,
                            },
                        }
                    }
                    const filling =
                        request.operation.kind === 'missing' &&
                        request.operation.options.action.kind === 'fill'
                    history.push(loaded.dataset)
                    while (history.length > maxHistory) history.shift()
                    const updated: ImportedFile = { ...loaded, dataset: next }
                    current = updated
                    profile = null
                    return {
                        id: request.id,
                        type: 'applied',
                        result: {
                            summary: summarize(updated),
                            removedRows: loaded.dataset.rows.length - next.rows.length,
                            filledCells: filling ? countChangedCells(loaded.dataset, next) : 0,
                            historyDepth: history.length,
                        },
                    }
                }
                case 'clear':
                    current = null
                    profile = null
                    preview = null
                    history = []
                    return { id: request.id, type: 'cleared' }
            }
        } catch (error) {
            if (error instanceof ImportError) {
                return failure(request.id, 'import', error.message)
            }
            if (error instanceof OperationError) {
                return failure(request.id, 'operation', error.message)
            }
            return failure(request.id, 'internal', INTERNAL_ERROR)
        }
    }
}