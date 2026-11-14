import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataQualityPage } from '@/pages/DataQualityPage'

describe('DataQualityPage', () => {
    it('shows the heading and the empty state', () => {
        render(<DataQualityPage />)
        expect(
            screen.getByRole('heading', { level: 1, name: 'Data Quality' }),
        ).toBeInTheDocument()
        expect(screen.getByText('No spreadsheet loaded')).toBeInTheDocument()
    })

    it('lists the six summary figures with no values yet', () => {
        render(<DataQualityPage />)
        const labels = [
            'Total rows',
            'Total columns',
            'Duplicate rows',
            'Missing cells',
            'Empty rows',
            'Empty columns',
        ]
        for (const label of labels) {
            expect(screen.getByText(label)).toBeInTheDocument()
        }
        expect(screen.getAllByText('—')).toHaveLength(labels.length)
    })
})