import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from '@/components/workspace/DataTable'
import type { Column, Row } from '@/engine/types'

const columns: Column[] = [
    { id: 'c1', name: 'Name' },
    { id: 'c2', name: 'City' },
]
const rows: Row[] = [
    { sourceRow: 2, cells: ['Asha', 'Delhi'] },
    { sourceRow: 3, cells: [null, 'Pune'] },
    { sourceRow: 4, cells: ['Ravi', ' '] },
]

describe('DataTable: cell marks', () => {
    it('labels the cells that would be filled', () => {
        render(
            <DataTable columns={columns} rows={rows} cellMarks={[[], [0], [1]]} />,
        )
        expect(screen.getAllByText('Fill')).toHaveLength(2)
        expect(screen.getAllByTitle('Will be filled')).toHaveLength(2)
    })

    it('still tells a screen reader that a marked cell is empty', () => {
        render(<DataTable columns={columns} rows={rows} cellMarks={[[], [0], []]} />)
        expect(screen.getByText('empty')).toBeInTheDocument()
        expect(screen.getAllByText('Fill')).toHaveLength(1)
    })

    it('shows no labels without cell marks, or for rows beyond them', () => {
        const { rerender } = render(<DataTable columns={columns} rows={rows} />)
        expect(screen.queryByText('Fill')).toBeNull()
        rerender(<DataTable columns={columns} rows={rows} cellMarks={[[0]]} />)
        expect(screen.getAllByText('Fill')).toHaveLength(1)
    })
})