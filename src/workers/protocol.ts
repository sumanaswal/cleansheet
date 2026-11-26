import type { DuplicateOptions } from '@/engine/operations/duplicates'
import type { MissingOptions } from '@/engine/operations/missingValues'
import type {
    TextCleaningOptions,
    TextRuleCounts,
} from '@/engine/operations/textCleaning'
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
/**
 * How many earlier versions of the data the worker keeps. Lowered from 10 to 5
 * because text cleaning can rewrite most of a large sheet, and each version
 * keeps its rows in memory. Phase 8 measurements may raise it.
 */
export const MAX_HISTORY_DEPTH = 5

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
    | { readonly kind: 'text'; readonly options: TextCleaningOptions }

/** How the table marks a row while an operation is being previewed. */
export type RowMark = 'remove' | 'keep'

/**
 * What a highlighted cell means: it would be filled with a value, or its text
 * would be changed.
 */
export type CellMarkKind = 'fill' | 'change'

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

/** What a text-cleaning preview found in one chosen column. */
export interface TextPreviewColumn {
    readonly columnId: ColumnId
    /** Position of the column, starting at 1. */
    readonly position: number
    readonly name: string
    /** Cells with text in them. Empty cells are not counted. */
    readonly textCells: number
    /** Numbers, true/false and dates. These are never changed. */
    readonly nonTextCells: number
    /** Text cells that would change. */
    readonly changedCount: number
    /** Cells changed by each rule. A cell can be counted under several rules. */
    readonly ruleCounts: TextRuleCounts
    /** Characters the non-printing rule would remove. */
    readonly removedChars: number
    /** Cells left in their original case because they are email or web addresses. */
    readonly keptAddressCount: number
}

export interface TextPreviewDetails {
    readonly textCells: number
    readonly nonTextCells: number
    readonly changedCells: number
    readonly removedChars: number
    readonly keptAddresses: number
    /** One entry per chosen column, in column order. */
    readonly columns: readonly TextPreviewColumn[]
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
    /** Present for a text-cleaning preview. */
    readonly text?: TextPreviewDetails
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
    | {
        readonly kind: 'changedText'
        readonly row: Row
        /** Position of the column, starting at 1. */
        readonly columnPosition: number
        readonly columnName: string
        readonly oldText: string
        /** The cleaned text, or null when nothing would be left. */
        readonly newText: string | null
    }

export interface AppliedResult {
    /** The summary of the data after the operation. A new object every time. */
    readonly summary: DatasetSummary
    readonly removedRows: number
    /** Cells that were filled with a value. */
    readonly filledCells: number
    /** Text cells that were rewritten by text cleaning. */
    readonly changedCells: number
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
         * Present only while a preview changes cells. One entry per row: the
         * positions of the columns in that row that would change.
         */
        readonly cellMarks?: readonly (readonly number[])[]
        /** Present with `cellMarks`: whether the cells would be filled or changed. */
        readonly cellMarkKind?: CellMarkKind
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