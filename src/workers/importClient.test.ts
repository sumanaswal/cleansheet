// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ImportError } from '@/engine/io/types'
import {
    createImportClient,
    ImportCancelledError,
    type WorkerLike,
} from '@/workers/importClient'
import { createImportHandler } from '@/workers/importHandler'
import type { WorkerRequest, WorkerResponse } from '@/workers/protocol'

function csv(text: string): ArrayBuffer {
    const bytes = new TextEncoder().encode(text)
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
}

/** Stands in for a browser Worker by running the real handler directly. */
class HandlerWorker implements WorkerLike {
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

/** A worker that never answers, so a request stays pending until stopped. */
class SilentWorker implements WorkerLike {
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    terminated = false

    postMessage(): void {
        // Intentionally does nothing.
    }

    terminate(): void {
        this.terminated = true
    }

    crash(): void {
        this.onerror?.({} as ErrorEvent)
    }
}

describe('import client', () => {
    it('imports a file, pages through it and clears it', async () => {
        const client = createImportClient(() => new HandlerWorker())
        const summary = await client.importFile('data.csv', csv('a,b\n1,2\n3,4'))
        expect(summary.rowCount).toBe(2)

        const page = await client.getPage(0, 10)
        expect(page.rows.map((row) => row.cells)).toEqual([
            ['1', '2'],
            ['3', '4'],
        ])

        await client.clear()
        await expect(client.getPage(0, 10)).rejects.toThrow('No spreadsheet is loaded.')
    })

    it('rejects with an ImportError when the file cannot be imported', async () => {
        const client = createImportClient(() => new HandlerWorker())
        await expect(
            client.importFile('notes.pdf', csv('a,b')),
        ).rejects.toBeInstanceOf(ImportError)
    })

    it('starts one worker only when first needed and reuses it', async () => {
        let created = 0
        const client = createImportClient(() => {
            created += 1
            return new HandlerWorker()
        })
        expect(created).toBe(0)
        await client.importFile('data.csv', csv('a\n1'))
        await client.getPage(0, 10)
        expect(created).toBe(1)
    })

    it('cancels pending requests, stops the worker and starts a fresh one later', async () => {
        const silent = new SilentWorker()
        let created = 0
        const client = createImportClient(() => {
            created += 1
            return created === 1 ? silent : new HandlerWorker()
        })

        const pending = client.getPage(0, 10)
        const assertion = expect(pending).rejects.toBeInstanceOf(ImportCancelledError)
        client.cancel()
        await assertion
        expect(silent.terminated).toBe(true)

        // The fresh worker has nothing loaded.
        await expect(client.getPage(0, 10)).rejects.toThrow('No spreadsheet is loaded.')
        expect(created).toBe(2)
    })

    it('rejects pending requests when the worker crashes', async () => {
        const worker = new SilentWorker()
        const client = createImportClient(() => worker)

        const pending = client.getPage(0, 10)
        const assertion = expect(pending).rejects.toThrow('stopped unexpectedly')
        worker.crash()
        await assertion
        expect(worker.terminated).toBe(true)
    })
})