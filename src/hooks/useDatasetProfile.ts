import { useEffect, useState } from 'react'

import type { DatasetProfile } from '@/engine/profiling/types'

export type ProfileStatus = 'idle' | 'analyzing' | 'ready' | 'error'

export interface DatasetProfileState {
    readonly status: ProfileStatus
    readonly profile: DatasetProfile | null
    readonly error: string | null
}

interface Outcome {
    readonly version: object
    readonly profile: DatasetProfile | null
    readonly error: string | null
}

const IDLE: DatasetProfileState = { status: 'idle', profile: null, error: null }
const ANALYZING: DatasetProfileState = {
    status: 'analyzing',
    profile: null,
    error: null,
}

/**
 * Fetches the data quality profile of the loaded spreadsheet.
 * `version` identifies the loaded data (null when nothing is loaded). When it
 * changes, the profile of the previous data is never shown, and a reply that
 * arrives late for old data is ignored.
 */
export function useDatasetProfile(
    getProfile: () => Promise<DatasetProfile>,
    version: object | null,
): DatasetProfileState {
    const [outcome, setOutcome] = useState<Outcome | null>(null)

    useEffect(() => {
        if (version === null) return
        let cancelled = false
        getProfile().then(
            (profile) => {
                if (cancelled) return
                setOutcome({ version, profile, error: null })
            },
            (error: unknown) => {
                if (cancelled) return
                setOutcome({
                    version,
                    profile: null,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'The data quality analysis could not be completed.',
                })
            },
        )
        return () => {
            cancelled = true
        }
    }, [getProfile, version])

    if (version === null) return IDLE
    if (outcome === null || outcome.version !== version) return ANALYZING
    if (outcome.error !== null) {
        return { status: 'error', profile: null, error: outcome.error }
    }
    return { status: 'ready', profile: outcome.profile, error: null }
}