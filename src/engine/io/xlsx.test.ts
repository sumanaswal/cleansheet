// @vitest-environment node
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { ImportError } from '@/engine/io/types'
import {
    importXlsxSheet,
    isDateFormat,
    listXlsxSheets,
} from '@/engine/io/xlsx'
import { IMPORT_LIMITS } from '@/engine/io/validation'

function toBytes(sheets: ReadonlyArray<[string, XLSX.WorkSheet]>): Uint8Array {
    const workbook = XLSX.utils.book_new()
    for (const [name, sheet] of sheets) {
        XLSX.utils.book_append_sheet(workbook, sheet, name)
    }
    const out: ArrayBuffer = XLSX.write(workbook, {
        type: 'array',
        bookType: 'xlsx',
    })
    return new Uint8Array(out)
}

function single(sheet: XLSX.WorkSheet): Uint8Array {
    return toBytes([['Sheet1', sheet]])
}

function cellsOf(bytes: Uint8Array) {
    return importXlsxSheet(bytes).dataset.rows.map((row) => row.cells)
}

describe('isDateFormat', () => {
    it('recognises date and time formats', () => {
        for (const format of [
            'dd-mm-yyyy',
            'd-mmm-yy',
            'h:mm',
            'yyyy-mm-dd hh:mm:ss',
            '[$-409]mmmm d, yyyy',
            '[h]:mm:ss',
        ]) {
            expect(isDateFormat(format), format).toBe(true)
        }
    })

    it('does not treat number formats as dates', () => {
        for (const format of [
            'General',
            '0',
            '00000',
            '#,##0.00',
            '0.00%',
            '0.00E+00',
            '"days" 0',
            '[Red]0.0',
            '@',
        ]) {
            expect(isDateFormat(format), format).toBe(false)
        }
    })
})

describe('importXlsxSheet: cell values', () => {
    it('reads headers and rows, numbering rows like the sheet', () => {
        const result = importXlsxSheet(
            single(
                XLSX.utils.aoa_to_sheet([
                    ['Name', 'Qty'],
                    ['Asha', 5],
                    ['Ravi', 0],
                ]),
            ),
        )
        expect(result.dataset.columns).toEqual([
            { id: 'c1', name: 'Name' },
            { id: 'c2', name: 'Qty' },
        ])
        expect(result.dataset.rows).toEqual([
            { sourceRow: 2, cells: ['Asha', 5] },
            { sourceRow: 3, cells: ['Ravi', 0] },
        ])
        expect(result.warnings).toEqual([])
        expect(result.sheetName).toBe('Sheet1')
    })

    it('keeps text identifiers as text, and zero and false as real values', () => {
        expect(
            cellsOf(
                single(
                    XLSX.utils.aoa_to_sheet([
                        ['id', 'n', 'flag'],
                        ['00123', 0, false],
                    ]),
                ),
            ),
        ).toEqual([['00123', 0, false]])
    })

    it('imports numbers formatted with leading zeros as text and reports it', () => {
        const sheet: XLSX.WorkSheet = {
            A1: { t: 's', v: 'ID' },
            A2: { t: 'n', v: 123, z: '00000' },
            '!ref': 'A1:A2',
        }
        const result = importXlsxSheet(single(sheet))
        expect(result.dataset.rows[0]?.cells).toEqual(['00123'])
        expect(result.warnings.join(' ')).toMatch(/leading zeros/)
    })

    it('keeps other formatted numbers as plain numbers', () => {
        const sheet: XLSX.WorkSheet = {
            A1: { t: 's', v: 'Amount' },
            A2: { t: 'n', v: 1234.5, z: '#,##0.00' },
            '!ref': 'A1:A2',
        }
        const result = importXlsxSheet(single(sheet))
        expect(result.dataset.rows[0]?.cells).toEqual([1234.5])
        expect(result.warnings).toEqual([])
    })

    it('imports date cells as date cells with the raw serial number', () => {
        const sheet: XLSX.WorkSheet = {
            A1: { t: 's', v: 'Joined' },
            A2: { t: 'n', v: 46000, z: 'dd-mm-yyyy' },
            '!ref': 'A1:A2',
        }
        expect(cellsOf(single(sheet))).toEqual([
            [{ kind: 'date', serial: 46000, text: '09-12-2025' }],
        ])
    })

    it('treats empty cells and empty text as null and keeps whitespace', () => {
        expect(
            cellsOf(
                single(
                    XLSX.utils.aoa_to_sheet([
                        ['a', 'b', 'c'],
                        [null, '', ' '],
                    ]),
                ),
            ),
        ).toEqual([[null, null, ' ']])
    })

    it('imports formula results and reports that formulas are not kept', () => {
        const sheet: XLSX.WorkSheet = {
            A1: { t: 's', v: 'total' },
            A2: { t: 'n', v: 3, f: '1+2' },
            '!ref': 'A1:A2',
        }
        const result = importXlsxSheet(single(sheet))
        expect(result.dataset.rows[0]?.cells).toEqual([3])
        expect(result.warnings.join(' ')).toMatch(/formulas/)
    })

    it('imports Excel errors as text and reports them', () => {
        const sheet: XLSX.WorkSheet = {
            A1: { t: 's', v: 'ratio' },
            A2: { t: 'e', v: 7, w: '#DIV/0!' },
            '!ref': 'A1:A2',
        }
        const result = importXlsxSheet(single(sheet))
        expect(result.dataset.rows[0]?.cells).toEqual(['#DIV/0!'])
        expect(result.warnings.join(' ')).toMatch(/Excel errors/)
    })
})

describe('importXlsxSheet: structure', () => {
    it('names blank headers by position and gives duplicates distinct ids', () => {
        const result = importXlsxSheet(
            single(
                XLSX.utils.aoa_to_sheet([
                    ['a', null, 'a'],
                    [1, 2, 3],
                ]),
            ),
        )
        expect(result.dataset.columns).toEqual([
            { id: 'c1', name: 'a' },
            { id: 'c2', name: 'Column 2' },
            { id: 'c3', name: 'a' },
        ])
        expect(result.warnings.join(' ')).toMatch(/no header/)
    })

    it('skips empty space before the data and says where the data starts', () => {
        const sheet: XLSX.WorkSheet = {
            B3: { t: 's', v: 'x' },
            C3: { t: 's', v: 'y' },
            B4: { t: 'n', v: 1 },
            C4: { t: 'n', v: 2 },
            '!ref': 'B3:C4',
        }
        const result = importXlsxSheet(single(sheet))
        expect(result.dataset.columns.map((column) => column.name)).toEqual([
            'x',
            'y',
        ])
        expect(result.dataset.rows[0]?.sourceRow).toBe(4)
        expect(result.warnings.join(' ')).toMatch(/starts at B3/)
    })

    it('reports merged cells', () => {
        const sheet = XLSX.utils.aoa_to_sheet([
            ['title', null],
            [1, 2],
        ])
        sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
        const result = importXlsxSheet(single(sheet))
        expect(result.warnings.join(' ')).toMatch(/merged cell range/)
    })

    it('accepts a header-only sheet and says it has no data rows', () => {
        const result = importXlsxSheet(
            single(XLSX.utils.aoa_to_sheet([['a', 'b']])),
        )
        expect(result.dataset.rows).toHaveLength(0)
        expect(result.warnings.join(' ')).toMatch(/no data rows/)
    })

    it('rejects an empty sheet', () => {
        expect(() => importXlsxSheet(single(XLSX.utils.aoa_to_sheet([])))).toThrow(
            /contains no data/,
        )
    })
})

describe('worksheet selection', () => {
    const bytes = toBytes([
        ['First', XLSX.utils.aoa_to_sheet([['a'], ['one']])],
        ['Second', XLSX.utils.aoa_to_sheet([['b'], ['two']])],
    ])

    it('lists the worksheet names', () => {
        expect(listXlsxSheets(bytes)).toEqual(['First', 'Second'])
    })

    it('reads the first sheet by default and any sheet by name', () => {
        const first = importXlsxSheet(bytes)
        expect(first.sheetName).toBe('First')
        expect(first.sheetNames).toEqual(['First', 'Second'])
        expect(first.dataset.rows[0]?.cells).toEqual(['one'])
        expect(importXlsxSheet(bytes, 'Second').dataset.rows[0]?.cells).toEqual([
            'two',
        ])
    })

    it('rejects an unknown sheet name', () => {
        expect(() => importXlsxSheet(bytes, 'Nope')).toThrow(/not found/)
    })
})

describe('bad input and limits', () => {
    it('rejects bytes that are not a ZIP archive', () => {
        const text = new TextEncoder().encode('a,b\n1,2')
        expect(() => importXlsxSheet(text)).toThrow(ImportError)
    })

    it('rejects a damaged ZIP archive', () => {
        const damaged = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6])
        expect(() => importXlsxSheet(damaged)).toThrow(ImportError)
    })

    it('rejects sheets with too many columns before building rows', () => {
        const bytes = single(XLSX.utils.aoa_to_sheet([['a', 'b', 'c'], [1, 2, 3]]))
        expect(() =>
            importXlsxSheet(bytes, undefined, { ...IMPORT_LIMITS, maxColumns: 2 }),
        ).toThrow(/3 columns/)
    })

    it('rejects sheets with too many data rows', () => {
        const bytes = single(XLSX.utils.aoa_to_sheet([['a'], [1], [2]]))
        expect(() =>
            importXlsxSheet(bytes, undefined, { ...IMPORT_LIMITS, maxRows: 1 }),
        ).toThrow(/2 data rows/)
    })
})