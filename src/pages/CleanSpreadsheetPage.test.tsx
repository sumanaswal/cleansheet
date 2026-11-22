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

const total = OPERATION_GROUPS.reduce((count, group) => count + group.items.length, 0)

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

    it('keeps every operation disabled until a spreadsheet is loaded', () => {
        render(<CleanSpreadsheetPage session={makeSession()} />)
        const buttons = within(
            screen.getByRole('region', { name: 'Operations' }),
        ).getAllByRole('button')
        expect(buttons).toHaveLength(total)
        for (const button of buttons) {
            expect(button).toBeDisabled()
        }
    })

    it('enables only the operations that are built once a spreadsheet is loaded', async () => {
        render(<CleanSpreadsheetPage session={loadedSession().session} />)
        const buttons = within(
            screen.getByRole('region', { name: 'Operations' }),
        ).getAllByRole('button')
        const enabled = buttons
            .filter((button) => !button.hasAttribute('disabled'))
            .map((button) => button.textContent)
        expect(enabled).toEqual(['Remove duplicates', 'Missing values'])
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

describe('CleanSpreadsheetPage: remove duplicates', () => {
    it('opens the settings of the chosen operation and closes them on Cancel', async () => {
        render(<CleanSpreadsheetPage session={loadedSession().session} />)
        const settings = screen.getByRole('region', { name: 'Operation settings' })
        expect(
            within(settings).getByText(/Choose an operation on the left/),
        ).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Remove duplicates' }))
        expect(
            within(settings).getByRole('heading', { name: 'Remove duplicates' }),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove duplicates' })).toHaveAttribute(
            'aria-pressed',
            'true',
        )

        fireEvent.click(within(settings).getByRole('button', { name: 'Cancel' }))
        expect(within(settings).getByText(/Choose an operation on the left/)).toBeInTheDocument()
        await screen.findByText('Zoe')
    })

    it('reloads the table rows when a preview is made, so highlights can appear', async () => {
        const { session, getPage } = loadedSession()
        render(<CleanSpreadsheetPage session={session} />)
        await screen.findByText('Zoe')
        fireEvent.click(screen.getByRole('button', { name: 'Remove duplicates' }))

        const calls = getPage.mock.calls.length
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        await waitFor(() => expect(getPage.mock.calls.length).toBeGreaterThan(calls))
        expect(session.previewOperation).toHaveBeenCalledTimes(1)
    })

    it('highlights rows that would be removed or kept, with a legend', async () => {
        const getPage = vi.fn().mockResolvedValue({
            offset: 0,
            rows: [
                { sourceRow: 2, cells: ['Zoe', 'Pune'] },
                { sourceRow: 3, cells: ['Zoe', 'Pune'] },
            ],
            rowCount: 1234,
            marks: ['keep', 'remove'],
        })
        render(<CleanSpreadsheetPage session={loadedSession(getPage).session} />)
        expect(
            await screen.findByText(/Rows marked Remove would be removed/),
        ).toBeInTheDocument()
        const headers = screen.getAllByRole('rowheader').map((header) => header.textContent)
        expect(headers).toEqual(['Keep 2', 'Remove 3'])
    })
})