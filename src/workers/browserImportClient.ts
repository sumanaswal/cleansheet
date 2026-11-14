import { createImportClient, type ImportClient } from '@/workers/importClient'

/** Creates an import client that runs in a real browser Web Worker. */
export function createBrowserImportClient(): ImportClient {
    return createImportClient(
        () =>
            new Worker(new URL('./import.worker.ts', import.meta.url), {
                type: 'module',
            }),
    )
}