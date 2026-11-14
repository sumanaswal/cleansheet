import type { Dataset } from '@/engine/types'

/** Thrown when a file cannot be imported. The message is shown to the user. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

export interface ImportResult {
  readonly dataset: Dataset
  /** Plain-language notes about anything the importer had to interpret. */
  readonly warnings: readonly string[]
}