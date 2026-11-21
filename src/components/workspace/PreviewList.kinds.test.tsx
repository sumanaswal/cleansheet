import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PreviewList } from '@/components/workspace/PreviewList'
import type { PreviewPage } from '@/workers/importClient'

function renderList(page: PreviewPage, heading?: string) {
    const getPreviewPage = vi.fn().mockResolvedValue(page)
    render(
        <PreviewList
            getPreviewPage={getPreviewPage}
            version={{}}
            itemCount={page.itemCount}
            heading={heading}
        />,
    )
}

const fillPage: PreviewPage = {
    offset: 0,
    itemCount: 3,
    items: [
        {
            kind: 'filledCell',
            row: { sourceRow: 3, cells: [null, '7', 'Pune'] },
            columnPosition: 1,
            columnName: 'Name',
            oldValue: null,
            newValue: '0',
        },
        {
            kind: 'filledCell',
            row: { sourceRow: 4, cells: ['Ravi', null, ' '] },
            columnPosition: 3,
            columnName: 'City',
            oldValue: ' ',
            newValue: '0',
        },
        {
            kind: 'filledCell',
            row: { sourceRow: 5, cells: ['N/A', '0', 'Mumbai'] },
            columnPosition: 1,
            columnName: 'Name',
            oldValue: 'N/A',
            newValue: 'Unknown',
        },
    ],
}

const removalPage: PreviewPage = {
    offset: 0,
    itemCount: 2,
    items: [
        {
            kind: 'removedMissingRow',
            row: { sourceRow: 3, cells: [null, '7', 'Pune'] },
            missingColumns: [{ position: 1, name: 'Name' }],
        },
        {
            kind: 'removedMissingRow',
            row: { sourceRow: 4, cells: ['Ravi', null, ' '] },
            missingColumns: [
                { position: 2, name: 'Qty' },
                { position: 3, name: 'City' },
            ],
        },
    ],
}

describe('PreviewList: cells that would be filled', () => {
    it('shows each cell with its column and the old and new value', async () => {
        renderList(fillPage, 'Cells that will be filled')
        expect(
            screen.getByRole('heading', { name: 'Cells that will be filled' }),
        ).toBeInTheDocument()
        expect(await screen.findByText('Row 3')).toBeInTheDocument()
        expect(screen.getAllByText(/column 1: Name/)).toHaveLength(2)
        expect(screen.getByText(/column 3: City/)).toBeInTheDocument()
        expect(screen.getByText('(empty) → 0')).toBeInTheDocument()
        expect(screen.getByText('(blank text) → 0')).toBeInTheDocument()
        expect(screen.getByText('N/A → Unknown')).toBeInTheDocument()
        expect(screen.getByText('Records 1–3 of 3')).toBeInTheDocument()
    })
})

describe('PreviewList: rows that would be removed for missing values', () => {
    it('shows each row with the columns that were missing', async () => {
        renderList(removalPage)
        expect(
            screen.getByRole('heading', { name: 'Rows that will be removed' }),
        ).toBeInTheDocument()
        expect(await screen.findByText('Row 3')).toBeInTheDocument()
        expect(screen.getByText(/missing in: Name$/)).toBeInTheDocument()
        expect(screen.getByText(/missing in: Qty, City/)).toBeInTheDocument()
        expect(screen.getByText('7 | Pune')).toBeInTheDocument()
        expect(screen.getByText('Ravi | (blank text)')).toBeInTheDocument()
    })

    it('uses the heading it is given', async () => {
        renderList(removalPage, 'Rows with missing values')
        expect(
            screen.getByRole('heading', { name: 'Rows with missing values' }),
        ).toBeInTheDocument()
        await screen.findByText('Row 3')
    })
})