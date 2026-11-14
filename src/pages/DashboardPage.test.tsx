import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DashboardPage } from '@/pages/DashboardPage'

describe('DashboardPage', () => {
    it('shows the headline and the upload area', () => {
        render(<DashboardPage />)
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Clean your spreadsheets without writing formulas.',
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('region', { name: 'Upload spreadsheet' }),
        ).toBeInTheDocument()
    })

    it('keeps the upload button disabled until import exists', () => {
        render(<DashboardPage />)
        expect(screen.getByRole('button', { name: 'Choose file' })).toBeDisabled()
    })

    it('lists all six cleaning capabilities', () => {
        render(<DashboardPage />)
        const titles = [
            'Remove duplicates',
            'Handle missing values',
            'Clean text',
            'Standardize dates',
            'Reshape columns',
            'Preview, undo, export',
        ]
        for (const title of titles) {
            expect(
                screen.getByRole('heading', { level: 3, name: title }),
            ).toBeInTheDocument()
        }
    })

    it('shows the privacy and scope notes', () => {
        render(<DashboardPage />)
        expect(
            screen.getByRole('heading', { name: 'Privacy-first by design' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', { name: 'One worksheet at a time' }),
        ).toBeInTheDocument()
    })
})