import {
    CalendarDays,
    Columns3,
    Copy,
    Eraser,
    FileSpreadsheet,
    ShieldCheck,
    Type,
    Undo2,
    type LucideIcon,
} from 'lucide-react'

import { FileSummaryCard } from '@/components/workspace/FileSummaryCard'
import { UploadDropzone } from '@/components/workspace/UploadDropzone'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'

interface Capability {
    title: string
    description: string
    icon: LucideIcon
}

const CAPABILITIES: readonly Capability[] = [
    {
        title: 'Remove duplicates',
        description:
            'Find repeated rows across all or selected columns and keep the first or last one.',
        icon: Copy,
    },
    {
        title: 'Handle missing values',
        description:
            'Spot blank cells and placeholders like N/A, then fill them or remove the rows.',
        icon: Eraser,
    },
    {
        title: 'Clean text',
        description:
            'Trim spaces, remove hidden characters and fix upper, lower or title case.',
        icon: Type,
    },
    {
        title: 'Standardize dates',
        description:
            'Convert mixed date formats into one format, with ambiguous dates confirmed by you.',
        icon: CalendarDays,
    },
    {
        title: 'Reshape columns',
        description: 'Split, merge, rename, reorder, add or remove columns.',
        icon: Columns3,
    },
    {
        title: 'Preview, undo, export',
        description:
            'See every change before applying it, undo it, then download XLSX or CSV.',
        icon: Undo2,
    },
]

interface DashboardPageProps {
    session: SpreadsheetSession
    onOpenWorkspace: () => void
}

export function DashboardPage({ session, onOpenWorkspace }: DashboardPageProps) {
    const loading = session.status === 'loading'

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
            <section className="text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Clean your spreadsheets without writing formulas.
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Upload, understand, clean, review, download.
                </p>
            </section>

            <div className="mt-8 space-y-4">
                <UploadDropzone
                    loading={loading}
                    error={session.error}
                    onFile={(file) => {
                        void session.loadFile(file)
                    }}
                    onCancel={session.reset}
                />
                {session.summary !== null && (
                    <FileSummaryCard
                        summary={session.summary}
                        busy={loading}
                        onSelectSheet={(sheetName) => {
                            void session.selectSheet(sheetName)
                        }}
                        onReset={session.reset}
                        onOpenWorkspace={onOpenWorkspace}
                    />
                )}
            </div>

            <section className="mt-12">
                <h2 className="text-xl font-semibold text-foreground">
                    What you can do
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {CAPABILITIES.map((item) => {
                        const Icon = item.icon
                        return (
                            <div
                                key={item.title}
                                className="rounded-lg border bg-card p-4 text-card-foreground"
                            >
                                <Icon className="size-5 text-ring" aria-hidden="true" />
                                <h3 className="mt-3 font-medium text-foreground">
                                    {item.title}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {item.description}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </section>

            <section className="mt-12 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-4 text-card-foreground">
                    <ShieldCheck className="size-5 text-ring" aria-hidden="true" />
                    <h2 className="mt-3 font-medium text-foreground">
                        Privacy-first by design
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        CleanSheet is designed to process your spreadsheet inside your
                        browser. There is no account and no sign-up.
                    </p>
                </div>
                <div className="rounded-lg border bg-card p-4 text-card-foreground">
                    <FileSpreadsheet className="size-5 text-ring" aria-hidden="true" />
                    <h2 className="mt-3 font-medium text-foreground">
                        One worksheet at a time
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        CleanSheet cleans tabular data. Formulas, macros, pivot tables,
                        charts and advanced formatting may not be preserved in the
                        exported file.
                    </p>
                </div>
            </section>
        </div>
    )
}