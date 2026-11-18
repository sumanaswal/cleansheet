import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DatasetProfile } from '@/engine/profiling/types'
import { useDatasetProfile } from '@/hooks/useDatasetProfile'
import { makeProfile } from '@/test/session'

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('useDatasetProfile', () => {
    it('does nothing when no spreadsheet is loaded', () => {
        const getProfile = vi.fn()
        const { result } = renderHook(() => useDatasetProfile(getProfile, null))
        expect(result.current).toEqual({ status: 'idle', profile: null, error: null })
        expect(getProfile).not.toHaveBeenCalled()
    })

    it('analyzes the spreadsheet and then returns its profile', async () => {
        const profile = makeProfile()
        const getProfile = vi.fn().mockResolvedValue(profile)
        const version = {}
        const { result } = renderHook(() => useDatasetProfile(getProfile, version))
        expect(result.current.status).toBe('analyzing')
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.profile).toBe(profile)
        expect(getProfile).toHaveBeenCalledTimes(1)
    })

    it('reports an error when the analysis fails', async () => {
        const getProfile = vi.fn().mockRejectedValue(new Error('boom'))
        const version = {}
        const { result } = renderHook(() => useDatasetProfile(getProfile, version))
        await waitFor(() => expect(result.current.status).toBe('error'))
        expect(result.current.error).toBe('boom')
        expect(result.current.profile).toBeNull()
    })

    it('hides the old profile while the new data is analyzed', async () => {
        const first = makeProfile({ totalRows: 1 })
        const second = makeProfile({ totalRows: 2 })
        const pending = deferred<DatasetProfile>()
        const getProfile = vi
            .fn()
            .mockResolvedValueOnce(first)
            .mockReturnValueOnce(pending.promise)
        const v1 = {}
        const v2 = {}
        const { result, rerender } = renderHook(
            ({ version }) => useDatasetProfile(getProfile, version),
            { initialProps: { version: v1 as object | null } },
        )
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.profile).toBe(first)

        rerender({ version: v2 })
        expect(result.current.status).toBe('analyzing')
        expect(result.current.profile).toBeNull()

        await act(async () => {
            pending.resolve(second)
        })
        expect(result.current.status).toBe('ready')
        expect(result.current.profile).toBe(second)
    })

    it('ignores a reply that arrives late for data that was replaced', async () => {
        const slowProfile = makeProfile({ totalRows: 1 })
        const fastProfile = makeProfile({ totalRows: 2 })
        const slow = deferred<DatasetProfile>()
        const fast = deferred<DatasetProfile>()
        const getProfile = vi
            .fn()
            .mockReturnValueOnce(slow.promise)
            .mockReturnValueOnce(fast.promise)
        const v1 = {}
        const v2 = {}
        const { result, rerender } = renderHook(
            ({ version }) => useDatasetProfile(getProfile, version),
            { initialProps: { version: v1 as object | null } },
        )

        rerender({ version: v2 })
        await act(async () => {
            fast.resolve(fastProfile)
        })
        await act(async () => {
            slow.resolve(slowProfile)
        })
        expect(result.current.profile).toBe(fastProfile)
    })
})