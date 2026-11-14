import { Table2 } from 'lucide-react'

import type { DatasetSummary } from '@/workers/protocol'

interface PreviewPanelProps {
    summary: DatasetSummary | null
}

export function PreviewPanel({ summary }: PreviewPanelProps) {
    return (
        <section
            aria-label="Spreadsheet preview"
            className="flex min-h-[24rem] flex-col rounded-lg border bg-card p-4 text-card-foreground"
        >
            <h2 className="text-sm font-semibold text-foreground">
                Spreadsheet preview
            </h2>

            {summary === null ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <Table2
                        className="size-10 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <p className="mt-3 font-medium text-foreground">
                        No spreadsheet loaded
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Upload an XLSX or CSV file from the Dashboard. Your data will appear
                        here, 100 rows at a time.
                    </p>
                </div>
            ) : (
                <div className="mt-3">
                    <p className="break-all text-sm font-medium text-foreground">
                        {summary.sheetName === null
                            ? summary.source.name
                            : `${summary.source.name} · ${summary.sheetName}`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {`${summary.rowCount.toLocaleString('en-US')} data rows × ${summary.columns.length} columns`}
                    </p>
                    <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Columns
                    </h3>
                    <ol className="mt-2 flex flex-wrap gap-2">
                        {summary.columns.map((column, index) => (
                            <li
                                key={column.id}
                                className="rounded-md border bg-muted/40 px-2 py-1 text-xs text-foreground"
                            >
                                <span className="text-muted-foreground">{`${index + 1}. `}</span>
                                {column.name}
                            </li>
                        ))}
                    </ol>
                    <p className="mt-4 text-sm text-muted-foreground">
                        The data table with pagination is added in the next step.
                    </p>
                </div>
            )}
        </section>
    )
}