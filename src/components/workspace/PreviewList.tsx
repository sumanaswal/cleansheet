import { Button } from '@/components/ui/button'
import { displayCell } from '@/components/workspace/cellDisplay'
import { PREVIEW_PAGE_SIZE, usePreviewItems } from '@/hooks/usePreviewItems'
import type { CellValue } from '@/engine/types'
import type { PreviewPage } from '@/workers/importClient'

interface PreviewListProps {
    getPreviewPage: (offset: number, limit: number) => Promise<PreviewPage>
    /** Identifies the preview. When it changes, the list starts again at the first record. */
    version: object
    itemCount: number
}

/** The first few values of a row, on one line. */
function summarizeRow(cells: readonly CellValue[]): string {
    const parts: string[] = []
    for (const cell of cells) {
        const display = displayCell(cell)
        if (display.kind === 'empty') continue
        parts.push(display.text)
        if (parts.length === 6) break
    }
    return parts.length === 0 ? '(no values)' : parts.join(' | ')
}

function format(value: number): string {
    return value.toLocaleString('en-US')
}

export function PreviewList({ getPreviewPage, version, itemCount }: PreviewListProps) {
    const paged = usePreviewItems(getPreviewPage, version, itemCount)
    const first = paged.pageIndex * PREVIEW_PAGE_SIZE + 1
    const last = Math.min(itemCount, (paged.pageIndex + 1) * PREVIEW_PAGE_SIZE)

    return (
        <div>
            <h5 className="text-xs font-medium text-foreground">
                Rows that will be removed
            </h5>
            {paged.error !== null ? (
                <p role="alert" className="mt-1 text-xs text-destructive">
                    {paged.error}
                </p>
            ) : (
                <ul className="mt-1 divide-y rounded-md border">
                    {paged.items.map((item) => (
                        <li key={item.row.sourceRow} className="px-2 py-1.5">
                            <p className="text-xs">
                                <span className="font-medium text-foreground">
                                    {`Row ${item.row.sourceRow}`}
                                </span>
                                <span className="text-muted-foreground">
                                    {` · same as row ${item.keptSourceRow} (stays)`}
                                </span>
                            </p>
                            <p
                                className="mt-0.5 truncate text-xs text-muted-foreground"
                                title={summarizeRow(item.row.cells)}
                            >
                                {summarizeRow(item.row.cells)}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
            {paged.loading && (
                <p className="mt-1 text-xs text-muted-foreground">Loading records…</p>
            )}
            {itemCount > 0 && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                        {`Records ${format(first)}–${format(last)} of ${format(itemCount)}`}
                    </p>
                    {paged.pageCount > 1 && (
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={paged.pageIndex <= 0}
                                onClick={() => paged.goToPage(paged.pageIndex - 1)}
                            >
                                Previous records
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={paged.pageIndex >= paged.pageCount - 1}
                                onClick={() => paged.goToPage(paged.pageIndex + 1)}
                            >
                                Next records
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}