import { vi } from 'vitest'

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
}

/** A fresh buffer holding the text. Each call returns a new one, because transferring a buffer empties it. */
export function csvBuffer(text: string): ArrayBuffer {
    return toArrayBuffer(new TextEncoder().encode(text))
}

/** A File stand-in that gives out a fresh copy of the bytes on every read. */
export function fakeFile(
    name: string,
    bytes: ArrayBuffer,
    size = bytes.byteLength,
) {
    const arrayBuffer = vi.fn(async () => bytes.slice(0))
    const file = {
        name,
        size,
        slice: (start: number, end: number) => ({
            arrayBuffer: async () => bytes.slice(start, end),
        }),
        arrayBuffer,
    } as unknown as File
    return { file, arrayBuffer }
}