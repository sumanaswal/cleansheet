import type { Column, Row, SourceFileInfo } from '@/engine/types'

/** Largest page the worker will return in one reply. */
export const MAX_PAGE_SIZE = 500

/** Everything the interface needs to know about a loaded spreadsheet. */
export interface DatasetSummary {
    readonly source: SourceFileInfo
    readonly sheetName: string | null
    readonly sheetNames: readonly string[]
    readonly warnings: readonly string[]
    readonly columns: readonly Column[]
    readonly rowCount: number
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
    }
    | { readonly id: number; readonly type: 'cleared' }
    | {
        readonly id: number
        readonly type: 'error'
        /** 'import' messages are safe to show as they are. */
        readonly kind: 'import' | 'internal'
        readonly message: string
    }