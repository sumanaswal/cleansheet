import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '@/App'

describe('App navigation', () => {
    it('starts on the dashboard', () => {
        render(<App />)
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Clean your spreadsheets without writing formulas.',
            }),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
            'aria-current',
            'page',
        )
    })

    it.each([
        ['Clean Spreadsheet'],
        ['Data Quality'],
        ['About / Help'],
    ])('navigates to %s', (label) => {
        render(<App />)
        fireEvent.click(screen.getByRole('button', { name: label }))
        expect(
            screen.getByRole('heading', { level: 1, name: label }),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: label })).toHaveAttribute(
            'aria-current',
            'page',
        )
    })
})