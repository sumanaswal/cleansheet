import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FileSummaryCard } from '@/components/workspace/FileSummaryCard'
import { makeSummary } from '@/test/session'
import type { DatasetSummary } from '@/workers/protocol'

function renderCard(summary: DatasetSummary, busy = false) {
    const onSelectSheet = vi.fn()
    const onReset = vi.fn()
    const onOpenWorkspace = vi.fn()
    render(
        <FileSummaryCard
            summary={summary}
            busy={busy}
            onSelectSheet={onSelectSheet}
            onReset={onReset}
            onOpenWorkspace={onOpenWorkspace}
        />,
    )
    return { onSelectSheet, onReset, onOpenWorkspace }
}

const workbookSummary = makeSummary({
    source: { name: 'book.xlsx', sizeBytes: 5000, format: 'xlsx' },
    sheetName: 'First',
    sheetNames: ['First', 'Second'],
})

describe('FileSummaryCard', () => {
    it('shows the file name, size, format, rows and columns', () => {
        renderCard(makeSummary())
        expect(screen.getByRole('heading', { name: 'staff.csv' })).toBeInTheDocument()
        expect(screen.getByText('2.0 KB')).toBeInTheDocument()
        expect(screen.getByText('CSV')).toBeInTheDocument()
        expect(screen.getByText('1,234')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('says so when the file needed no adjustments', () => {
        renderCard(makeSummary())
        expect(
            screen.getByText('The file was read without any adjustments.'),
        ).toBeInTheDocument()
    })

    it('lists the warnings from the import', () => {
        renderCard(makeSummary({ warnings: ['Warning one.', 'Warning two.'] }))
        expect(screen.getByText('Warning one.')).toBeInTheDocument()
        expect(screen.getByText('Warning two.')).toBeInTheDocument()
        expect(screen.queryByText(/without any adjustments/)).toBeNull()
    })

    it('lets the user choose a worksheet in a workbook with several', () => {
        const { onSelectSheet } = renderCard(workbookSummary)
        const select = screen.getByLabelText('Worksheet')
        expect(select).toHaveValue('First')
        fireEvent.change(select, { target: { value: 'Second' } })
        expect(onSelectSheet).toHaveBeenCalledWith('Second')
    })

    it('has no worksheet choice for a CSV file or a single-sheet workbook', () => {
        renderCard(makeSummary())
        expect(screen.queryByLabelText('Worksheet')).toBeNull()
    })

    it('shows the worksheet name of a single-sheet workbook', () => {
        renderCard({ ...workbookSummary, sheetNames: ['First'] })
        expect(screen.queryByLabelText('Worksheet')).toBeNull()
        expect(screen.getByText('Worksheet: First')).toBeInTheDocument()
    })

    it('opens the workspace and removes the file with its buttons', () => {
        const { onReset, onOpenWorkspace } = renderCard(makeSummary())
        fireEvent.click(screen.getByRole('button', { name: 'Open cleaning workspace' }))
        fireEvent.click(screen.getByRole('button', { name: 'Remove file' }))
        expect(onOpenWorkspace).toHaveBeenCalledTimes(1)
        expect(onReset).toHaveBeenCalledTimes(1)
    })

    it('disables the worksheet choice while busy', () => {
        renderCard(workbookSummary, true)
        expect(screen.getByLabelText('Worksheet')).toBeDisabled()
    })
})