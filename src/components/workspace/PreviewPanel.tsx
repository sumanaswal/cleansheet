import { Table2 } from 'lucide-react'

export function PreviewPanel() {
    return (
        <section
            aria-label="Spreadsheet preview"
            className="flex min-h-[24rem] flex-col rounded-lg border bg-card p-4 text-card-foreground"
        >
            <h2 className="text-sm font-semibold text-foreground">
                Spreadsheet preview
            </h2>
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
        </section>
    )
}