// @vitest-environment node
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { importFile } from '@/engine/io/importFile'
import { ImportError } from '@/engine/io/types'
import { IMPORT_LIMITS } from '@/engine/io/validation'

function csvBytes(text: string): Uint8Array {
    return new TextEncoder().encode(text)
}

function xlsxBytes(sheets: ReadonlyArray<[string, unknown[][]]>): Uint8Array {
    const workbook = XLSX.utils.book_new()
    for (const [name, rows] of sheets) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
    }
    const out: ArrayBuffer = XLSX.write(workbook, {
        type: 'array',
        bookType: 'xlsx',
    })
    return new Uint8Array(out)
}

describe('importFile', () => {
    it('imports a CSV file and describes its source', () => {
        const bytes = csvBytes('a,b\n1,2\n3,4')
        const result = importFile('data.csv', bytes)
        expect(result.source).toEqual({
            name: 'data.csv',
            sizeBytes: bytes.byteLength,
            format: 'csv',
        })
        expect(result.sheetName).toBeNull()
        expect(result.sheetNames).toEqual([])
        expect(result.dataset.rows).toHaveLength(2)
        expect(result.warnings).toEqual([])
    })

    it('imports the first worksheet of an XLSX file by default', () => {
        const bytes = xlsxBytes([
            ['First', [['a'], ['one']]],
            ['Second', [['b'], ['two']]],
        ])
        const result = importFile('book.xlsx', bytes)
        expect(result.source.format).toBe('xlsx')
        expect(result.sheetName).toBe('First')
        expect(result.sheetNames).toEqual(['First', 'Second'])
        expect(result.dataset.rows[0]?.cells).toEqual(['one'])
    })

    it('imports the worksheet that was asked for', () => {
        const bytes = xlsxBytes([
            ['First', [['a'], ['one']]],
            ['Second', [['b'], ['two']]],
        ])
        const result = importFile('book.xlsx', bytes, { sheetName: 'Second' })
        expect(result.sheetName).toBe('Second')
        expect(result.dataset.rows[0]?.cells).toEqual(['two'])
    })

    it('rejects an empty file', () => {
        expect(() => importFile('data.csv', new Uint8Array())).toThrow(
            'The file is empty.',
        )
    })

    it('rejects an unsupported file type before reading it', () => {
        expect(() => importFile('notes.pdf', csvBytes('a,b'))).toThrow(
            /\.pdf files are not supported/,
        )
    })

    it('rejects text saved with an .xlsx name', () => {
        const error = (() => {
            try {
                importFile('fake.xlsx', csvBytes('a,b\n1,2'))
            } catch (caught) {
                return caught
            }
            return undefined
        })()
        expect(error).toBeInstanceOf(ImportError)
    })

    it('applies the row limit to CSV files', () => {
        expect(() =>
            importFile('data.csv', csvBytes('a\n1\n2'), {
                limits: { ...IMPORT_LIMITS, maxRows: 1 },
            }),
        ).toThrow(/2 data rows/)
    })
})