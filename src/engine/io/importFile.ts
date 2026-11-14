import { importCsv } from '@/engine/io/csv'
import type { ImportResult } from '@/engine/io/types'
import {
    IMPORT_LIMITS,
    validateDatasetLimits,
    validateFile,
    type ImportLimits,
} from '@/engine/io/validation'
import { importXlsxSheet } from '@/engine/io/xlsx'
import type { SourceFileInfo } from '@/engine/types'

export interface ImportOptions {
    /** Worksheet to read from an .xlsx file. Defaults to the first one. */
    readonly sheetName?: string
    readonly limits?: ImportLimits
}

export interface ImportedFile extends ImportResult {
    readonly source: SourceFileInfo
    /** The worksheet that was read, or null for a CSV file. */
    readonly sheetName: string | null
    /** All worksheet names in the workbook. Empty for a CSV file. */
    readonly sheetNames: readonly string[]
}

/**
 * Imports a spreadsheet file from its name and raw bytes. Validates the file,
 * reads it as CSV or XLSX, and enforces the row and column limits.
 * Throws an ImportError with a user-ready message if the file cannot be used.
 */
export function importFile(
    fileName: string,
    bytes: Uint8Array,
    options: ImportOptions = {},
): ImportedFile {
    const limits = options.limits ?? IMPORT_LIMITS
    const format = validateFile(
        fileName,
        bytes.byteLength,
        bytes.subarray(0, 8),
        limits,
    )
    const source: SourceFileInfo = {
        name: fileName,
        sizeBytes: bytes.byteLength,
        format,
    }

    if (format === 'csv') {
        const result = importCsv(bytes)
        validateDatasetLimits(result.dataset, limits)
        return {
            source,
            dataset: result.dataset,
            warnings: result.warnings,
            sheetName: null,
            sheetNames: [],
        }
    }

    const result = importXlsxSheet(bytes, options.sheetName, limits)
    return {
        source,
        dataset: result.dataset,
        warnings: result.warnings,
        sheetName: result.sheetName,
        sheetNames: result.sheetNames,
    }
}