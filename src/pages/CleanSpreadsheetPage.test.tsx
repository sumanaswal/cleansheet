import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OPERATION_GROUPS } from '@/components/workspace/operations'
import { CleanSpreadsheetPage } from '@/pages/CleanSpreadsheetPage'

describe('CleanSpreadsheetPage', () => {
    it('shows the three workspace panels', () => {
        render(<CleanSpreadsheetPage />)
        expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument()
        expect(
            screen.getByRole('region', { name: 'Spreadsheet preview' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('region', { name: 'Operation settings' }),
        ).toBeInTheDocument()
    })

    it('disables every operation until a spreadsheet is loaded', () => {
        render(<CleanSpreadsheetPage />)
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
        render(<CleanSpreadsheetPage />)
        expect(screen.getByText('No spreadsheet loaded')).toBeInTheDocument()
    })
})