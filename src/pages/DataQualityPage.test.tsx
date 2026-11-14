import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataQualityPage } from '@/pages/DataQualityPage'
import { makeSummary } from '@/test/session'

describe('DataQualityPage', () => {
    it('shows the heading and the empty state', () => {
        render(<DataQualityPage summary={null} />)
        expect(
            screen.getByRole('heading', { level: 1, name: 'Data Quality' }),
        ).toBeInTheDocument()
        expect(screen.getByText('No spreadsheet loaded')).toBeInTheDocument()
    })

    it('lists the six summary figures with no values yet', () => {
        render(<DataQualityPage summary={null} />)
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

    it('names the loaded file and says the analysis comes later', () => {
        render(<DataQualityPage summary={makeSummary()} />)
        expect(screen.queryByText('No spreadsheet loaded')).toBeNull()
        expect(screen.getByText('Spreadsheet loaded: staff.csv')).toBeInTheDocument()
        expect(
            screen.getByText('The quality analysis is added in the next development phase.'),
        ).toBeInTheDocument()
    })
})