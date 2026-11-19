import { displayCell, type CellKind } from '@/components/workspace/cellDisplay'
import { cn } from '@/lib/utils'
import type { Column, Row } from '@/engine/types'
import type { RowMark } from '@/workers/protocol'

interface DataTableProps {
    columns: readonly Column[]
    rows: readonly Row[]
    /** How each row is marked while an operation is being previewed. One entry per row. */
    marks?: readonly (RowMark | null)[]
}

const KIND_CLASS: Record<CellKind, string> = {
    empty: 'bg-muted/50',
    blank: 'italic text-muted-foreground',
    text: '',
    number: 'text-right tabular-nums',
    boolean: '',
    date: '',
}

const MARK_LABEL: Record<RowMark, string> = { remove: 'Remove', keep: 'Keep' }
const ROW_CLASS: Record<RowMark, string> = {
    remove: 'bg-red-50',
    keep: 'bg-sky-50',
}
const HEADER_CLASS: Record<RowMark, string> = {
    remove: 'bg-red-100',
    keep: 'bg-sky-100',
}

export function DataTable({ columns, rows, marks }: DataTableProps) {
    return (
        <div
            role="region"
            aria-label="Spreadsheet data"
            tabIndex={0}
            className="max-h-[32rem] overflow-auto rounded-md border"
        >
            <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                    <tr>
                        <th
                            scope="col"
                            title="Row number in your original file"
                            className="sticky left-0 top-0 z-20 border-b border-r bg-muted px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                        >
                            Row
                        </th>
                        {columns.map((column) => (
                            <th
                                key={column.id}
                                scope="col"
                                title={column.name}
                                className="sticky top-0 z-10 max-w-[20rem] overflow-hidden text-ellipsis whitespace-nowrap border-b border-r bg-muted px-3 py-2 text-left font-medium text-foreground"
                            >
                                {column.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => {
                        const mark = marks?.[rowIndex] ?? null
                        return (
                            <tr key={row.sourceRow} className={mark === null ? '' : ROW_CLASS[mark]}>
                                <th
                                    scope="row"
                                    className={cn(
                                        'sticky left-0 z-10 border-b border-r px-3 py-1.5 text-right text-xs font-normal tabular-nums',
                                        mark === null
                                            ? 'bg-muted text-muted-foreground'
                                            : `${HEADER_CLASS[mark]} text-foreground`,
                                    )}
                                >
                                    {mark !== null && (
                                        <span className="text-[10px] font-semibold uppercase">
                                            {MARK_LABEL[mark]}
                                        </span>
                                    )}
                                    {mark !== null && ' '}
                                    {row.sourceRow}
                                </th>
                                {columns.map((column, index) => {
                                    const display = displayCell(row.cells[index])
                                    return (
                                        <td
                                            key={column.id}
                                            title={display.title}
                                            className={cn(
                                                'max-w-[20rem] overflow-hidden text-ellipsis whitespace-pre border-b border-r px-3 py-1.5 text-foreground',
                                                KIND_CLASS[display.kind],
                                            )}
                                        >
                                            {display.kind === 'empty' ? (
                                                <span className="sr-only">empty</span>
                                            ) : (
                                                display.text
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}