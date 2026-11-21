// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { resolveColumnIndexes } from '@/engine/operations/columns'
import { OperationError } from '@/engine/operations/types'
import type { Dataset } from '@/engine/types'

const data: Dataset = {
    columns: [
        { id: 'c1', name: 'Name' },
        { id: 'c2', name: 'Name' },
        { id: 'c3', name: 'City' },
    ],
    rows: [],
}

describe('resolveColumnIndexes', () => {
    it('returns the positions in column order, whatever order they were chosen in', () => {
        expect(resolveColumnIndexes(data, ['c3', 'c1'], 'Choose one.')).toEqual([0, 2])
    })

    it('counts a column chosen twice only once', () => {
        expect(resolveColumnIndexes(data, ['c2', 'c2', 'c2'], 'Choose one.')).toEqual([1])
    })

    it('refuses an empty choice, with the message it was given', () => {
        expect(() => resolveColumnIndexes(data, [], 'Choose one.')).toThrow(OperationError)
        expect(() => resolveColumnIndexes(data, [], 'Choose one.')).toThrow('Choose one.')
    })

    it('refuses a column that no longer exists', () => {
        expect(() => resolveColumnIndexes(data, ['c1', 'c9'], 'Choose one.')).toThrow(
            /no longer exists/,
        )
    })
})