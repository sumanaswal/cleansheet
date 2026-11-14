import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardPage } from '@/pages/DashboardPage'
import { makeSession, makeSummary } from '@/test/session'

describe('DashboardPage', () => {
    it('shows the headline and the upload area', () => {
        render(<DashboardPage session={makeSession()} onOpenWorkspace={vi.fn()} />)
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Clean your spreadsheets without writing formulas.',
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('region', { name: 'Upload spreadsheet' }),
        ).toBeInTheDocument()
    })

    it('lets the user choose a file', () => {
        render(<DashboardPage session={makeSession()} onOpenWorkspace={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Choose file' })).toBeEnabled()
    })

    it('hands a chosen file to the session', () => {
        const loadFile = vi.fn().mockResolvedValue(undefined)
        const file = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' })
        render(
            <DashboardPage
                session={makeSession({ loadFile })}
                onOpenWorkspace={vi.fn()}
            />,
        )
        fireEvent.change(screen.getByLabelText('Choose a spreadsheet file'), {
            target: { files: [file] },
        })
        expect(loadFile).toHaveBeenCalledWith(file)
    })

    it('lists all six cleaning capabilities', () => {
        render(<DashboardPage session={makeSession()} onOpenWorkspace={vi.fn()} />)
        const titles = [
            'Remove duplicates',
            'Handle missing values',
            'Clean text',
            'Standardize dates',
            'Reshape columns',
            'Preview, undo, export',
        ]
        for (const title of titles) {
            expect(
                screen.getByRole('heading', { level: 3, name: title }),
            ).toBeInTheDocument()
        }
    })

    it('shows the privacy and scope notes', () => {
        render(<DashboardPage session={makeSession()} onOpenWorkspace={vi.fn()} />)
        expect(
            screen.getByRole('heading', { name: 'Privacy-first by design' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', { name: 'One worksheet at a time' }),
        ).toBeInTheDocument()
    })

    it('shows no file summary until a spreadsheet is loaded', () => {
        render(<DashboardPage session={makeSession()} onOpenWorkspace={vi.fn()} />)
        expect(screen.queryByRole('region', { name: 'Loaded spreadsheet' })).toBeNull()
    })

    it('shows the loaded spreadsheet and opens the workspace', () => {
        const onOpenWorkspace = vi.fn()
        render(
            <DashboardPage
                session={makeSession({ status: 'ready', summary: makeSummary() })}
                onOpenWorkspace={onOpenWorkspace}
            />,
        )
        expect(
            screen.getByRole('region', { name: 'Loaded spreadsheet' }),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open cleaning workspace' }))
        expect(onOpenWorkspace).toHaveBeenCalledTimes(1)
    })
})