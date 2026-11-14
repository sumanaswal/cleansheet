// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { decodeCsvBytes, importCsv, parseCsvText } from '@/engine/io/csv'
import { ImportError } from '@/engine/io/types'

function encode(text: string): Uint8Array {
    return new TextEncoder().encode(text)
}

function utf16le(text: string): Uint8Array {
    const bytes = new Uint8Array(2 + text.length * 2)
    bytes[0] = 0xff
    bytes[1] = 0xfe
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i)
        bytes[2 + i * 2] = code & 0xff
        bytes[3 + i * 2] = code >> 8
    }
    return bytes
}

function cellsOf(text: string) {
    return parseCsvText(text).dataset.rows.map((row) => row.cells)
}

describe('decodeCsvBytes', () => {
    it('strips a UTF-8 byte order mark', () => {
        const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('a,b')])
        const result = decodeCsvBytes(bytes)
        expect(result.encoding).toBe('utf-8')
        expect(result.text).toBe('a,b')
    })

    it('reads UTF-16 little-endian files', () => {
        const result = decodeCsvBytes(utf16le('a,b'))
        expect(result.encoding).toBe('utf-16le')
        expect(result.text).toBe('a,b')
    })

    it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
        const result = decodeCsvBytes(new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]))
        expect(result.encoding).toBe('windows-1252')
        expect(result.text).toBe('José')
    })
})

describe('parseCsvText', () => {
    it('reads columns and rows, numbering rows like the source file', () => {
        const { dataset, delimiter, warnings } = parseCsvText(
            'Name,City\nAsha,Delhi\nRavi,Pune',
        )
        expect(dataset.columns).toEqual([
            { id: 'c1', name: 'Name' },
            { id: 'c2', name: 'City' },
        ])
        expect(dataset.rows).toEqual([
            { sourceRow: 2, cells: ['Asha', 'Delhi'] },
            { sourceRow: 3, cells: ['Ravi', 'Pune'] },
        ])
        expect(delimiter).toBe(',')
        expect(warnings).toEqual([])
    })

    it('keeps every value as text exactly as written', () => {
        expect(cellsOf('id,n,flag,f\n00123,0,false,=1+1')).toEqual([
            ['00123', '0', 'false', '=1+1'],
        ])
    })

    it('turns empty cells into null and keeps whitespace-only cells', () => {
        expect(cellsOf('a,b,c\n,  ,x')).toEqual([[null, '  ', 'x']])
    })

    it('handles quoted commas, quotes and line breaks', () => {
        const text = 'a,b\n"x, y","say ""hi"""\n"line1\nline2",z'
        const { dataset } = parseCsvText(text)
        expect(dataset.rows.map((row) => row.cells)).toEqual([
            ['x, y', 'say "hi"'],
            ['line1\nline2', 'z'],
        ])
        // A line break inside quotes does not start a new row.
        expect(dataset.rows[1]?.sourceRow).toBe(3)
    })

    it('detects a semicolon delimiter', () => {
        const result = parseCsvText('a;b\n1;2\n3;4')
        expect(result.delimiter).toBe(';')
        expect(result.dataset.columns).toHaveLength(2)
    })

    it('gives duplicate headers distinct column ids', () => {
        const { dataset } = parseCsvText('Name,Name\nA,B')
        expect(dataset.columns.map((column) => column.id)).toEqual(['c1', 'c2'])
        expect(dataset.columns.map((column) => column.name)).toEqual(['Name', 'Name'])
    })

    it('names blank headers by position and says so', () => {
        const { dataset, warnings } = parseCsvText('a,,c\n1,2,3')
        expect(dataset.columns.map((column) => column.name)).toEqual([
            'a',
            'Column 2',
            'c',
        ])
        expect(warnings.join(' ')).toMatch(/no header/)
    })

    it('pads short rows and says so', () => {
        const { dataset, warnings } = parseCsvText('a,b,c\n1,2\n3,4,5')
        expect(dataset.rows[0]?.cells).toEqual(['1', '2', null])
        expect(warnings.join(' ')).toMatch(/1 row\(s\) had fewer values/)
    })

    it('adds columns when a row is longer than the header', () => {
        const { dataset, warnings } = parseCsvText('a,b\n1,2,3')
        expect(dataset.columns).toHaveLength(3)
        expect(dataset.columns[2]?.name).toBe('Column 3')
        expect(dataset.rows[0]?.cells).toEqual(['1', '2', '3'])
        expect(warnings.join(' ')).toMatch(/no header/)
    })

    it('ignores the final line break without a warning', () => {
        expect(parseCsvText('a,b\n1,2\n').warnings).toEqual([])
        expect(parseCsvText('a,b\r\n1,2\r\n').warnings).toEqual([])
    })

    it('reports empty rows at the end of the file', () => {
        const { dataset, warnings } = parseCsvText('a,b\n1,2\n\n\n')
        expect(dataset.rows).toHaveLength(1)
        expect(warnings.join(' ')).toMatch(/2 empty row/)
    })

    it('keeps blank lines in the middle of the file as empty rows', () => {
        const { dataset, warnings } = parseCsvText('a,b\n1,2\n\n3,4')
        expect(dataset.rows.map((row) => row.sourceRow)).toEqual([2, 3, 4])
        expect(dataset.rows.map((row) => row.cells)).toEqual([
            ['1', '2'],
            [null, null],
            ['3', '4'],
        ])
        expect(warnings).toEqual([])
    })

    it('accepts a header-only file and says it has no data rows', () => {
        const { dataset, warnings } = parseCsvText('a,b')
        expect(dataset.rows).toHaveLength(0)
        expect(warnings.join(' ')).toMatch(/no data rows/)
    })

    it('rejects empty files', () => {
        expect(() => parseCsvText('')).toThrow(ImportError)
        expect(() => parseCsvText('   \n')).toThrow('The file is empty.')
        expect(() => parseCsvText(',,,\n')).toThrow('The file contains no data.')
    })

    it('rejects a quoted value that is never closed', () => {
        expect(() => parseCsvText('a,b\n"oops,2\n3,4')).toThrow(ImportError)
    })
})

describe('importCsv', () => {
    it('decodes bytes and parses them', () => {
        const result = importCsv(encode('a,b\n1,2'))
        expect(result.encoding).toBe('utf-8')
        expect(result.warnings).toEqual([])
        expect(result.dataset.rows).toHaveLength(1)
    })

    it('warns when it had to read the file as Windows-1252', () => {
        const result = importCsv(new Uint8Array([0x4e, 0x0a, 0x4a, 0x6f, 0x73, 0xe9]))
        expect(result.encoding).toBe('windows-1252')
        expect(result.dataset.rows[0]?.cells).toEqual(['José'])
        expect(result.warnings.join(' ')).toMatch(/Windows-1252/)
    })
})