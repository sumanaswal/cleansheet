import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { PreviewList } from '@/components/workspace/PreviewList'
import type {
    MissingAction,
    MissingOptions,
} from '@/engine/operations/missingValues'
import { PLACEHOLDER_WORDS } from '@/engine/profiling/missing'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import type {
    AppliedResult,
    DatasetSummary,
    OperationPreviewSummary,
    OperationSpec,
} from '@/workers/protocol'

type Mode = 'fill' | 'removeRows'

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const ignore = (): void => undefined

function format(value: number): string {
    return value.toLocaleString('en-US')
}

function describeResult(result: AppliedResult): string {
    if (result.filledCells > 0) {
        const n = result.filledCells
        return `Filled ${format(n)} ${n === 1 ? 'cell' : 'cells'}.`
    }
    if (result.removedRows > 0) {
        const n = result.removedRows
        const left = result.summary.rowCount
        return `Removed ${format(n)} ${n === 1 ? 'row' : 'rows'}. ${format(left)} ${left === 1 ? 'row remains' : 'rows remain'}.`
    }
    return 'No missing values were found, so nothing was changed.'
}

interface MissingPanelProps {
    session: SpreadsheetSession
    summary: DatasetSummary
    onClose: () => void
    /** Called whenever the preview in the worker is created, changed or discarded. */
    onPreviewChange: () => void
}

export function MissingPanel({
    session,
    summary,
    onClose,
    onPreviewChange,
}: MissingPanelProps) {
    const { previewOperation, getPreviewPage, clearPreview, applyOperation } = session
    const uid = useId()

    const [mode, setMode] = useState<Mode>('fill')
    const [fillValue, setFillValue] = useState('')
    const [when, setWhen] = useState<'any' | 'all'>('any')
    // Every column starts chosen. Unticking one adds it here, which ignores it.
    const [ignored, setIgnored] = useState<readonly string[]>([])
    const [words, setWords] = useState<readonly string[]>([])
    const [custom, setCustom] = useState('')

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

    const chosen = summary.columns
        .filter((column) => !ignored.includes(column.id))
        .map((column) => column.id)
    const customWords = custom
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '')
    const action: MissingAction =
        mode === 'fill'
            ? { kind: 'fill', value: fillValue }
            : { kind: 'removeRows', when }
    const options: MissingOptions = {
        columnIds: chosen,
        placeholders: [...words, ...customWords],
        action,
    }
    const operation: OperationSpec = { kind: 'missing', options }
    const needsValue = mode === 'fill' && fillValue.trim() === ''
    const canRun = chosen.length > 0 && !needsValue

    const activePreview =
        preview !== null && preview.data === summary ? preview.result : null
    const activeOutcome =
        outcome !== null && outcome.data === summary ? outcome.message : null
    const details = activePreview?.missing

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
        setIgnored((previous) =>
            previous.includes(id)
                ? previous.filter((other) => other !== id)
                : [...previous, id],
        )
    }

    function toggleWord(word: string): void {
        settingsChanged()
        setWords((previous) =>
            previous.includes(word)
                ? previous.filter((other) => other !== word)
                : [...previous, word],
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
                <h3 className="text-sm font-semibold text-foreground">Missing values</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Empty cells and cells with only spaces are always treated as missing.
                    Zero, false and other numbers never are. Nothing changes until you
                    press Apply.
                </p>
            </div>

            <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
                <fieldset className="min-w-0 space-y-2 border-0 p-0">
                    <legend className="text-sm font-medium text-foreground">
                        What should happen to them?
                    </legend>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="radio"
                            name={`${uid}-mode`}
                            className="mt-0.5"
                            checked={mode === 'fill'}
                            onChange={() => {
                                settingsChanged()
                                setMode('fill')
                            }}
                        />
                        <span>Fill missing values</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="radio"
                            name={`${uid}-mode`}
                            className="mt-0.5"
                            checked={mode === 'removeRows'}
                            onChange={() => {
                                settingsChanged()
                                setMode('removeRows')
                            }}
                        />
                        <span>Remove rows with missing values</span>
                    </label>
                </fieldset>

                {mode === 'fill' ? (
                    <div>
                        <label
                            htmlFor={`${uid}-value`}
                            className="block text-sm font-medium text-foreground"
                        >
                            Value to insert
                        </label>
                        <input
                            id={`${uid}-value`}
                            type="text"
                            value={fillValue}
                            onChange={(event) => {
                                settingsChanged()
                                setFillValue(event.target.value)
                            }}
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            It goes in as text. Only a plain number such as 0 goes into a
                            column that holds nothing but numbers as a number.
                        </p>
                        {needsValue && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Type the value to insert.
                            </p>
                        )}
                    </div>
                ) : (
                    <fieldset className="min-w-0 space-y-2 border-0 p-0">
                        <legend className="text-sm font-medium text-foreground">
                            Which rows go?
                        </legend>
                        <label className="flex items-start gap-2 text-sm text-foreground">
                            <input
                                type="radio"
                                name={`${uid}-when`}
                                className="mt-0.5"
                                checked={when === 'any'}
                                onChange={() => {
                                    settingsChanged()
                                    setWhen('any')
                                }}
                            />
                            <span>Remove a row if any chosen column is missing</span>
                        </label>
                        <label className="flex items-start gap-2 text-sm text-foreground">
                            <input
                                type="radio"
                                name={`${uid}-when`}
                                className="mt-0.5"
                                checked={when === 'all'}
                                onChange={() => {
                                    settingsChanged()
                                    setWhen('all')
                                }}
                            />
                            <span>Remove a row only if all chosen columns are missing</span>
                        </label>
                    </fieldset>
                )}

                <div role="group" aria-label="Columns to look at">
                    <p className="text-sm font-medium text-foreground">Columns</p>
                    <p className="text-xs text-muted-foreground">
                        Untick a column to ignore it.
                    </p>
                    <div className="mt-1 flex gap-3 text-xs">
                        <button
                            type="button"
                            className="underline"
                            onClick={() => {
                                settingsChanged()
                                setIgnored([])
                            }}
                        >
                            Select all
                        </button>
                        <button
                            type="button"
                            className="underline"
                            onClick={() => {
                                settingsChanged()
                                setIgnored(summary.columns.map((column) => column.id))
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
                                    checked={!ignored.includes(column.id)}
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
                </div>

                <fieldset className="min-w-0 space-y-2 border-0 p-0">
                    <legend className="text-sm font-medium text-foreground">
                        Also treat as missing
                    </legend>
                    <p className="text-xs text-muted-foreground">
                        Words like these are only treated as missing if you tick them,
                        because they can be real data.
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                        {PLACEHOLDER_WORDS.map((word) => (
                            <label
                                key={word}
                                className="flex items-center gap-2 text-sm text-foreground"
                            >
                                <input
                                    type="checkbox"
                                    checked={words.includes(word)}
                                    onChange={() => toggleWord(word)}
                                />
                                <span className="font-mono">{word}</span>
                            </label>
                        ))}
                    </div>
                    <div>
                        <label
                            htmlFor={`${uid}-custom`}
                            className="block text-sm text-foreground"
                        >
                            Other placeholders (one per line)
                        </label>
                        <textarea
                            id={`${uid}-custom`}
                            rows={3}
                            value={custom}
                            onChange={(event) => {
                                settingsChanged()
                                setCustom(event.target.value)
                            }}
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Capital letters and spaces around the words are ignored. Numbers
                            and true/false cannot be placeholders.
                        </p>
                    </div>
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
                    disabled={busy || activePreview === null || activePreview.itemCount === 0}
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

            {activePreview !== null && details !== undefined && (
                <section aria-label="Preview" className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Preview</h4>
                    <dl className="grid grid-cols-2 gap-2">
                        {details.action === 'fill' ? (
                            <>
                                <div>
                                    <dt className="text-xs text-muted-foreground">Cells to fill</dt>
                                    <dd className="text-sm font-medium tabular-nums text-foreground">
                                        {format(details.filledCells)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Missing cells found
                                    </dt>
                                    <dd className="text-sm font-medium tabular-nums text-foreground">
                                        {format(details.missingCells)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Placeholder cells
                                    </dt>
                                    <dd className="text-sm font-medium tabular-nums text-foreground">
                                        {format(details.placeholderCells)}
                                    </dd>
                                </div>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </dl>

                    {details.action === 'fill' && details.fillValue !== null && (
                        <p className="break-all text-xs text-foreground">
                            {`Inserted value: ${details.fillValue}`}
                        </p>
                    )}
                    {details.columns
                        .filter((column) => column.dateColumn)
                        .map((column) => (
                            <p key={column.columnId} className="text-xs text-foreground">
                                {`Column ${column.position} (${column.name}) holds Excel dates. The value is inserted as text, not as a real date.`}
                            </p>
                        ))}

                    <div
                        role="region"
                        aria-label="Preview by column table"
                        tabIndex={0}
                        className="overflow-x-auto rounded-md border"
                    >
                        <table aria-label="Preview by column" className="w-full text-xs">
                            <thead className="bg-muted text-left text-muted-foreground">
                                <tr>
                                    <th scope="col" className="px-2 py-1 font-medium">
                                        Column
                                    </th>
                                    <th scope="col" className="px-2 py-1 text-right font-medium">
                                        Missing
                                    </th>
                                    <th scope="col" className="px-2 py-1 text-right font-medium">
                                        Placeholders
                                    </th>
                                    <th scope="col" className="px-2 py-1 text-right font-medium">
                                        {details.action === 'fill' ? 'Will be filled' : 'Rows removed'}
                                    </th>
                                    {details.action === 'fill' && (
                                        <th scope="col" className="px-2 py-1 font-medium">
                                            Inserted as
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {details.columns.map((column) => (
                                    <tr key={column.columnId} className="border-t">
                                        <th
                                            scope="row"
                                            className="break-words px-2 py-1 text-left font-medium text-foreground"
                                        >
                                            {`${column.position}. ${column.name}`}
                                        </th>
                                        <td className="px-2 py-1 text-right tabular-nums">
                                            {format(column.missingCount)}
                                        </td>
                                        <td className="px-2 py-1 text-right tabular-nums">
                                            {format(column.placeholderCount)}
                                        </td>
                                        <td className="px-2 py-1 text-right tabular-nums">
                                            {format(column.affectedCount)}
                                        </td>
                                        {details.action === 'fill' && (
                                            <td className="px-2 py-1">
                                                {column.insertAs === 'number' ? 'Number' : 'Text'}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {activePreview.itemCount === 0 ? (
                        <p className="text-sm text-foreground">
                            No missing values were found with these settings.
                        </p>
                    ) : (
                        <>
                            <PreviewList
                                getPreviewPage={getPreviewPage}
                                version={activePreview}
                                itemCount={activePreview.itemCount}
                                heading={
                                    details.action === 'fill'
                                        ? 'Cells that will be filled'
                                        : 'Rows that will be removed'
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {details.action === 'fill'
                                    ? 'Cells on the current page of the table are highlighted and marked Fill.'
                                    : 'Rows on the current page of the table are highlighted and marked Remove.'}
                            </p>
                        </>
                    )}
                </section>
            )}
        </div>
    )
}