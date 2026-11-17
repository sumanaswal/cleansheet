import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from '@/components/workspace/DataTable'
import type { Column, Row } from '@/engine/types'

const columns: Column[] = [
    { id: 'c1', name: 'ID' },
    { id: 'c2', name: 'Name' },
    { id: 'c3', name: 'Name' },
]

const rows: Row[] = [
    { sourceRow: 2, cells: ['00123', 'Asha', null] },
    { sourceRow: 3, cells: ['00124', '   ', 'a\nb'] },
    {
        sourceRow: 5,
        cells: [0, true, { kind: 'date', serial: 46000, text: '09-12-2025' }],
    },
]

describe('DataTable', () => {
    it('shows a Row column and every column header, including duplicate names', () => {
        render(<DataTable columns={columns} rows={rows} />)
        expect(
            screen.getAllByRole('columnheader').map((header) => header.textContent),
        ).toEqual(['Row', 'ID', 'Name', 'Name'])
    })

    it('numbers rows like the original file', () => {
        render(<DataTable columns={columns} rows={rows} />)
        expect(
            screen.getAllByRole('rowheader').map((header) => header.textContent),
        ).toEqual(['2', '3', '5'])
    })

    it('shows each kind of value', () => {
        render(<DataTable columns={columns} rows={rows} />)
        expect(screen.getByText('00123')).toBeInTheDocument()
        expect(screen.getByText('Asha')).toBeInTheDocument()
        expect(screen.getByText('a↵b')).toBeInTheDocument()
        expect(screen.getByText('0')).toBeInTheDocument()
        expect(screen.getByText('TRUE')).toBeInTheDocument()
        expect(screen.getByText('09-12-2025')).toBeInTheDocument()
    })

    it('labels empty cells and cells that contain only whitespace', () => {
        render(<DataTable columns={columns} rows={rows} />)
        expect(screen.getByText('empty')).toBeInTheDocument()
        expect(screen.getByText('(blank text)')).toBeInTheDocument()
    })

    it('still shows the headers when there are no rows', () => {
        render(<DataTable columns={columns} rows={[]} />)
        expect(screen.getAllByRole('columnheader')).toHaveLength(4)
        expect(screen.queryAllByRole('rowheader')).toHaveLength(0)
    })

    it('is a labelled region that can be scrolled with the keyboard', () => {
        render(<DataTable columns={columns} rows={rows} />)
        const region = screen.getByRole('region', { name: 'Spreadsheet data' })
        expect(region).toHaveAttribute('tabindex', '0')
    })
})