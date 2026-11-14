import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HelpPage } from '@/pages/HelpPage'

describe('HelpPage', () => {
    it('shows the heading and the main sections', () => {
        render(<HelpPage />)
        expect(
            screen.getByRole('heading', { level: 1, name: 'About / Help' }),
        ).toBeInTheDocument()
        for (const name of [
            'How it works',
            'What CleanSheet does not preserve',
            'Privacy by design',
            'Data integrity principles',
        ]) {
            expect(
                screen.getByRole('heading', { level: 2, name }),
            ).toBeInTheDocument()
        }
    })

    it('lists the five workflow steps and the integrity principles', () => {
        render(<HelpPage />)
        expect(screen.getAllByRole('listitem')).toHaveLength(5 + 6)
    })
})