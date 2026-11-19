import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { PreviewList } from '@/components/workspace/PreviewList'
import type { DuplicateOptions } from '@/engine/operations/duplicates'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import type {
    AppliedResult,
    DatasetSummary,
    OperationPreviewSummary,
    OperationSpec,
} from '@/workers/protocol'

type Scope = 'all' | 'selected'

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const ignore = (): void => undefined

function format(value: number): string {
    return value.toLocaleString('en-US')
}

function describeResult(result: AppliedResult): string {
    if (result.removedRows === 0) {
        return 'No duplicate rows were found, so nothing was changed.'
    }
    const removed = `${format(result.removedRows)} duplicate ${result.removedRows === 1 ? 'row' : 'rows'}`
    const left = result.summary.rowCount
    return `Removed ${removed}. ${format(left)} ${left === 1 ? 'row remains' : 'rows remain'}.`
}

interface DuplicatesPanelProps {
    session: SpreadsheetSession
    summary: DatasetSummary
    onClose: () => void
    /** Called whenever the preview in the worker is created, changed or discarded. */
    onPreviewChange: () => void
}

export function DuplicatesPanel({
    session,
    summary,
    onClose,
    onPreviewChange,
}: DuplicatesPanelProps) {
    const { previewOperation, getPreviewPage, clearPreview, applyOperation } = session
    const uid = useId()

    const [scope, setScope] = useState<Scope>('all')
    const [selected, setSelected] = useState<readonly string[]>([])
    const [keep, setKeep] = useState<'first' | 'last'>('first')
    const [caseInsensitive, setCaseInsensitive] = useState(false)
    const [normalizeSpaces, setNormalizeSpaces] = useState(false)

    // Each result remembers the data it was made for, so it is not shown once
    // a different file or worksheet is loaded.
    const [preview, setPreview] = useState<{
        result: OperationPreviewSummary
        data: DatasetSummary
    } | null>(null)
    const [outcome, setOutcome] = useState<{
        message: string
        data: DatasetSummary
    } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // Used to ignore an answer that arrives after the user moved on.
    const requestRef = useRef(0)
    // Whether the worker currently holds a preview that this panel made.
    const previewActiveRef = useRef(false)

    // When the panel closes, throw away the preview so no highlight is left over.
    useEffect(() => {
        return () => {
            requestRef.current += 1
            if (previewActiveRef.current) {
                previewActiveRef.current = false
                clearPreview().catch(ignore)
            }
        }
    }, [clearPreview])

    const validIds = new Set(summary.columns.map((column) => column.id))
    const chosen = selected.filter((id) => validIds.has(id))
    const options: DuplicateOptions = {
        columnIds: scope === 'all' ? null : chosen,
        keep,
        caseInsensitive,
        normalizeSpaces,
    }
    const operation: OperationSpec = { kind: 'duplicates', options }
    const canRun = scope === 'all' || chosen.length > 0

    const activePreview =
        preview !== null && preview.data === summary ? preview.result : null
    const activeOutcome =
        outcome !== null && outcome.data === summary ? outcome.message : null

    function discardPreview(): void {
        if (!previewActiveRef.current) return
        previewActiveRef.current = false
        clearPreview().catch(ignore)
        onPreviewChange()
    }

    /** Any change to the settings makes the preview out of date. */
    function settingsChanged(): void {
        requestRef.current += 1
        setPreview(null)
        setOutcome(null)
        setError(null)
        discardPreview()
    }

    function toggleColumn(id: string): void {
        settingsChanged()
        setSelected((previous) =>
            previous.includes(id)
                ? previous.filter((other) => other !== id)
                : [...previous, id],
        )
    }

    async function handlePreview(): Promise<void> {
        requestRef.current += 1
        const request = requestRef.current
        setBusy(true)
        setError(null)
        setOutcome(null)
        setPreview(null)
        try {
            const result = await previewOperation(operation)
            if (requestRef.current !== request) {
                // The user moved on while this was calculated: discard the result.
                clearPreview().catch(ignore)
                return
            }
            previewActiveRef.current = true
            setPreview({ result, data: summary })
            onPreviewChange()
        } catch (caught) {
            if (requestRef.current !== request) return
            previewActiveRef.current = false
            setError(caught instanceof Error ? caught.message : GENERIC_ERROR)
            onPreviewChange()
        } finally {
            if (requestRef.current === request) setBusy(false)
        }
    }

    async function handleApply(): Promise<void> {
        requestRef.current += 1
        const request = requestRef.current
        setBusy(true)
        setError(null)
        try {
            const result = await applyOperation(operation)
            // Applying always discards the worker's preview.
            previewActiveRef.current = false
            if (requestRef.current !== request) return
            setPreview(null)
            setOutcome({ message: describeResult(result), data: result.summary })
            onPreviewChange()
        } catch (caught) {
            previewActiveRef.current = false
            if (requestRef.current !== request) return
            setPreview(null)
            setError(caught instanceof Error ? caught.message : GENERIC_ERROR)
            onPreviewChange()
        } finally {
            if (requestRef.current === request) setBusy(false)
        }
    }

    function handleCancel(): void {
        requestRef.current += 1
        discardPreview()
        onClose()
    }

    return (
        <div className="mt-3 space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-foreground">Remove duplicates</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Finds repeated rows and removes all but one copy. Nothing changes
                    until you press Apply.
                </p>
            </div>

            <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
                <fieldset className="min-w-0 space-y-2 border-0 p-0">
                    <legend className="text-sm font-medium text-foreground">
                        Which rows count as duplicates?
                    </legend>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="radio"
                            name={`${uid}-scope`}
                            className="mt-0.5"
                            checked={scope === 'all'}
                            onChange={() => {
                                settingsChanged()
                                setScope('all')
                            }}
                        />
                        <span>All columns (the whole row must match)</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="radio"
                            name={`${uid}-scope`}
                            className="mt-0.5"
                            checked={scope === 'selected'}
                            onChange={() => {
                                settingsChanged()
                                setScope('selected')
                            }}
                        />
                        <span>Selected columns (only the chosen columns must match)</span>
                    </label>

                    {scope === 'selected' && (
                        <div role="group" aria-label="Columns to compare" className="pt-1">
                            <div className="flex gap-3 text-xs">
                                <button
                                    type="button"
                                    className="underline"
                                    onClick={() => {
                                        settingsChanged()
                                        setSelected(summary.columns.map((column) => column.id))
                                    }}
                                >
                                    Select all
                                </button>
                                <button
                                    type="button"
                                    className="underline"
                                    onClick={() => {
                                        settingsChanged()
                                        setSelected([])
                                    }}
                                >
                                    Clear selection
                                </button>
                            </div>
                            <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                                {summary.columns.map((column, index) => (
                                    <label
                                        key={column.id}
                                        className="flex items-start gap-2 text-sm text-foreground"
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-0.5"
                                            checked={chosen.includes(column.id)}
                                            onChange={() => toggleColumn(column.id)}
                                        />
                                        <span className="break-all">{`${index + 1}. ${column.name}`}</span>
                                    </label>
                                ))}
                            </div>
                            {chosen.length === 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Choose at least one column.
                                </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                                Rows with a missing value in any chosen column are never
                                compared, so two blank values are not treated as a match.
                            </p>
                        </div>
                    )}
                </fieldset>

                <fieldset className="min-w-0 space-y-2 border-0 p-0">
                    <legend className="text-sm font-medium text-foreground">
                        Which copy stays?
                    </legend>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="radio"
                            name={`${uid}-keep`}
                            className="mt-0.5"
                            checked={keep === 'first'}
                            onChange={() => {
                                settingsChanged()
                                setKeep('first')
                            }}
                        />
                        <span>Keep the first occurrence</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="radio"
                            name={`${uid}-keep`}
                            className="mt-0.5"
                            checked={keep === 'last'}
                            onChange={() => {
                                settingsChanged()
                                setKeep('last')
                            }}
                        />
                        <span>Keep the last occurrence</span>
                    </label>
                </fieldset>

                <fieldset className="min-w-0 space-y-2 border-0 p-0">
                    <legend className="text-sm font-medium text-foreground">Matching</legend>
                    <p className="text-xs text-muted-foreground">
                        By default, values must match exactly, including capital letters
                        and spaces. Numbers are never changed.
                    </p>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={caseInsensitive}
                            onChange={() => {
                                settingsChanged()
                                setCaseInsensitive((value) => !value)
                            }}
                        />
                        <span>Ignore capital and small letters</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={normalizeSpaces}
                            onChange={() => {
                                settingsChanged()
                                setNormalizeSpaces((value) => !value)
                            }}
                        />
                        <span>Ignore extra spaces (at the ends and repeated)</span>
                    </label>
                </fieldset>
            </fieldset>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !canRun}
                    onClick={() => {
                        void handlePreview()
                    }}
                >
                    Preview
                </Button>
                <Button
                    type="button"
                    disabled={busy || activePreview === null || activePreview.removedRows === 0}
                    onClick={() => {
                        void handleApply()
                    }}
                >
                    Apply
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancel}>
                    Cancel
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Apply cannot be undone yet. Undo is added in a later phase. Until
                then, the only way to start over is to upload the file again.
            </p>

            {busy && (
                <p role="status" className="text-xs text-foreground">
                    Working…
                </p>
            )}
            {error !== null && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {activeOutcome !== null && (
                <p role="status" className="text-sm font-medium text-foreground">
                    {activeOutcome}
                </p>
            )}

            {activePreview !== null && (
                <section aria-label="Preview" className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Preview</h4>
                    <dl className="grid grid-cols-2 gap-2">
                        <div>
                            <dt className="text-xs text-muted-foreground">Rows now</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">
                                {format(activePreview.totalRows)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Will be removed</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">
                                {format(activePreview.removedRows)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Will stay</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">
                                {format(activePreview.retainedRows)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Not compared</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">
                                {format(activePreview.skippedRows)}
                            </dd>
                        </div>
                    </dl>
                    {activePreview.skippedRows > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {scope === 'all'
                                ? 'Completely empty rows are not compared and always stay.'
                                : 'Rows with a missing value in a chosen column are not compared and always stay.'}
                        </p>
                    )}
                    {activePreview.removedRows === 0 ? (
                        <p className="text-sm text-foreground">
                            No duplicate rows were found with these settings.
                        </p>
                    ) : (
                        <>
                            <PreviewList
                                getPreviewPage={getPreviewPage}
                                version={activePreview}
                                itemCount={activePreview.itemCount}
                            />
                            <p className="text-xs text-muted-foreground">
                                Rows on the current page of the table are highlighted: Remove
                                for rows that go, Keep for the copy that stays.
                            </p>
                        </>
                    )}
                </section>
            )}
        </div>
    )
}