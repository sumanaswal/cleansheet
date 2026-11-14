import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'

describe('test setup', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('renders a component through the @/ alias', () => {
    render(<Button>Hello</Button>)
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
  })
})