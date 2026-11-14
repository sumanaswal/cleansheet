import * as XLSX from 'xlsx'

import { ImportError, type ImportResult } from '@/engine/io/types'
import {
    hasZipSignature,
    IMPORT_LIMITS,
    validateSheetSize,
    type ImportLimits,
} from '@/engine/io/validation'
import type { CellValue, Column, Row } from '@/engine/types'

export interface XlsxImportResult extends ImportResult {
    readonly sheetName: string
    readonly sheetNames: readonly string[]
}

interface Tally {
    formulas: number
    leadingZeroText: number
    errors: number
}

const CELL_ADDRESS = /^[A-Z]+[1-9][0-9]*$/
// Formats made only of zeros, such as 00000, pad numbers with leading zeros.
const LEADING_ZERO_FORMAT = /^0{2,}$/

/**
 * True when an Excel number format displays a date or time (for example
 * dd-mm-yyyy or h:mm). Quoted text, escaped characters, colour and locale
 * codes are ignored before looking for date and time letters.
 */
export function isDateFormat(format: string): boolean {
    const stripped = format
        .replace(/"[^"]*"/g, '')
        .replace(/\\./g, '')
        .replace(/[_*]./g, '')
        .replace(/\[(?![hms]+\])[^\]]*\]/gi, '')
    return /[dmyhs]/i.test(stripped)
}

function hasContent(cell: XLSX.CellObject): boolean {
    return (
        cell.t !== 'z' &&
        cell.v !== undefined &&
        !(cell.t === 's' && cell.v === '')
    )
}

function headerText(cell: XLSX.CellObject | undefined): string {
    if (cell === undefined || !hasContent(cell)) return ''
    return cell.w ?? String(cell.v)
}

function convertCell(
    cell: XLSX.CellObject | undefined,
    tally: Tally,
): CellValue {
    if (cell === undefined || !hasContent(cell)) return null
    if (cell.f !== undefined) tally.formulas += 1

    switch (cell.t) {
        case 's':
            return typeof cell.v === 'string' ? cell.v : String(cell.v)
        case 'b':
            return Boolean(cell.v)
        case 'e':
            tally.errors += 1
            return cell.w ?? '#ERROR'
        case 'n': {
            const value = cell.v
            if (typeof value !== 'number') return cell.w ?? String(value)
            const format = typeof cell.z === 'string' ? cell.z : undefined
            if (format !== undefined) {
                if (isDateFormat(format)) {
                    return { kind: 'date', serial: value, text: cell.w ?? '' }
                }
                if (
                    LEADING_ZERO_FORMAT.test(format) &&
                    Number.isInteger(value) &&
                    value >= 0
                ) {
                    tally.leadingZeroText += 1
                    return String(value).padStart(format.length, '0')
                }
            }
            return value
        }
        default:
            return cell.w ?? String(cell.v)
    }
}

function readWorkbook(
    bytes: Uint8Array,
    options: XLSX.ParsingOptions,
): XLSX.WorkBook {
    if (!hasZipSignature(bytes)) {
        throw new ImportError(
            'This file could not be read as an Excel workbook. It may be damaged, or it may not really be an .xlsx file.',
        )
    }
    try {
        return XLSX.read(bytes, { ...options, type: 'array' })
    } catch {
        throw new ImportError(
            'This workbook could not be read. The file may be damaged.',
        )
    }
}

/** Returns the worksheet names of a workbook without parsing any sheet. */
export function listXlsxSheets(bytes: Uint8Array): string[] {
    const workbook = readWorkbook(bytes, { bookSheets: true })
    if (workbook.SheetNames.length === 0) {
        throw new ImportError('The workbook has no worksheets.')
    }
    return [...workbook.SheetNames]
}

/**
 * Reads one worksheet (the first one by default) into a Dataset. The first
 * row with content is the header. Anything the importer had to interpret is
 * reported in `warnings`.
 */
export function importXlsxSheet(
    bytes: Uint8Array,
    sheetName?: string,
    limits: ImportLimits = IMPORT_LIMITS,
): XlsxImportResult {
    const sheetNames = listXlsxSheets(bytes)
    const selected = sheetName ?? sheetNames[0]
    if (selected === undefined || !sheetNames.includes(selected)) {
        throw new ImportError(
            `The worksheet "${sheetName ?? ''}" was not found in this workbook.`,
        )
    }

    const workbook = readWorkbook(bytes, {
        sheets: sheetNames.indexOf(selected),
        cellNF: true,
        cellText: true,
    })
    const sheet = workbook.Sheets[selected]
    if (sheet === undefined) {
        throw new ImportError(`The worksheet "${selected}" could not be read.`)
    }

    // Find where the data really is. The sheet's declared size is not trusted:
    // Excel files often declare far more empty rows than they contain.
    let minRow = Infinity
    let maxRow = -1
    let minCol = Infinity
    let maxCol = -1
    for (const key in sheet) {
        if (!CELL_ADDRESS.test(key)) continue
        const cell = sheet[key] as XLSX.CellObject | undefined
        if (cell === undefined || !hasContent(cell)) continue
        const { r, c } = XLSX.utils.decode_cell(key)
        if (r < minRow) minRow = r
        if (r > maxRow) maxRow = r
        if (c < minCol) minCol = c
        if (c > maxCol) maxCol = c
    }
    if (maxRow < 0) {
        throw new ImportError(`The worksheet "${selected}" contains no data.`)
    }

    const columnCount = maxCol - minCol + 1
    const dataRowCount = maxRow - minRow
    validateSheetSize(dataRowCount, columnCount, limits)

    const lookup = (r: number, c: number) =>
        sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined

    const columns: Column[] = []
    let blankHeaders = 0
    for (let c = minCol; c <= maxCol; c += 1) {
        const text = headerText(lookup(minRow, c))
        const index = c - minCol + 1
        if (text.trim() === '') blankHeaders += 1
        columns.push({
            id: `c${index}`,
            name: text.trim() === '' ? `Column ${index}` : text,
        })
    }

    const tally: Tally = { formulas: 0, leadingZeroText: 0, errors: 0 }
    const rows: Row[] = []
    for (let r = minRow + 1; r <= maxRow; r += 1) {
        const cells: CellValue[] = []
        for (let c = minCol; c <= maxCol; c += 1) {
            cells.push(convertCell(lookup(r, c), tally))
        }
        rows.push({ sourceRow: r + 1, cells })
    }

    const warnings: string[] = []
    if (minRow !== 0 || minCol !== 0) {
        const start = XLSX.utils.encode_cell({ r: minRow, c: minCol })
        warnings.push(
            `The data starts at ${start}, not A1. Empty rows and columns before the data were skipped. Row numbers still match the sheet.`,
        )
    }
    const mergeCount = sheet['!merges']?.length ?? 0
    if (mergeCount > 0) {
        warnings.push(
            `${mergeCount} merged cell range(s) were found. Only the top-left cell of each range holds a value. The other cells are empty.`,
        )
    }
    if (tally.formulas > 0) {
        warnings.push(
            `${tally.formulas} cell(s) contain formulas. Their last calculated values were imported. The formulas themselves are not kept.`,
        )
    }
    if (tally.leadingZeroText > 0) {
        warnings.push(
            `${tally.leadingZeroText} cell(s) were formatted in Excel with leading zeros (for example 00123). They were imported as text so the zeros are kept.`,
        )
    }
    if (tally.errors > 0) {
        warnings.push(
            `${tally.errors} cell(s) contain Excel errors (such as #DIV/0!). They were imported as text.`,
        )
    }
    if (blankHeaders > 0) {
        warnings.push(
            `${blankHeaders} column(s) had no header and were named "Column N" after their position.`,
        )
    }
    if (rows.length === 0) {
        warnings.push('The sheet has a header row but no data rows.')
    }

    return {
        dataset: { columns, rows },
        warnings,
        sheetName: selected,
        sheetNames,
    }
}