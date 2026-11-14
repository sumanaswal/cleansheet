import { Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

import { Button } from '@/components/ui/button'
import { IMPORT_LIMITS } from '@/engine/io/validation'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
    loading: boolean
    error: string | null
    onFile: (file: File) => void
    onCancel: () => void
}

const MAX_FILE_MB = IMPORT_LIMITS.maxFileSizeBytes / (1024 * 1024)

export function UploadDropzone({
    loading,
    error,
    onFile,
    onCancel,
}: UploadDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)

    function handleFiles(files: FileList | null): void {
        if (files === null || files.length === 0) return
        if (files.length > 1) {
            setNotice('Please add one file at a time. No file was opened.')
            return
        }
        setNotice(null)
        const file = files[0]
        if (file !== undefined) onFile(file)
    }

    function handleDragOver(event: DragEvent<HTMLElement>): void {
        event.preventDefault()
        if (!loading) setDragging(true)
    }

    function handleDragLeave(event: DragEvent<HTMLElement>): void {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        setDragging(false)
    }

    function handleDrop(event: DragEvent<HTMLElement>): void {
        event.preventDefault()
        setDragging(false)
        if (loading) return
        handleFiles(event.dataTransfer.files)
    }

    function handleChange(event: ChangeEvent<HTMLInputElement>): void {
        handleFiles(event.target.files)
        // Allow the same file to be chosen again later.
        event.target.value = ''
    }

    const message = notice ?? error

    return (
        <section
            aria-label="Upload spreadsheet"
            aria-busy={loading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                'flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
                dragging ? 'border-ring bg-accent' : 'border-border bg-muted/40',
            )}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                aria-label="Choose a spreadsheet file"
                disabled={loading}
                onChange={handleChange}
            />
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Upload className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
                Drag and drop your spreadsheet here
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
                or choose a file from your computer
            </p>

            {loading ? (
                <div role="status" className="mt-5 flex flex-col items-center gap-3">
                    <p className="text-sm text-foreground">Reading your file…</p>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    className="mt-5"
                    onClick={() => inputRef.current?.click()}
                >
                    Choose file
                </Button>
            )}

            <p className="mt-3 text-sm text-muted-foreground">
                Supported formats: XLSX and CSV
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
                {`Up to ${MAX_FILE_MB} MB, ${IMPORT_LIMITS.maxRows.toLocaleString('en-US')} rows and ${IMPORT_LIMITS.maxColumns} columns.`}
            </p>

            {message !== null && (
                <p role="alert" className="mt-4 max-w-xl text-sm text-destructive">
                    {message}
                </p>
            )}
        </section>
    )
}