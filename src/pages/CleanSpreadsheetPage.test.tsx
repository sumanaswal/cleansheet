import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OPERATION_GROUPS } from '@/components/workspace/operations'
import { CleanSpreadsheetPage } from '@/pages/CleanSpreadsheetPage'
import { makeSession, makeSummary } from '@/test/session'

const loaded = () =>
    makeSession({ status: 'ready', summary: makeSummary() })

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

    it('keeps every operation disabled until the operations are built', () => {
        render(<CleanSpreadsheetPage session={loaded()} />)
        const total = OPERATION_GROUPS.reduce(
            (count, group) => count + group.items.length,
            0,
        )
        const buttons = screen.getAllByRole('button')
        expect(buttons).toHaveLength(total)
        for (const button of buttons) {
            expect(button).toBeDisabled()
        }
    })

    it('explains that no spreadsheet is loaded', () => {
        render(<CleanSpreadsheetPage session={makeSession()} />)
        expect(screen.getByText('No spreadsheet loaded')).toBeInTheDocument()
        expect(
            screen.getByText('Available after you upload a spreadsheet.'),
        ).toBeInTheDocument()
    })

    it('shows the loaded file, its size in rows and columns, and its column names', () => {
        render(<CleanSpreadsheetPage session={loaded()} />)
        expect(screen.queryByText('No spreadsheet loaded')).toBeNull()
        expect(screen.getByText('staff.csv')).toBeInTheDocument()
        expect(screen.getByText('1,234 data rows × 2 columns')).toBeInTheDocument()
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('City')).toBeInTheDocument()
    })

    it('says that cleaning operations arrive later once a file is loaded', () => {
        render(<CleanSpreadsheetPage session={loaded()} />)
        expect(
            screen.getByText('Cleaning operations are added in a later development phase.'),
        ).toBeInTheDocument()
    })
})