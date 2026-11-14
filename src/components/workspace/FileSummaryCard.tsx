import { Button } from '@/components/ui/button'
import { formatBytes } from '@/engine/io/validation'
import type { DatasetSummary } from '@/workers/protocol'

interface FileSummaryCardProps {
    summary: DatasetSummary
    busy: boolean
    onSelectSheet: (sheetName: string) => void
    onReset: () => void
    onOpenWorkspace: () => void
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
        </div>
    )
}

export function FileSummaryCard({
    summary,
    busy,
    onSelectSheet,
    onReset,
    onOpenWorkspace,
}: FileSummaryCardProps) {
    const { source, sheetName, sheetNames, warnings, columns, rowCount } = summary

    return (
        <section
            aria-label="Loaded spreadsheet"
            className="rounded-lg border bg-card p-4 text-card-foreground"
        >
            <h2 className="break-all text-lg font-semibold text-foreground">
                {source.name}
            </h2>

            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Fact label="File size" value={formatBytes(source.sizeBytes)} />
                <Fact label="Format" value={source.format.toUpperCase()} />
                <Fact label="Data rows" value={rowCount.toLocaleString('en-US')} />
                <Fact label="Columns" value={columns.length.toLocaleString('en-US')} />
            </dl>

            {sheetName !== null && sheetNames.length > 1 && (
                <div className="mt-4">
                    <label
                        htmlFor="worksheet-select"
                        className="block text-sm font-medium text-foreground"
                    >
                        Worksheet
                    </label>
                    <select
                        id="worksheet-select"
                        value={sheetName}
                        disabled={busy}
                        onChange={(event) => onSelectSheet(event.target.value)}
                        className="mt-1 w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                    >
                        {sheetNames.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                        CleanSheet cleans one worksheet at a time.
                    </p>
                </div>
            )}
            {sheetName !== null && sheetNames.length === 1 && (
                <p className="mt-3 text-sm text-muted-foreground">
                    {`Worksheet: ${sheetName}`}
                </p>
            )}

            <div className="mt-4">
                <h3 className="text-sm font-medium text-foreground">
                    Notes about this import
                </h3>
                {warnings.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                        The file was read without any adjustments.
                    </p>
                ) : (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {warnings.map((warning, index) => (
                            <li key={`${index}-${warning}`}>{warning}</li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={onOpenWorkspace}>
                    Open cleaning workspace
                </Button>
                <Button type="button" variant="outline" onClick={onReset}>
                    Remove file
                </Button>
                <p className="text-xs text-muted-foreground">
                    Removing the file discards the loaded data.
                </p>
            </div>
        </section>
    )
}