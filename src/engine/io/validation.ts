import { ImportError } from '@/engine/io/types'
import type { Dataset, SourceFileInfo } from '@/engine/types'

export type FileFormat = SourceFileInfo['format']

export interface ImportLimits {
    readonly maxFileSizeBytes: number
    /** Data rows, not counting the header row. */
    readonly maxRows: number
    readonly maxColumns: number
}

/** Initial limits. To be confirmed or changed by testing in Phase 8. */
export const IMPORT_LIMITS: ImportLimits = {
    maxFileSizeBytes: 10 * 1024 * 1024,
    maxRows: 50_000,
    maxColumns: 100,
}

// An .xlsx file is a ZIP archive, which starts with "PK" and two more bytes.
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]
// Old Excel formats and password-protected Excel files share this signature.
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0]

const CONVERTIBLE_EXTENSIONS = ['xls', 'xlsm', 'xlsb', 'ods']

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
    return signature.every((byte, index) => bytes[index] === byte)
}

/** True when the bytes start like a ZIP archive, which every .xlsx file does. */
export function hasZipSignature(bytes: Uint8Array): boolean {
    return startsWith(bytes, ZIP_SIGNATURE)
}

function getExtension(fileName: string): string {
    const dot = fileName.lastIndexOf('.')
    return dot <= 0 ? '' : fileName.slice(dot + 1).toLowerCase()
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} byte${bytes === 1 ? '' : 's'}`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Checks a file before it is read. `head` is the first few bytes of the file
 * (at least 4 are used). Returns the detected format or throws an ImportError
 * with a message that is safe to show to the user.
 */
export function validateFile(
    fileName: string,
    sizeBytes: number,
    head: Uint8Array,
    limits: ImportLimits = IMPORT_LIMITS,
): FileFormat {
    if (sizeBytes === 0) {
        throw new ImportError('The file is empty.')
    }
    if (sizeBytes > limits.maxFileSizeBytes) {
        throw new ImportError(
            `The file is ${formatBytes(sizeBytes)}, which is over the ${formatBytes(limits.maxFileSizeBytes)} limit. Try splitting it into smaller files.`,
        )
    }

    const extension = getExtension(fileName)

    if (CONVERTIBLE_EXTENSIONS.includes(extension)) {
        throw new ImportError(
            `.${extension} files are not supported directly. Open the file in Excel, save a copy as .xlsx or .csv, then upload that copy.`,
        )
    }

    if (extension === 'xlsx') {
        if (startsWith(head, OLE_SIGNATURE)) {
            throw new ImportError(
                'This file is not a standard .xlsx workbook. It may be password-protected or saved in an older Excel format. Remove the password or save a copy as .xlsx, then try again.',
            )
        }
        if (!startsWith(head, ZIP_SIGNATURE)) {
            throw new ImportError(
                'This file could not be read as an Excel workbook. It may be damaged, or it may not really be an .xlsx file.',
            )
        }
        return 'xlsx'
    }

    if (extension === 'csv') {
        if (startsWith(head, ZIP_SIGNATURE) || startsWith(head, OLE_SIGNATURE)) {
            throw new ImportError(
                'This file has a .csv name but looks like an Excel workbook. In Excel, save a copy as .xlsx or as a real CSV file, then try again.',
            )
        }
        return 'csv'
    }

    throw new ImportError(
        extension === ''
            ? 'This file has no extension, so its type cannot be determined. CleanSheet supports .xlsx and .csv files.'
            : `.${extension} files are not supported. CleanSheet supports .xlsx and .csv files.`,
    )
}

/** Checks a sheet's size against the row and column limits. */
export function validateSheetSize(
    dataRows: number,
    columns: number,
    limits: ImportLimits = IMPORT_LIMITS,
): void {
    if (columns > limits.maxColumns) {
        throw new ImportError(
            `The sheet has ${columns.toLocaleString('en-US')} columns. CleanSheet currently supports up to ${limits.maxColumns.toLocaleString('en-US')} columns.`,
        )
    }
    if (dataRows > limits.maxRows) {
        throw new ImportError(
            `The sheet has ${dataRows.toLocaleString('en-US')} data rows. CleanSheet currently supports up to ${limits.maxRows.toLocaleString('en-US')} rows.`,
        )
    }
}

/** Checks a parsed dataset against the row and column limits. */
export function validateDatasetLimits(
    dataset: Dataset,
    limits: ImportLimits = IMPORT_LIMITS,
): void {
    validateSheetSize(dataset.rows.length, dataset.columns.length, limits)
}