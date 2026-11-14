import { importFile, type ImportedFile } from '@/engine/io/importFile'
import { ImportError } from '@/engine/io/types'
import {
    MAX_PAGE_SIZE,
    type WorkerRequest,
    type WorkerResponse,
} from '@/workers/protocol'

const NO_DATASET = 'No spreadsheet is loaded.'
// Deliberately generic: an error message could contain spreadsheet content.
const INTERNAL_ERROR =
    'Something went wrong while processing the file. If the file is large, the browser may have run out of memory. Please try again, or try a smaller file.'

function toWholeNumber(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.floor(value) : fallback
}

/**
 * Creates the worker's request handler. It owns the loaded dataset, so each
 * handler (and each worker) has its own separate state.
 */
export function createImportHandler(): (request: WorkerRequest) => WorkerResponse {
    let current: ImportedFile | null = null

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
                    return {
                        id: request.id,
                        type: 'imported',
                        summary: {
                            source: imported.source,
                            sheetName: imported.sheetName,
                            sheetNames: imported.sheetNames,
                            warnings: imported.warnings,
                            columns: imported.dataset.columns,
                            rowCount: imported.dataset.rows.length,
                        },
                    }
                }
                case 'getPage': {
                    const loaded = current
                    if (loaded === null) {
                        return {
                            id: request.id,
                            type: 'error',
                            kind: 'import',
                            message: NO_DATASET,
                        }
                    }
                    const offset = Math.max(0, toWholeNumber(request.offset, 0))
                    const limit = Math.min(
                        MAX_PAGE_SIZE,
                        Math.max(1, toWholeNumber(request.limit, 1)),
                    )
                    const rows = loaded.dataset.rows
                    return {
                        id: request.id,
                        type: 'page',
                        offset,
                        rows: rows.slice(offset, offset + limit),
                        rowCount: rows.length,
                    }
                }
                case 'clear':
                    current = null
                    return { id: request.id, type: 'cleared' }
            }
        } catch (error) {
            if (error instanceof ImportError) {
                return {
                    id: request.id,
                    type: 'error',
                    kind: 'import',
                    message: error.message,
                }
            }
            return {
                id: request.id,
                type: 'error',
                kind: 'internal',
                message: INTERNAL_ERROR,
            }
        }
    }
}