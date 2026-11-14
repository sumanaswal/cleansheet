import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UploadDropzone } from '@/components/workspace/UploadDropzone'

const file = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' })

function renderDropzone(
    props: Partial<Parameters<typeof UploadDropzone>[0]> = {},
) {
    const onFile = vi.fn()
    const onCancel = vi.fn()
    render(
        <UploadDropzone
            loading={false}
            error={null}
            onFile={onFile}
            onCancel={onCancel}
            {...props}
        />,
    )
    return { onFile, onCancel }
}

describe('UploadDropzone', () => {
    it('shows the supported formats and the limits', () => {
        renderDropzone()
        expect(screen.getByText('Supported formats: XLSX and CSV')).toBeInTheDocument()
        expect(
            screen.getByText('Up to 10 MB, 50,000 rows and 100 columns.'),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Choose file' })).toBeEnabled()
    })

    it('passes a chosen file to onFile', () => {
        const { onFile } = renderDropzone()
        fireEvent.change(screen.getByLabelText('Choose a spreadsheet file'), {
            target: { files: [file] },
        })
        expect(onFile).toHaveBeenCalledWith(file)
    })

    it('does nothing when the file picker is closed without a choice', () => {
        const { onFile } = renderDropzone()
        fireEvent.change(screen.getByLabelText('Choose a spreadsheet file'), {
            target: { files: [] },
        })
        expect(onFile).not.toHaveBeenCalled()
    })

    it('passes a dropped file to onFile', () => {
        const { onFile } = renderDropzone()
        fireEvent.drop(screen.getByRole('region', { name: 'Upload spreadsheet' }), {
            dataTransfer: { files: [file] },
        })
        expect(onFile).toHaveBeenCalledWith(file)
    })

    it('tells the user when several files are dropped', () => {
        const { onFile } = renderDropzone()
        fireEvent.drop(screen.getByRole('region', { name: 'Upload spreadsheet' }), {
            dataTransfer: { files: [file, file] },
        })
        expect(onFile).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Please add one file at a time. No file was opened.',
        )
    })

    it('shows progress with a cancel button while a file is being read', () => {
        const { onCancel } = renderDropzone({ loading: true })
        expect(screen.getByRole('status')).toHaveTextContent('Reading your file')
        expect(screen.queryByRole('button', { name: 'Choose file' })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('shows the error from a failed import', () => {
        renderDropzone({ error: 'The file is empty.' })
        expect(screen.getByRole('alert')).toHaveTextContent('The file is empty.')
    })
})