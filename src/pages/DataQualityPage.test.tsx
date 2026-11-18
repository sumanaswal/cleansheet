import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DatasetProfile } from '@/engine/profiling/types'
import { DataQualityPage } from '@/pages/DataQualityPage'
import { makeProfile, makeSession, makeSummary } from '@/test/session'

function renderLoaded(getProfile: () => Promise<DatasetProfile>) {
    render(
        <DataQualityPage
            session={makeSession({ status: 'ready', summary: makeSummary(), getProfile })}
        />,
    )
}

/** The value shown next to a summary figure label. */
function figure(label: string): Element | null {
    return screen.getByText(label).nextElementSibling
}

describe('DataQualityPage: nothing loaded', () => {
    it('shows the heading and the empty state', () => {
        render(<DataQualityPage session={makeSession()} />)
        expect(
            screen.getByRole('heading', { level: 1, name: 'Data Quality' }),
        ).toBeInTheDocument()
        expect(screen.getByText('No spreadsheet loaded')).toBeInTheDocument()
    })

    it('lists the seven summary figures with no values and does not analyze', () => {
        const session = makeSession()
        render(<DataQualityPage session={session} />)
        for (const label of [
            'Total rows',
            'Total columns',
            'Duplicate rows',
            'Missing cells',
            'Empty rows',
            'Empty columns',
            'Negative numbers',
        ]) {
            expect(figure(label)).toHaveTextContent('—')
        }
        expect(session.getProfile).not.toHaveBeenCalled()
    })

    it('explains how the figures are counted', () => {
        render(<DataQualityPage session={makeSession()} />)
        expect(
            screen.getByRole('heading', { name: 'How these are counted' }),
        ).toBeInTheDocument()
        expect(screen.getByText(/at least 90% of its values fit it/)).toBeInTheDocument()
        expect(
            screen.getByText(/do not mark a column as worth checking/),
        ).toBeInTheDocument()
    })
})

describe('DataQualityPage: spreadsheet loaded', () => {
    it('says the spreadsheet is being analyzed while it waits', () => {
        renderLoaded(() => new Promise<DatasetProfile>(() => { }))
        expect(screen.getByRole('status')).toHaveTextContent('Analyzing staff.csv')
        expect(figure('Total rows')).toHaveTextContent('—')
    })

    it('shows an error when the analysis fails', async () => {
        renderLoaded(() => Promise.reject(new Error('No spreadsheet is loaded.')))
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('No spreadsheet is loaded.')
        expect(alert).toHaveTextContent('remove the file and upload it again')
    })

    it('shows the seven figures once the analysis is done', async () => {
        renderLoaded(vi.fn().mockResolvedValue(makeProfile()))
        await screen.findByRole('table', { name: 'Column quality' })
        expect(figure('Total rows')).toHaveTextContent('1,234')
        expect(figure('Total columns')).toHaveTextContent('3')
        expect(figure('Duplicate rows')).toHaveTextContent('12')
        expect(figure('Missing cells')).toHaveTextContent('30')
        expect(figure('Empty rows')).toHaveTextContent('4')
        expect(figure('Empty columns')).toHaveTextContent('1')
        expect(figure('Negative numbers')).toHaveTextContent('7')
    })

    it('shows one row per column, with the detected type and a marker for columns worth checking', async () => {
        renderLoaded(vi.fn().mockResolvedValue(makeProfile()))
        const table = await screen.findByRole('table', { name: 'Column quality' })
        // One header row and three columns, two of them with the same name.
        expect(within(table).getAllByRole('row')).toHaveLength(4)
        expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual([
            'Name',
            'Name',
            'Qty',
        ])
        expect(within(table).getByText('Number stored as text')).toBeInTheDocument()
        expect(within(table).getByText('Number')).toBeInTheDocument()
        expect(within(table).getAllByText('Worth checking')).toHaveLength(2)
    })

    it('shows the count of negative numbers for each column without marking it', async () => {
        renderLoaded(vi.fn().mockResolvedValue(makeProfile()))
        const table = await screen.findByRole('table', { name: 'Column quality' })
        expect(
            within(table).getByRole('columnheader', { name: 'Negative' }),
        ).toBeInTheDocument()
        const row = within(table).getByRole('row', { name: /Qty/ })
        const cells = within(row).getAllByRole('cell')
        // Cells: #, type, missing, placeholders, exceptions, negative, status.
        expect(cells[5]).toHaveTextContent('7')
        expect(within(row).queryByText('Worth checking')).toBeNull()
    })

    it('explains that a spreadsheet with no data rows counts every column as empty', async () => {
        renderLoaded(
            vi.fn().mockResolvedValue(makeProfile({ totalRows: 0, columns: [] })),
        )
        expect(
            await screen.findByText(/no data rows, so every column counts as empty/),
        ).toBeInTheDocument()
    })
})