import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OperationsPanel } from '@/components/workspace/OperationsPanel'
import { OPERATION_GROUPS } from '@/components/workspace/operations'

const total = OPERATION_GROUPS.reduce((count, group) => count + group.items.length, 0)

describe('OperationsPanel', () => {
    it('keeps every operation disabled until a spreadsheet is loaded', () => {
        render(<OperationsPanel hasData={false} activeId={null} onSelect={vi.fn()} />)
        const buttons = screen.getAllByRole('button')
        expect(buttons).toHaveLength(total)
        for (const button of buttons) {
            expect(button).toBeDisabled()
        }
        expect(screen.getByText('Available after you upload a spreadsheet.')).toBeInTheDocument()
    })

    it('enables only the operations that are built', () => {
        render(<OperationsPanel hasData activeId={null} onSelect={vi.fn()} />)
        const enabled = screen
            .getAllByRole('button')
            .filter((button) => !button.hasAttribute('disabled'))
            .map((button) => button.textContent)
        expect(enabled).toEqual(['Remove duplicates', 'Missing values'])
        expect(
            screen.getByText('Greyed-out operations are added in later development phases.'),
        ).toBeInTheDocument()
    })

    it('passes the chosen operation to onSelect', () => {
        const onSelect = vi.fn()
        render(<OperationsPanel hasData activeId={null} onSelect={onSelect} />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove duplicates' }))
        expect(onSelect).toHaveBeenCalledWith('duplicates')
    })

    it('shows which operation is open', () => {
        render(<OperationsPanel hasData activeId="duplicates" onSelect={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Remove duplicates' })).toHaveAttribute(
            'aria-pressed',
            'true',
        )
        expect(screen.getByRole('button', { name: 'Text cleaning' })).toHaveAttribute(
            'aria-pressed',
            'false',
        )
    })
})