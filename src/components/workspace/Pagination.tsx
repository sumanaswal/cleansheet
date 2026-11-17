import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface PaginationProps {
    /** Zero-based index of the page being shown. */
    pageIndex: number
    pageCount: number
    rowCount: number
    pageSize: number
    onPageChange: (pageIndex: number) => void
}

function format(value: number): string {
    return value.toLocaleString('en-US')
}

export function Pagination({
    pageIndex,
    pageCount,
    rowCount,
    pageSize,
    onPageChange,
}: PaginationProps) {
    const first = pageIndex * pageSize + 1
    const last = Math.min(rowCount, (pageIndex + 1) * pageSize)
    const atStart = pageIndex <= 0
    const atEnd = pageIndex >= pageCount - 1

    return (
        <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-2"
        >
            <p className="text-sm text-muted-foreground">
                {rowCount === 0
                    ? 'No data rows'
                    : `Data rows ${format(first)}–${format(last)} of ${format(rowCount)}`}
            </p>
            {pageCount > 1 && (
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="First page"
                        disabled={atStart}
                        onClick={() => onPageChange(0)}
                    >
                        <ChevronsLeft aria-hidden="true" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="Previous page"
                        disabled={atStart}
                        onClick={() => onPageChange(pageIndex - 1)}
                    >
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <span className="px-2 text-sm text-foreground">
                        {`Page ${format(pageIndex + 1)} of ${format(pageCount)}`}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="Next page"
                        disabled={atEnd}
                        onClick={() => onPageChange(pageIndex + 1)}
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="Last page"
                        disabled={atEnd}
                        onClick={() => onPageChange(pageCount - 1)}
                    >
                        <ChevronsRight aria-hidden="true" />
                    </Button>
                </div>
            )}
        </nav>
    )
}