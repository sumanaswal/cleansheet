import { Button } from '@/components/ui/button'
import { displayCell } from '@/components/workspace/cellDisplay'
import { showInvisible } from '@/components/workspace/visibleText'
import { PREVIEW_PAGE_SIZE, usePreviewItems } from '@/hooks/usePreviewItems'
import type { CellValue } from '@/engine/types'
import type { PreviewPage } from '@/workers/importClient'
import type { PreviewItem } from '@/workers/protocol'

interface PreviewListProps {
    getPreviewPage: (offset: number, limit: number) => Promise<PreviewPage>
    /** Identifies the preview. When it changes, the list starts again at the first record. */
    version: object
    itemCount: number
    /** What the records are. */
    heading?: string
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

function describeValue(value: CellValue): string {
    const display = displayCell(value)
    return display.kind === 'empty' ? '(empty)' : display.text
}

function describeItem(item: PreviewItem): { detail: string; summary: string } {
    switch (item.kind) {
        case 'removedRow':
            return {
                detail: ` · same as row ${item.keptSourceRow} (stays)`,
                summary: summarizeRow(item.row.cells),
            }
        case 'filledCell':
            return {
                detail: ` · column ${item.columnPosition}: ${item.columnName}`,
                summary: `${describeValue(item.oldValue)} → ${describeValue(item.newValue)}`,
            }
        case 'removedMissingRow':
            return {
                detail: ` · missing in: ${item.missingColumns.map((column) => column.name).join(', ')}`,
                summary: summarizeRow(item.row.cells),
            }
        case 'changedText':
            return {
                detail: ` · column ${item.columnPosition}: ${item.columnName}`,
                summary: `${showInvisible(item.oldText)} → ${item.newText === null ? '(empty)' : showInvisible(item.newText)
                    }`,
            }
    }
}

function itemKey(item: PreviewItem): string {
    return item.kind === 'filledCell' || item.kind === 'changedText'
        ? `${item.row.sourceRow}:${item.columnPosition}`
        : `${item.row.sourceRow}`
}

function format(value: number): string {
    return value.toLocaleString('en-US')
}

export function PreviewList({
    getPreviewPage,
    version,
    itemCount,
    heading = 'Rows that will be removed',
}: PreviewListProps) {
    const paged = usePreviewItems(getPreviewPage, version, itemCount)
    const first = paged.pageIndex * PREVIEW_PAGE_SIZE + 1
    const last = Math.min(itemCount, (paged.pageIndex + 1) * PREVIEW_PAGE_SIZE)

    return (
        <div>
            <h5 className="text-xs font-medium text-foreground">{heading}</h5>
            {paged.error !== null ? (
                <p role="alert" className="mt-1 text-xs text-destructive">
                    {paged.error}
                </p>
            ) : (
                <ul className="mt-1 divide-y rounded-md border">
                    {paged.items.map((item) => {
                        const { detail, summary } = describeItem(item)
                        return (
                            <li key={itemKey(item)} className="px-2 py-1.5">
                                <p className="text-xs">
                                    <span className="font-medium text-foreground">
                                        {`Row ${item.row.sourceRow}`}
                                    </span>
                                    <span className="text-muted-foreground">{detail}</span>
                                </p>
                                <p
                                    className="mt-0.5 truncate text-xs text-muted-foreground"
                                    title={summary}
                                >
                                    {summary}
                                </p>
                            </li>
                        )
                    })}
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