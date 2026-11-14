import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Remove rendered components from the simulated page after every test
afterEach(() => {
    cleanup()
})