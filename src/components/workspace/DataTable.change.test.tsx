import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from '@/components/workspace/DataTable'
import type { Column, Row } from '@/engine/types'

const columns: Column[] = [{ id: 'c1', name: 'Name' }]
const rows: Row[] = [
    { sourceRow: 2, cells: ['  asha '] },
    { sourceRow: 3, cells: ['Ravi'] },
]

describe('DataTable: cells that would change', () => {
    it('labels them Change when text would be changed', () => {
        render(
            <DataTable
                columns={columns}
                rows={rows}
                cellMarks={[[0], []]}
                cellMarkKind="change"
            />,
        )
        expect(screen.getAllByText('Change')).toHaveLength(1)
        expect(screen.getAllByTitle('Will be changed')).toHaveLength(1)
        expect(screen.queryByText('Fill')).toBeNull()
    })

    it('labels them Fill by default, and when asked', () => {
        const { rerender } = render(
            <DataTable columns={columns} rows={rows} cellMarks={[[0], []]} />,
        )
        expect(screen.getAllByText('Fill')).toHaveLength(1)
        rerender(
            <DataTable
                columns={columns}
                rows={rows}
                cellMarks={[[0], []]}
                cellMarkKind="fill"
            />,
        )
        expect(screen.getAllByText('Fill')).toHaveLength(1)
        expect(screen.getAllByTitle('Will be filled')).toHaveLength(1)
    })
})