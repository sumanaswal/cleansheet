import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OPERATION_GROUPS } from '@/components/workspace/operations'
import { CleanSpreadsheetPage } from '@/pages/CleanSpreadsheetPage'
import { makeSession, makeSummary } from '@/test/session'

function loadedSession(
    getPage = vi.fn().mockResolvedValue({
        offset: 0,
        rows: [{ sourceRow: 2, cells: ['Zoe', 'Pune'] }],
        rowCount: 1234,
    }),
) {
    return {
        getPage,
        session: makeSession({ status: 'ready', summary: makeSummary(), getPage }),
    }
}

describe('CleanSpreadsheetPage', () => {
    it('shows the three workspace panels', () => {
        render(<CleanSpreadsheetPage session={makeSession()} />)
        expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument()
        expect(
            screen.getByRole('region', { name: 'Spreadsheet preview' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('region', { name: 'Operation settings' }),
        ).toBeInTheDocument()
    })

    it('keeps every operation disabled until the operations are built', async () => {
        render(<CleanSpreadsheetPage session={loadedSession().session} />)
        const total = OPERATION_GROUPS.reduce(
            (count, group) => count + group.items.length,
            0,
        )
        const buttons = within(
            screen.getByRole('region', { name: 'Operations' }),
        ).getAllByRole('button')
        expect(buttons).toHaveLength(total)
        for (const button of buttons) {
            expect(button).toBeDisabled()
        }
        await screen.findByText('Zoe')
    })

    it('explains that no spreadsheet is loaded', () => {
        render(<CleanSpreadsheetPage session={makeSession()} />)
        expect(screen.getByText('No spreadsheet loaded')).toBeInTheDocument()
        expect(
            screen.getByText('Available after you upload a spreadsheet.'),
        ).toBeInTheDocument()
    })

    it('shows the loaded file, its size in rows and columns, and its column names', async () => {
        render(<CleanSpreadsheetPage session={loadedSession().session} />)
        expect(screen.queryByText('No spreadsheet loaded')).toBeNull()
        expect(screen.getByText('staff.csv')).toBeInTheDocument()
        expect(screen.getByText('1,234 data rows × 2 columns')).toBeInTheDocument()
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('City')).toBeInTheDocument()
        await screen.findByText('Zoe')
    })

    it('says that cleaning operations arrive later once a file is loaded', async () => {
        render(<CleanSpreadsheetPage session={loadedSession().session} />)
        expect(
            screen.getByText('Cleaning operations are added in a later development phase.'),
        ).toBeInTheDocument()
        await screen.findByText('Zoe')
    })

    it('shows the first page of rows with pagination', async () => {
        const { session, getPage } = loadedSession()
        render(<CleanSpreadsheetPage session={session} />)
        expect(await screen.findByText('Zoe')).toBeInTheDocument()
        expect(screen.getByText('Pune')).toBeInTheDocument()
        expect(getPage).toHaveBeenCalledWith(0, 100)
        expect(screen.getByText('Data rows 1–100 of 1,234')).toBeInTheDocument()
        expect(screen.getByText('Page 1 of 13')).toBeInTheDocument()
    })

    it('asks for the next 100 rows when the next page is chosen', async () => {
        const { session, getPage } = loadedSession()
        render(<CleanSpreadsheetPage session={session} />)
        await screen.findByText('Zoe')

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
        await waitFor(() => expect(getPage).toHaveBeenLastCalledWith(100, 100))
        await waitFor(() =>
            expect(screen.getByText('Page 2 of 13')).toBeInTheDocument(),
        )
    })

    it('shows an error when the rows cannot be loaded', async () => {
        const getPage = vi.fn().mockRejectedValue(new Error('No spreadsheet is loaded.'))
        render(<CleanSpreadsheetPage session={loadedSession(getPage).session} />)
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('No spreadsheet is loaded.')
        expect(alert).toHaveTextContent('remove the file and upload it again')
    })
})