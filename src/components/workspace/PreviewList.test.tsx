import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PreviewList } from '@/components/workspace/PreviewList'
import type { PreviewPage } from '@/workers/importClient'

function pageFor(offset: number, limit: number, total: number): PreviewPage {
    const count = Math.max(0, Math.min(limit, total - offset))
    return {
        offset,
        itemCount: total,
        items: Array.from({ length: count }, (_, i) => ({
            kind: 'removedRow' as const,
            row: { sourceRow: offset + i + 2, cells: ['Asha', null, 'Delhi'] },
            keptSourceRow: 1,
        })),
    }
}

function renderList(total: number) {
    const getPreviewPage = vi.fn(async (offset: number, limit: number) =>
        pageFor(offset, limit, total),
    )
    render(
        <PreviewList getPreviewPage={getPreviewPage} version={{}} itemCount={total} />,
    )
    return getPreviewPage
}

describe('PreviewList', () => {
    it('shows each record with the row that stays and its first values', async () => {
        renderList(3)
        expect(await screen.findByText('Row 2')).toBeInTheDocument()
        expect(screen.getAllByText(/same as row 1 \(stays\)/)).toHaveLength(3)
        expect(screen.getAllByText('Asha | Delhi')).toHaveLength(3)
        expect(screen.getByText('Records 1–3 of 3')).toBeInTheDocument()
    })

    it('has no page buttons when everything fits on one page', async () => {
        renderList(3)
        await screen.findByText('Row 2')
        expect(screen.queryByRole('button')).toBeNull()
    })

    it('moves between pages of records', async () => {
        const getPreviewPage = renderList(45)
        expect(await screen.findByText('Records 1–20 of 45')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Previous records' })).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Next records' }))
        expect(await screen.findByText('Records 21–40 of 45')).toBeInTheDocument()
        expect(getPreviewPage).toHaveBeenLastCalledWith(20, 20)

        fireEvent.click(screen.getByRole('button', { name: 'Next records' }))
        expect(await screen.findByText('Records 41–45 of 45')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next records' })).toBeDisabled()
    })
})