import { act, renderHook } from '@testing-library/react'
import * as XLSX from 'xlsx'
import { describe, expect, it, vi } from 'vitest'

import { IMPORT_LIMITS } from '@/engine/io/validation'
import { useSpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import { HandlerWorker } from '@/test/handlerWorker'
import { createImportClient } from '@/workers/importClient'

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

/** A File stand-in that gives out a fresh copy of the bytes on every read. */
function fakeFile(name: string, bytes: ArrayBuffer, size = bytes.byteLength) {
    const arrayBuffer = vi.fn(async () => bytes.slice(0))
    const file = {
        name,
        size,
        slice: (start: number, end: number) => ({
            arrayBuffer: async () => bytes.slice(start, end),
        }),
        arrayBuffer,
    } as unknown as File
    return { file, arrayBuffer }
}

function setup() {
    const client = createImportClient(() => new HandlerWorker())
    return renderHook(() => useSpreadsheetSession(client)).result
}

describe('useSpreadsheetSession', () => {
    it('starts empty', () => {
        const result = setup()
        expect(result.current.status).toBe('empty')
        expect(result.current.summary).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('loads a CSV file', async () => {
        const result = setup()
        const { file } = fakeFile('data.csv', csv('a,b\n1,2\n3,4'))
        await act(async () => {
            await result.current.loadFile(file)
        })
        expect(result.current.status).toBe('ready')
        expect(result.current.summary?.rowCount).toBe(2)
        expect(result.current.summary?.source.name).toBe('data.csv')
        expect(result.current.error).toBeNull()
    })

    it('rejects an unsupported file without reading it', async () => {
        const result = setup()
        const { file, arrayBuffer } = fakeFile('notes.pdf', csv('a,b'))
        await act(async () => {
            await result.current.loadFile(file)
        })
        expect(result.current.status).toBe('empty')
        expect(result.current.error).toMatch(/\.pdf files are not supported/)
        expect(arrayBuffer).not.toHaveBeenCalled()
    })

    it('rejects an oversized file before reading it', async () => {
        const result = setup()
        const { file, arrayBuffer } = fakeFile(
            'big.csv',
            csv('a'),
            IMPORT_LIMITS.maxFileSizeBytes + 1,
        )
        await act(async () => {
            await result.current.loadFile(file)
        })
        expect(result.current.status).toBe('empty')
        expect(result.current.error).toMatch(/over the 10\.00 MB limit/)
        expect(arrayBuffer).not.toHaveBeenCalled()
    })

    it('reports a file that cannot be read', async () => {
        const result = setup()
        const failing = async (): Promise<ArrayBuffer> => {
            throw new Error('boom')
        }
        const file = {
            name: 'data.csv',
            size: 10,
            slice: () => ({ arrayBuffer: failing }),
            arrayBuffer: failing,
        } as unknown as File
        await act(async () => {
            await result.current.loadFile(file)
        })
        expect(result.current.status).toBe('empty')
        expect(result.current.error).toMatch(/could not be read/)
    })

    it('keeps the previous spreadsheet when a later file is rejected', async () => {
        const result = setup()
        const good = fakeFile('good.csv', csv('a\n1\n2'))
        const bad = fakeFile('notes.pdf', csv('a,b'))
        await act(async () => {
            await result.current.loadFile(good.file)
        })
        await act(async () => {
            await result.current.loadFile(bad.file)
        })
        expect(result.current.status).toBe('ready')
        expect(result.current.summary?.source.name).toBe('good.csv')
        expect(result.current.error).toMatch(/\.pdf files are not supported/)
    })

    it('switches to another worksheet of the loaded workbook', async () => {
        const result = setup()
        const { file } = fakeFile(
            'book.xlsx',
            workbook([
                ['First', [['a'], ['one']]],
                ['Second', [['b'], ['two']]],
            ]),
        )
        await act(async () => {
            await result.current.loadFile(file)
        })
        expect(result.current.summary?.sheetName).toBe('First')

        await act(async () => {
            await result.current.selectSheet('Second')
        })
        expect(result.current.summary?.sheetName).toBe('Second')
        const page = await result.current.getPage(0, 10)
        expect(page.rows[0]?.cells).toEqual(['two'])
    })

    it('discards the spreadsheet when reset', async () => {
        const result = setup()
        const { file } = fakeFile('data.csv', csv('a\n1'))
        await act(async () => {
            await result.current.loadFile(file)
        })
        act(() => {
            result.current.reset()
        })
        expect(result.current.status).toBe('empty')
        expect(result.current.summary).toBeNull()
        await expect(result.current.getPage(0, 10)).rejects.toThrow(
            'No spreadsheet is loaded.',
        )
    })

    it('returns pages of rows from the loaded spreadsheet', async () => {
        const result = setup()
        const { file } = fakeFile('data.csv', csv('n\n1\n2\n3'))
        await act(async () => {
            await result.current.loadFile(file)
        })
        const page = await result.current.getPage(1, 2)
        expect(page.rowCount).toBe(3)
        expect(page.rows.map((row) => row.cells)).toEqual([['2'], ['3']])
    })
})

describe('useSpreadsheetSession: profile', () => {
    it('returns the profile of the loaded spreadsheet', async () => {
        const result = setup()
        const { file } = fakeFile('data.csv', csv('a,b\n1,2\n1,2'))
        await act(async () => {
            await result.current.loadFile(file)
        })
        const profile = await result.current.getProfile()
        expect(profile.totalRows).toBe(2)
        expect(profile.duplicateRows).toBe(1)
    })
})