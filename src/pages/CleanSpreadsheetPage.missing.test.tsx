import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CleanSpreadsheetPage } from '@/pages/CleanSpreadsheetPage'
import { makeSession, makeSummary } from '@/test/session'

function loadedSession(page: object) {
    return makeSession({
        status: 'ready',
        summary: makeSummary(),
        getPage: vi.fn().mockResolvedValue(page),
    })
}

describe('CleanSpreadsheetPage: missing values', () => {
    it('opens the settings of the Missing values operation', async () => {
        render(
            <CleanSpreadsheetPage
                session={loadedSession({
                    offset: 0,
                    rows: [{ sourceRow: 2, cells: ['Zoe', 'Pune'] }],
                    rowCount: 1234,
                })}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Missing values' }))
        const settings = screen.getByRole('region', { name: 'Operation settings' })
        expect(
            within(settings).getByRole('heading', { name: 'Missing values' }),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Missing values' })).toHaveAttribute(
            'aria-pressed',
            'true',
        )
        await screen.findByText('Zoe')
    })

    it('highlights the cells that would be filled, with a legend', async () => {
        render(
            <CleanSpreadsheetPage
                session={loadedSession({
                    offset: 0,
                    rows: [
                        { sourceRow: 2, cells: ['Zoe', null] },
                        { sourceRow: 3, cells: ['Ravi', 'Pune'] },
                    ],
                    rowCount: 1234,
                    cellMarks: [[1], []],
                })}
            />,
        )
        expect(
            await screen.findByText(/Cells marked Fill would be filled/),
        ).toBeInTheDocument()
        expect(screen.getAllByText('Fill')).toHaveLength(1)
    })

    it('does not show the Keep explanation when only rows to remove are marked', async () => {
        render(
            <CleanSpreadsheetPage
                session={loadedSession({
                    offset: 0,
                    rows: [{ sourceRow: 2, cells: ['Zoe', null] }],
                    rowCount: 1234,
                    marks: ['remove'],
                })}
            />,
        )
        const note = await screen.findByText(/Rows marked Remove would be removed/)
        expect(note).not.toHaveTextContent('Rows marked Keep')
    })
})