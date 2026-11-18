// @vitest-environment node
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { createImportHandler } from '@/workers/importHandler'
import {
    MAX_PAGE_SIZE,
    type WorkerRequest,
    type WorkerResponse,
} from '@/workers/protocol'

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
}

function csv(text: string): ArrayBuffer {
    return toArrayBuffer(new TextEncoder().encode(text))
}

function workbook(sheets: ReadonlyArray<[string, unknown[][]]>): ArrayBuffer {
    const book = XLSX.utils.book_new()
    for (const [name, rows] of sheets) {
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
    }
    const out: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
    return toArrayBuffer(new Uint8Array(out))
}

let lastId = 0
function nextId(): number {
    lastId += 1
    return lastId
}

function importRequest(
    fileName: string,
    bytes: ArrayBuffer,
    sheetName?: string,
): WorkerRequest {
    return { id: nextId(), type: 'import', fileName, bytes, sheetName }
}

function pageRequest(offset: number, limit: number): WorkerRequest {
    return { id: nextId(), type: 'getPage', offset, limit }
}

function expectType<T extends WorkerResponse['type']>(
    response: WorkerResponse,
    type: T,
): Extract<WorkerResponse, { type: T }> {
    if (response.type !== type) {
        throw new Error(`Expected a "${type}" reply but got "${response.type}"`)
    }
    return response as Extract<WorkerResponse, { type: T }>
}

function numberedCsv(rowCount: number): ArrayBuffer {
    const lines = ['n']
    for (let i = 1; i <= rowCount; i += 1) lines.push(String(i))
    return csv(lines.join('\n'))
}

describe('import handler', () => {
    it('imports a CSV file and returns a summary without any rows', () => {
        const handle = createImportHandler()
        const { summary } = expectType(
            handle(importRequest('data.csv', csv('Name,City\nAsha,Delhi\nRavi,Pune'))),
            'imported',
        )
        expect(summary.source.name).toBe('data.csv')
        expect(summary.source.format).toBe('csv')
        expect(summary.sheetName).toBeNull()
        expect(summary.columns.map((column) => column.name)).toEqual(['Name', 'City'])
        expect(summary.rowCount).toBe(2)
        expect(summary.warnings).toEqual([])
        expect(summary).not.toHaveProperty('rows')
    })

    it('imports the first worksheet by default and another one when asked', () => {
        const handle = createImportHandler()
        const bytes = workbook([
            ['First', [['a'], ['one']]],
            ['Second', [['b'], ['two']]],
        ])

        const first = expectType(handle(importRequest('book.xlsx', bytes)), 'imported')
        expect(first.summary.sheetName).toBe('First')
        expect(first.summary.sheetNames).toEqual(['First', 'Second'])

        const second = expectType(
            handle(importRequest('book.xlsx', bytes, 'Second')),
            'imported',
        )
        expect(second.summary.sheetName).toBe('Second')
        const page = expectType(handle(pageRequest(0, 10)), 'page')
        expect(page.rows[0]?.cells).toEqual(['two'])
    })

    it('returns the requested page of rows with their source row numbers', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', numberedCsv(5)))
        const page = expectType(handle(pageRequest(1, 2)), 'page')
        expect(page.offset).toBe(1)
        expect(page.rowCount).toBe(5)
        expect(page.rows.map((row) => row.sourceRow)).toEqual([3, 4])
    })

    it('limits the page size and corrects invalid offsets and limits', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', numberedCsv(600)))

        const large = expectType(handle(pageRequest(-5, 10_000)), 'page')
        expect(large.offset).toBe(0)
        expect(large.rows).toHaveLength(MAX_PAGE_SIZE)
        expect(large.rowCount).toBe(600)

        const invalid = expectType(handle(pageRequest(Number.NaN, Number.NaN)), 'page')
        expect(invalid.offset).toBe(0)
        expect(invalid.rows).toHaveLength(1)
    })

    it('returns an empty page beyond the end of the data', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', numberedCsv(5)))
        const page = expectType(handle(pageRequest(999, 10)), 'page')
        expect(page.rows).toEqual([])
        expect(page.rowCount).toBe(5)
    })

    it('reports an error when a page is requested before anything is loaded', () => {
        const handle = createImportHandler()
        const error = expectType(handle(pageRequest(0, 10)), 'error')
        expect(error.kind).toBe('import')
        expect(error.message).toBe('No spreadsheet is loaded.')
    })

    it('turns import problems into readable error replies', () => {
        const handle = createImportHandler()
        const error = expectType(
            handle(importRequest('notes.pdf', csv('a,b'))),
            'error',
        )
        expect(error.kind).toBe('import')
        expect(error.message).toMatch(/\.pdf files are not supported/)
    })

    it('keeps the loaded spreadsheet when a later import fails', () => {
        const handle = createImportHandler()
        handle(importRequest('good.csv', numberedCsv(3)))
        expectType(handle(importRequest('notes.pdf', csv('a,b'))), 'error')
        const page = expectType(handle(pageRequest(0, 10)), 'page')
        expect(page.rowCount).toBe(3)
    })

    it('discards the loaded spreadsheet when cleared', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', numberedCsv(3)))
        expectType(handle({ id: nextId(), type: 'clear' }), 'cleared')
        expectType(handle(pageRequest(0, 10)), 'error')
    })
})

function profileRequest(): WorkerRequest {
    return { id: nextId(), type: 'getProfile' }
}

describe('import handler: profile', () => {
    it('returns the profile of the loaded spreadsheet', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', csv('a,b\n,\n1,x\n1,x')))
        const { profile } = expectType(handle(profileRequest()), 'profile')
        expect(profile.totalRows).toBe(3)
        expect(profile.totalColumns).toBe(2)
        expect(profile.duplicateRows).toBe(1)
        expect(profile.emptyRows).toBe(1)
        expect(profile.missingCells).toBe(2)
    })

    it('computes the profile once and reuses it', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', numberedCsv(5)))
        const first = expectType(handle(profileRequest()), 'profile')
        const second = expectType(handle(profileRequest()), 'profile')
        expect(second.profile).toBe(first.profile)
    })

    it('profiles the new spreadsheet after another one is imported', () => {
        const handle = createImportHandler()
        handle(importRequest('one.csv', numberedCsv(1)))
        expect(expectType(handle(profileRequest()), 'profile').profile.totalRows).toBe(1)
        handle(importRequest('three.csv', numberedCsv(3)))
        expect(expectType(handle(profileRequest()), 'profile').profile.totalRows).toBe(3)
    })

    it('reports an error when no spreadsheet is loaded', () => {
        const handle = createImportHandler()
        const error = expectType(handle(profileRequest()), 'error')
        expect(error.kind).toBe('import')
        expect(error.message).toBe('No spreadsheet is loaded.')
    })

    it('forgets the profile when the data is cleared', () => {
        const handle = createImportHandler()
        handle(importRequest('data.csv', numberedCsv(3)))
        expectType(handle(profileRequest()), 'profile')
        handle({ id: nextId(), type: 'clear' })
        expectType(handle(profileRequest()), 'error')
    })
})