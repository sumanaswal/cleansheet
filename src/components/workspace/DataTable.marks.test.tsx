import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from '@/components/workspace/DataTable'
import type { Column, Row } from '@/engine/types'

const columns: Column[] = [{ id: 'c1', name: 'v' }]
const rows: Row[] = [
    { sourceRow: 2, cells: ['A'] },
    { sourceRow: 3, cells: ['B'] },
    { sourceRow: 4, cells: ['A'] },
]

function rowHeaders(): string[] {
    return screen
        .getAllByRole('rowheader')
        .map((header) => header.textContent ?? '')
}

describe('DataTable: marks', () => {
    it('labels rows that would be removed and rows that stay', () => {
        render(<DataTable columns={columns} rows={rows} marks={['keep', null, 'remove']} />)
        expect(rowHeaders()).toEqual(['Keep 2', '3', 'Remove 4'])
    })

    it('shows no labels without marks', () => {
        render(<DataTable columns={columns} rows={rows} />)
        expect(rowHeaders()).toEqual(['2', '3', '4'])
    })

    it('treats rows beyond the marks as unmarked', () => {
        render(<DataTable columns={columns} rows={rows} marks={['remove']} />)
        expect(rowHeaders()).toEqual(['Remove 2', '3', '4'])
    })
})