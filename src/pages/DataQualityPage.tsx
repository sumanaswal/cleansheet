import { ClipboardCheck } from 'lucide-react'

const METRICS = [
    'Total rows',
    'Total columns',
    'Duplicate rows',
    'Missing cells',
    'Empty rows',
    'Empty columns',
] as const

export function DataQualityPage() {
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
                className="mt-6 flex flex-col items-center rounded-lg border bg-card px-6 py-10 text-center text-card-foreground"
            >
                <ClipboardCheck
                    className="size-10 text-muted-foreground"
                    aria-hidden="true"
                />
                <p className="mt-3 font-medium text-foreground">
                    No spreadsheet loaded
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Upload an XLSX or CSV file from the Dashboard to see its quality
                    summary here.
                </p>
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                    What this page will show
                </h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {METRICS.map((label) => (
                        <div key={label} className="rounded-lg border bg-card p-4">
                            <dt className="text-sm text-muted-foreground">{label}</dt>
                            <dd className="mt-1 text-2xl font-semibold text-foreground">
                                —
                            </dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 text-sm text-muted-foreground">
                    It will also list each column&apos;s name and detected data type, so
                    you can see which columns have potential problems.
                </p>
            </section>
        </div>
    )
}