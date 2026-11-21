import * as XLSX from 'xlsx'

import { csvBuffer, toArrayBuffer } from '@/test/files'
import type { createImportHandler } from '@/workers/importHandler'
import type { OperationSpec, WorkerResponse } from '@/workers/protocol'

export type Handler = ReturnType<typeof createImportHandler>

let lastId = 1000
export function nextId(): number {
    lastId += 1
    return lastId
}

export function expectType<T extends WorkerResponse['type']>(
    response: WorkerResponse,
    type: T,
): Extract<WorkerResponse, { type: T }> {
    if (response.type !== type) {
        throw new Error(`Expected a "${type}" reply but got "${response.type}"`)
    }
    return response as Extract<WorkerResponse, { type: T }>
}

export function loadCsv(handle: Handler, text: string): void {
    expectType(
        handle({
            id: nextId(),
            type: 'import',
            fileName: 'data.csv',
            bytes: csvBuffer(text),
        }),
        'imported',
    )
}

/** Loads an .xlsx workbook with one worksheet, so number cells can be tested. */
export function loadWorkbook(handle: Handler, rows: unknown[][]): void {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
    const out: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
    expectType(
        handle({
            id: nextId(),
            type: 'import',
            fileName: 'book.xlsx',
            bytes: toArrayBuffer(new Uint8Array(out)),
        }),
        'imported',
    )
}

export function previewOf(handle: Handler, operation: OperationSpec): WorkerResponse {
    return handle({ id: nextId(), type: 'previewOperation', operation })
}

export function previewPageOf(
    handle: Handler,
    offset: number,
    limit: number,
): WorkerResponse {
    return handle({ id: nextId(), type: 'getPreviewPage', offset, limit })
}

export function clearPreviewOf(handle: Handler): void {
    expectType(handle({ id: nextId(), type: 'clearPreview' }), 'previewCleared')
}

export function applyOf(handle: Handler, operation: OperationSpec): WorkerResponse {
    return handle({ id: nextId(), type: 'applyOperation', operation })
}

/** The first 100 rows of the loaded data, with any marks for a preview. */
export function pageOf(handle: Handler) {
    return expectType(
        handle({ id: nextId(), type: 'getPage', offset: 0, limit: 100 }),
        'page',
    )
}

export function profileOf(handle: Handler) {
    return expectType(handle({ id: nextId(), type: 'getProfile' }), 'profile').profile
}