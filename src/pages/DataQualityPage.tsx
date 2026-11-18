import { ClipboardCheck } from 'lucide-react'

import type { ColumnType, DatasetProfile } from '@/engine/profiling/types'
import { useDatasetProfile } from '@/hooks/useDatasetProfile'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'

const TYPE_LABELS: Record<ColumnType, string> = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    boolean: 'Boolean',
    numberText: 'Number stored as text',
    dateText: 'Date stored as text',
    idText: 'ID-like text (leading zeros)',
    mixed: 'Mixed',
    empty: 'Empty',
}

interface Figure {
    readonly label: string
    readonly value: (profile: DatasetProfile) => number
}

const FIGURES: readonly Figure[] = [
    { label: 'Total rows', value: (p) => p.totalRows },
    { label: 'Total columns', value: (p) => p.totalColumns },
    { label: 'Duplicate rows', value: (p) => p.duplicateRows },
    { label: 'Missing cells', value: (p) => p.missingCells },
    { label: 'Empty rows', value: (p) => p.emptyRows },
    { label: 'Empty columns', value: (p) => p.emptyColumns },
]

const DEFINITIONS: readonly string[] = [
    'Missing cells are empty cells and cells holding only spaces. Zero, false and text such as N/A are not counted as missing.',
    'Duplicate rows are rows identical to an earlier row in every column. The match is exact: capital letters, spaces and number-versus-text all matter. Completely empty rows are counted as empty rows, not as duplicates.',
    'Possible placeholders, such as N/A, NULL and a lone dash, are listed for each column but are not counted as missing.',
    'A column is given a type when at least 90% of its values fit it. The other values are shown as exceptions. Dates stored as text are flagged, never interpreted.',
]

function format(value: number): string {
    return value.toLocaleString('en-US')
}

interface DataQualityPageProps {
    session: SpreadsheetSession
}

export function DataQualityPage({ session }: DataQualityPageProps) {
    const { summary } = session
    const { status, profile, error } = useDatasetProfile(
        session.getProfile,
        summary,
    )

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Data Quality
            </h1>
            <p className="mt-2 text-muted-foreground">
                A summary of problems found in your spreadsheet. The analysis only
                reads your data. Nothing is changed until you apply an operation.
            </p>

            <section
                aria-label="Data quality status"
                className="mt-6 flex flex-col items-center rounded-lg border bg-card px-6 py-8 text-center text-card-foreground"
            >
                <ClipboardCheck
                    className="size-10 text-muted-foreground"
                    aria-hidden="true"
                />
                {summary === null && (
                    <>
                        <p className="mt-3 font-medium text-foreground">
                            No spreadsheet loaded
                        </p>
                        <p className="mt-1 max-w-md text-sm text-muted-foreground">
                            Upload an XLSX or CSV file from the Dashboard to see its quality
                            summary here.
                        </p>
                    </>
                )}
                {summary !== null && status === 'analyzing' && (
                    <p role="status" className="mt-3 break-all font-medium text-foreground">
                        {`Analyzing ${summary.source.name}…`}
                    </p>
                )}
                {summary !== null && status === 'error' && (
                    <p role="alert" className="mt-3 max-w-xl text-sm text-destructive">
                        {`${error ?? 'The analysis could not be completed.'} If this keeps happening, remove the file and upload it again.`}
                    </p>
                )}
                {summary !== null && status === 'ready' && profile !== null && (
                    <>
                        <p className="mt-3 break-all font-medium text-foreground">
                            {summary.sheetName === null
                                ? summary.source.name
                                : `${summary.source.name} · ${summary.sheetName}`}
                        </p>
                        {profile.totalRows === 0 && (
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                This spreadsheet has no data rows, so every column counts as
                                empty.
                            </p>
                        )}
                    </>
                )}
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">Summary</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {FIGURES.map((figure) => (
                        <div key={figure.label} className="rounded-lg border bg-card p-4">
                            <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                                {profile === null ? '—' : format(figure.value(profile))}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {profile !== null && (
                <section className="mt-8">
                    <h2 className="text-lg font-semibold text-foreground">Columns</h2>
                    <div
                        role="region"
                        aria-label="Column quality table"
                        tabIndex={0}
                        className="mt-3 overflow-x-auto rounded-md border"
                    >
                        <table aria-label="Column quality" className="w-full text-sm">
                            <thead className="bg-muted text-left text-xs text-muted-foreground">
                                <tr>
                                    <th scope="col" className="px-3 py-2 text-right font-medium">
                                        #
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Column
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Detected type
                                    </th>
                                    <th scope="col" className="px-3 py-2 text-right font-medium">
                                        Missing
                                    </th>
                                    <th scope="col" className="px-3 py-2 text-right font-medium">
                                        Possible placeholders
                                    </th>
                                    <th scope="col" className="px-3 py-2 text-right font-medium">
                                        Exceptions
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {profile.columns.map((column) => (
                                    <tr key={column.id} className="border-t">
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                            {column.position}
                                        </td>
                                        <th
                                            scope="row"
                                            className="max-w-[16rem] break-words px-3 py-2 text-left font-medium text-foreground"
                                        >
                                            {column.name}
                                        </th>
                                        <td className="px-3 py-2 text-foreground">
                                            {TYPE_LABELS[column.type]}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {format(column.missingCount)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {format(column.placeholderCount)}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {format(column.exceptionCount)}
                                        </td>
                                        <td className="px-3 py-2">
                                            {column.hasIssues ? (
                                                <span className="font-medium text-foreground">
                                                    Worth checking
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                    How these are counted
                </h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {DEFINITIONS.map((definition) => (
                        <li key={definition}>{definition}</li>
                    ))}
                </ul>
            </section>
        </div>
    )
}