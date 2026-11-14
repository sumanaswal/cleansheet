import Papa from 'papaparse'

import { ImportError, type ImportResult } from '@/engine/io/types'
import type { CellValue, Column, Row } from '@/engine/types'

export type CsvEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252'

export interface DecodedCsvText {
    readonly text: string
    readonly encoding: CsvEncoding
}

export interface ParsedCsv extends ImportResult {
    readonly delimiter: string
}

export interface CsvImportResult extends ParsedCsv {
    readonly encoding: CsvEncoding
}

const WINDOWS_1252_WARNING =
    'The file is not valid UTF-8, so it was read as Windows-1252 (common for older Excel CSV files). Check that accented characters look right.'

/** Turns raw file bytes into text and reports which encoding was used. */
export function decodeCsvBytes(bytes: Uint8Array): DecodedCsvText {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16le' }
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16be' }
    }
    try {
        // A UTF-8 byte order mark is removed by the decoder.
        return {
            text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
            encoding: 'utf-8',
        }
    } catch {
        return {
            text: new TextDecoder('windows-1252').decode(bytes),
            encoding: 'windows-1252',
        }
    }
}

function isBlankRecord(record: readonly string[] | undefined): boolean {
    return record === undefined || record.every((value) => value === '')
}

/**
 * Parses CSV text into a Dataset. Every value stays text exactly as written;
 * empty cells become null. The first record is the header.
 */
export function parseCsvText(text: string): ParsedCsv {
    if (text.trim() === '') {
        throw new ImportError('The file is empty.')
    }

    const parsed = Papa.parse<string[]>(text, {
        header: false,
        dynamicTyping: false,
        skipEmptyLines: false,
    })

    const warnings: string[] = []

    const unclosed = parsed.errors.find((error) => error.code === 'MissingQuotes')
    if (unclosed) {
        const where =
            unclosed.row === undefined ? '' : ` near record ${unclosed.row + 1}`
        throw new ImportError(
            `The file has a quoted value that is never closed${where}, so it cannot be read reliably. Check the file for a stray quotation mark.`,
        )
    }
    const oddQuotes = parsed.errors.filter((error) => error.code === 'InvalidQuotes')
    if (oddQuotes.length > 0) {
        warnings.push(
            `${oddQuotes.length} value(s) contain quotation marks in unusual places. Check that those values look right.`,
        )
    }

    // Blank lines at the very end are ignored. A single line break at the end
    // of the file is normal and is not reported.
    const records = parsed.data
    let end = records.length
    while (end > 0 && isBlankRecord(records[end - 1])) {
        end -= 1
    }
    const endsWithLineBreak = /[\r\n]$/.test(text)
    const ignoredBlankRows = records.length - end - (endsWithLineBreak ? 1 : 0)
    if (ignoredBlankRows > 0) {
        warnings.push(
            `${ignoredBlankRows} empty row(s) at the end of the file were ignored.`,
        )
    }

    const data = records.slice(0, end)
    if (data.length === 0) {
        throw new ImportError('The file contains no data.')
    }

    let width = 0
    for (const record of data) {
        if (record.length > width) width = record.length
    }

    const header = data[0] ?? []
    const columns: Column[] = []
    let blankHeaders = 0
    for (let i = 0; i < width; i += 1) {
        const rawName = header[i] ?? ''
        const isBlank = rawName.trim() === ''
        if (isBlank) blankHeaders += 1
        columns.push({ id: `c${i + 1}`, name: isBlank ? `Column ${i + 1}` : rawName })
    }
    if (blankHeaders > 0) {
        warnings.push(
            `${blankHeaders} column(s) had no header and were named "Column N" after their position.`,
        )
    }

    const rows: Row[] = []
    let shortRows = 0
    for (let r = 1; r < data.length; r += 1) {
        const record = data[r] ?? []
        if (record.length < width && !isBlankRecord(record)) shortRows += 1
        const cells: CellValue[] = []
        for (let i = 0; i < width; i += 1) {
            const value = record[i]
            cells.push(value === undefined || value === '' ? null : value)
        }
        rows.push({ sourceRow: r + 1, cells })
    }
    if (shortRows > 0) {
        warnings.push(
            `${shortRows} row(s) had fewer values than the widest row. Missing values were treated as empty cells.`,
        )
    }
    if (rows.length === 0) {
        warnings.push('The file has a header row but no data rows.')
    }

    return {
        dataset: { columns, rows },
        warnings,
        delimiter: parsed.meta.delimiter,
    }
}

/** Reads a CSV file from raw bytes: detects the encoding, then parses. */
export function importCsv(bytes: Uint8Array): CsvImportResult {
    const { text, encoding } = decodeCsvBytes(bytes)
    const parsed = parseCsvText(text)
    const warnings =
        encoding === 'windows-1252'
            ? [WINDOWS_1252_WARNING, ...parsed.warnings]
            : parsed.warnings
    return { ...parsed, warnings, encoding }
}