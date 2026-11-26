import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PreviewList } from '@/components/workspace/PreviewList'
import type { PreviewPage } from '@/workers/importClient'

const page: PreviewPage = {
    offset: 0,
    itemCount: 3,
    items: [
        {
            kind: 'changedText',
            row: { sourceRow: 3, cells: ['  asha '] },
            columnPosition: 1,
            columnName: 'Name',
            oldText: '  asha ',
            newText: 'Asha',
        },
        {
            kind: 'changedText',
            row: { sourceRow: 4, cells: ['a\u200Bb'] },
            columnPosition: 1,
            columnName: 'Name',
            oldText: 'a\u200Bb',
            newText: 'ab',
        },
        {
            kind: 'changedText',
            row: { sourceRow: 5, cells: ['   '] },
            columnPosition: 2,
            columnName: 'City',
            oldText: '   ',
            newText: null,
        },
    ],
}

describe('PreviewList: text that would be changed', () => {
    it('shows the old and the new text with hidden characters made visible', async () => {
        render(
            <PreviewList
                getPreviewPage={vi.fn().mockResolvedValue(page)}
                version={{}}
                itemCount={3}
                heading="Cells that will be changed"
            />,
        )
        expect(
            screen.getByRole('heading', { name: 'Cells that will be changed' }),
        ).toBeInTheDocument()
        expect(await screen.findByText('Row 3')).toBeInTheDocument()
        expect(screen.getAllByText(/column 1: Name/)).toHaveLength(2)
        expect(screen.getByText(/column 2: City/)).toBeInTheDocument()
        expect(screen.getByText('··asha· → Asha')).toBeInTheDocument()
        expect(screen.getByText('a[U+200B]b → ab')).toBeInTheDocument()
        expect(screen.getByText('··· → (empty)')).toBeInTheDocument()
        expect(screen.getByText('Records 1–3 of 3')).toBeInTheDocument()
    })
})