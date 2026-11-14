import { createImportHandler } from '@/workers/importHandler'
import type { WorkerRequest, WorkerResponse } from '@/workers/protocol'

// The minimal part of the worker environment this file uses.
interface WorkerScope {
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
    postMessage(message: WorkerResponse): void
}

const scope = self as unknown as WorkerScope
const handle = createImportHandler()

scope.onmessage = (event) => {
    scope.postMessage(handle(event.data))
}