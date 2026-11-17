import { Table2 } from 'lucide-react'

import { DataTable } from '@/components/workspace/DataTable'
import { Pagination } from '@/components/workspace/Pagination'
import { PAGE_SIZE, usePagedRows } from '@/hooks/usePagedRows'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import type { DatasetSummary } from '@/workers/protocol'

interface LoadedPreviewProps {
    summary: DatasetSummary
    getPage: SpreadsheetSession['getPage']
}

function LoadedPreview({ summary, getPage }: LoadedPreviewProps) {
    const paged = usePagedRows(getPage, summary, summary.rowCount)

    return (
        <div className="mt-3 flex flex-col gap-3">
            <div>
                <p className="break-all text-sm font-medium text-foreground">
                    {summary.sheetName === null
                        ? summary.source.name
                        : `${summary.source.name} · ${summary.sheetName}`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {`${summary.rowCount.toLocaleString('en-US')} data rows × ${summary.columns.length} columns`}
                </p>
            </div>

            {paged.error !== null ? (
                <p role="alert" className="text-sm text-destructive">
                    {`${paged.error} If this keeps happening, remove the file and upload it again.`}
                </p>
            ) : (
                <>
                    <DataTable columns={summary.columns} rows={paged.rows} />
                    {summary.rowCount === 0 && (
                        <p className="text-sm text-muted-foreground">
                            This spreadsheet has no data rows, only a header row.
                        </p>
                    )}
                    {paged.loading && (
                        <p role="status" className="text-xs text-muted-foreground">
                            Loading rows…
                        </p>
                    )}
                    <Pagination
                        pageIndex={paged.pageIndex}
                        pageCount={paged.pageCount}
                        rowCount={summary.rowCount}
                        pageSize={PAGE_SIZE}
                        onPageChange={paged.goToPage}
                    />
                    <p className="text-xs text-muted-foreground">
                        The Row column shows each row&apos;s number in your original file.
                        Numbers appear as stored, without Excel&apos;s number formatting.
                    </p>
                </>
            )}
        </div>
    )
}

interface PreviewPanelProps {
    session: SpreadsheetSession
}

export function PreviewPanel({ session }: PreviewPanelProps) {
    const { summary, getPage } = session

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
                <LoadedPreview summary={summary} getPage={getPage} />
            )}
        </section>
    )
}