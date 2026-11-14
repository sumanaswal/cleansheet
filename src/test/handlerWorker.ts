import type { WorkerLike } from '@/workers/importClient'
import { createImportHandler } from '@/workers/importHandler'
import type { WorkerRequest, WorkerResponse } from '@/workers/protocol'

/** Stands in for a browser Worker in tests by running the real handler directly. */
export class HandlerWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false
  private readonly handle = createImportHandler()

  postMessage(message: WorkerRequest): void {
    const response = this.handle(message)
    queueMicrotask(() => {
      this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>)
    })
  }

  terminate(): void {
    this.terminated = true
  }
}