import type { DuplicateOptions } from '@/engine/operations/duplicates'
import type { MissingOptions } from '@/engine/operations/missingValues'
import type { DatasetProfile } from '@/engine/profiling/types'
import type {
    CellValue,
    Column,
    ColumnId,
    Row,
    SourceFileInfo,
} from '@/engine/types'

/** Largest page of rows the worker will return in one reply. */
export const MAX_PAGE_SIZE = 500
/** Largest page of preview records the worker will return in one reply. */
export const MAX_PREVIEW_PAGE_SIZE = 100
/** How many earlier versions of the data the worker keeps. */
export const MAX_HISTORY_DEPTH = 10

/** Everything the interface needs to know about a loaded spreadsheet. */
export interface DatasetSummary {
    readonly source: SourceFileInfo
    readonly sheetName: string | null
    readonly sheetNames: readonly string[]
    readonly warnings: readonly string[]
    readonly columns: readonly Column[]
    readonly rowCount: number
}

/** A cleaning operation and its settings. More kinds are added with each module. */
export type OperationSpec =
    | { readonly kind: 'duplicates'; readonly options: DuplicateOptions }
    | { readonly kind: 'missing'; readonly options: MissingOptions }

/** How the table marks a row while an operation is being previewed. */
export type RowMark = 'remove' | 'keep'

/** What a missing-values preview found in one chosen column. */
export interface MissingPreviewColumn {
    readonly columnId: ColumnId
    /** Position of the column, starting at 1. */
    readonly position: number
    readonly name: string
    /** Empty and whitespace-only cells. */
    readonly missingCount: number
    /** Cells matched by the chosen placeholders. */
    readonly placeholderCount: number
    /** Filling: cells that would be filled. Removing: removed rows in which this column was missing. */
    readonly affectedCount: number
    /** Filling only: how the typed value goes into this column. Null when removing rows. */
    readonly insertAs: 'text' | 'number' | null
    /** Filling only: the column holds Excel dates, and a typed value is not a real date. */
    readonly dateColumn: boolean
}

export interface MissingPreviewDetails {
    readonly action: 'fill' | 'removeRows'
    /** Filling: the value that would be inserted, with spaces at its ends removed. */
    readonly fillValue: string | null
    readonly missingCells: number
    readonly placeholderCells: number
    readonly filledCells: number
    /** One entry per chosen column, in column order. */
    readonly columns: readonly MissingPreviewColumn[]
}

/** The size of an operation's effect, without the records themselves. */
export interface OperationPreviewSummary {
    readonly totalRows: number
    readonly removedRows: number
    readonly retainedRows: number
    /** Rows that were not compared because they have no usable values. */
    readonly skippedRows: number
    /** Number of records in the preview list. */
    readonly itemCount: number
    /** Present for a missing-values preview. */
    readonly missing?: MissingPreviewDetails
}

/** One affected record in the preview list. Every kind carries its row. */
export type PreviewItem =
    | {
        readonly kind: 'removedRow'
        readonly row: Row
        /** Row number in the source file of the row that stays instead. */
        readonly keptSourceRow: number
    }
    | {
        readonly kind: 'filledCell'
        readonly row: Row
        /** Position of the column, starting at 1. */
        readonly columnPosition: number
        readonly columnName: string
        readonly oldValue: CellValue
        readonly newValue: CellValue
    }
    | {
        readonly kind: 'removedMissingRow'
        readonly row: Row
        /** The chosen columns in which this row has a missing value. */
        readonly missingColumns: readonly {
            readonly position: number
            readonly name: string
        }[]
    }

export interface AppliedResult {
    /** The summary of the data after the operation. A new object every time. */
    readonly summary: DatasetSummary
    readonly removedRows: number
    /** Cells that were filled with a value. */
    readonly filledCells: number
    /** How many earlier versions are being kept. */
    readonly historyDepth: number
}

export type WorkerRequest =
    | {
        readonly id: number
        readonly type: 'import'
        readonly fileName: string
        readonly bytes: ArrayBuffer
        readonly sheetName?: string
    }
    | {
        readonly id: number
        readonly type: 'getPage'
        readonly offset: number
        readonly limit: number
    }
    | { readonly id: number; readonly type: 'getProfile' }
    | {
        readonly id: number
        readonly type: 'previewOperation'
        readonly operation: OperationSpec
    }
    | {
        readonly id: number
        readonly type: 'getPreviewPage'
        readonly offset: number
        readonly limit: number
    }
    | { readonly id: number; readonly type: 'clearPreview' }
    | {
        readonly id: number
        readonly type: 'applyOperation'
        readonly operation: OperationSpec
    }
    | { readonly id: number; readonly type: 'clear' }

export type WorkerResponse =
    | {
        readonly id: number
        readonly type: 'imported'
        readonly summary: DatasetSummary
    }
    | {
        readonly id: number
        readonly type: 'page'
        readonly offset: number
        readonly rows: readonly Row[]
        readonly rowCount: number
        /** Present only while a preview marks whole rows. One entry per row. */
        readonly marks?: readonly (RowMark | null)[]
        /**
         * Present only while a preview fills cells. One entry per row: the
         * positions of the columns in that row that would be filled.
         */
        readonly cellMarks?: readonly (readonly number[])[]
    }
    | {
        readonly id: number
        readonly type: 'profile'
        readonly profile: DatasetProfile
    }
    | {
        readonly id: number
        readonly type: 'previewed'
        readonly summary: OperationPreviewSummary
    }
    | {
        readonly id: number
        readonly type: 'previewPage'
        readonly offset: number
        readonly items: readonly PreviewItem[]
        readonly itemCount: number
    }
    | { readonly id: number; readonly type: 'previewCleared' }
    | {
        readonly id: number
        readonly type: 'applied'
        readonly result: AppliedResult
    }
    | { readonly id: number; readonly type: 'cleared' }
    | {
        readonly id: number
        readonly type: 'error'
        /** 'import' and 'operation' messages are safe to show as they are. */
        readonly kind: 'import' | 'operation' | 'internal'
        readonly message: string
    }