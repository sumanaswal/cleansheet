import type { DuplicateOptions } from '@/engine/operations/duplicates'
import type { DatasetProfile } from '@/engine/profiling/types'
import type { Column, Row, SourceFileInfo } from '@/engine/types'

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
export type OperationSpec = {
    readonly kind: 'duplicates'
    readonly options: DuplicateOptions
}

/** How the table marks a row while an operation is being previewed. */
export type RowMark = 'remove' | 'keep'

/** The size of an operation's effect, without the records themselves. */
export interface OperationPreviewSummary {
    readonly totalRows: number
    readonly removedRows: number
    readonly retainedRows: number
    /** Rows that were not compared because they have no usable values. */
    readonly skippedRows: number
    /** Number of records in the preview list. */
    readonly itemCount: number
}

/** One affected record in the preview list. */
export type PreviewItem = {
    readonly kind: 'removedRow'
    readonly row: Row
    /** Row number in the source file of the row that stays instead. */
    readonly keptSourceRow: number
}

export interface AppliedResult {
    /** The summary of the data after the operation. A new object every time. */
    readonly summary: DatasetSummary
    readonly removedRows: number
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
        /** Present only while an operation is being previewed. One entry per row. */
        readonly marks?: readonly (RowMark | null)[]
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