import { Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Visual only for now. File reading is built in Phase 3.
export function UploadDropzone() {
    return (
        <section
            aria-label="Upload spreadsheet"
            className="flex flex-col items-center rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 py-12 text-center"
        >
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Upload className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
                Drag and drop your spreadsheet here
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
                or choose a file from your computer
            </p>
            <Button type="button" className="mt-5" disabled>
                Choose file
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
                Supported formats: XLSX and CSV
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
                File import is not active yet. It is built in Phase 3.
            </p>
        </section>
    )
}