// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { TextRules } from '@/engine/operations/textCleaning'
import { OperationError } from '@/engine/operations/types'
import type { CellValue, Dataset } from '@/engine/types'
import {
  applyToDataset,
  buildPreview,
  countChangedCells,
} from '@/workers/operations'
import type { OperationSpec } from '@/workers/protocol'

const NONE: TextRules = {
  removeNonPrinting: false,
  lineBreaksToSpace: false,
  trimEnds: false,
  collapseSpaces: false,
  textCase: 'none',
  keepAddressCase: true,
}

const TIDY: Partial<TextRules> = {
  trimEnds: true,
  collapseSpaces: true,
  textCase: 'title',
}

function text(columnIds: string[], overrides: Partial<TextRules> = {}): OperationSpec {
  return { kind: 'text', options: { ...NONE, ...overrides, columnIds } }
}

function dataset(names: string[], rows: CellValue[][]): Dataset {
  return {
    columns: names.map((name, i) => ({ id: `c${i + 1}`, name })),
    rows: rows.map((cells, i) => ({ sourceRow: i + 2, cells })),
  }
}

const ALL = ['c1', 'c2', 'c3']
const date: CellValue = { kind: 'date', serial: 1, text: '1' }

// Row numbers 2 to 6.
const people = dataset(
  ['Name', 'Qty', 'Email'],
  [
    ['  asha   singh ', 5, 'ASHA@X.COM'],
    ['RAVI', 7, ' ravi@x.com'],
    [null, 0, '\u200B'],
    ['Zoe', true, 'zoe'],
    ['  ', date, 'Zoe'],
  ],
)

describe('buildPreview: text cleaning', () => {
  const preview = buildPreview(people, text(ALL, TIDY))

  it('summarises the cleaning', () => {
    expect(preview.summary).toMatchObject({
      totalRows: 5,
      removedRows: 0,
      retainedRows: 5,
      skippedRows: 0,
      itemCount: 5,
    })
    expect(preview.summary.text).toMatchObject({
      textCells: 9,
      nonTextCells: 5,
      changedCells: 5,
      removedChars: 0,
      keptAddresses: 2,
    })
    expect(preview.summary.missing).toBeUndefined()
  })

  it('reports each chosen column', () => {
    const columns = preview.summary.text?.columns ?? []
    expect(
      columns.map((c) => [c.position, c.name, c.textCells, c.nonTextCells, c.changedCount]),
    ).toEqual([
      [1, 'Name', 4, 0, 3],
      [2, 'Qty', 0, 5, 0],
      [3, 'Email', 5, 0, 2],
    ])
    expect(columns[0]?.ruleCounts).toEqual({
      nonPrinting: 0,
      trim: 2,
      lineBreaks: 0,
      collapse: 1,
      textCase: 2,
    })
    expect(columns[2]?.keptAddressCount).toBe(2)
  })

  it('lists each cell with its old and new text', () => {
    expect(preview.items(0, 10)).toEqual([
      {
        kind: 'changedText',
        row: people.rows[0],
        columnPosition: 1,
        columnName: 'Name',
        oldText: '  asha   singh ',
        newText: 'Asha Singh',
      },
      {
        kind: 'changedText',
        row: people.rows[1],
        columnPosition: 1,
        columnName: 'Name',
        oldText: 'RAVI',
        newText: 'Ravi',
      },
      {
        kind: 'changedText',
        row: people.rows[1],
        columnPosition: 3,
        columnName: 'Email',
        oldText: ' ravi@x.com',
        newText: 'ravi@x.com',
      },
      {
        kind: 'changedText',
        row: people.rows[3],
        columnPosition: 3,
        columnName: 'Email',
        oldText: 'zoe',
        newText: 'Zoe',
      },
      {
        kind: 'changedText',
        row: people.rows[4],
        columnPosition: 1,
        columnName: 'Name',
        oldText: '  ',
        newText: null,
      },
    ])
  })

  it('lists the cells a page at a time', () => {
    const describe = (offset: number, limit: number) =>
      preview
        .items(offset, limit)
        .map((item) =>
          item.kind === 'changedText' ? [item.row.sourceRow, item.columnName] : null,
        )
    expect(describe(1, 2)).toEqual([
      [3, 'Name'],
      [3, 'Email'],
    ])
    expect(describe(4, 10)).toEqual([[6, 'Name']])
    expect(describe(5, 10)).toEqual([])
  })

  it('marks the cells that would change, row by row, for any range of rows', () => {
    expect(preview.cellMarks(0, 5)).toEqual([[0], [0, 2], [], [2], [0]])
    expect(preview.cellMarks(3, 2)).toEqual([[2], [0]])
    expect(preview.cellMarks(2, 1)).toEqual([[]])
    expect(preview.cellMarkKind).toBe('change')
  })

  it('does not mark whole rows', () => {
    expect(preview.marksRows).toBe(false)
    expect([0, 1, 2, 3, 4].map((index) => preview.mark(index))).toEqual([
      null, null, null, null, null,
    ])
  })

  it('counts the characters that would be removed', () => {
    const noisy = dataset(['v'], [['a\u200Bb\u200B'], ['c\u0000'], ['d']])
    const result = buildPreview(noisy, text(['c1'], { removeNonPrinting: true }))
    expect(result.summary.text).toMatchObject({ removedChars: 3, changedCells: 2 })
    expect(result.items(0, 10).map((item) => item.kind === 'changedText' && item.newText)).toEqual([
      'ab',
      'c',
    ])
  })

  it('does not change the dataset', () => {
    const before = JSON.stringify(people)
    buildPreview(people, text(ALL, TIDY)).items(0, 10)
    expect(JSON.stringify(people)).toBe(before)
  })

  it('still reports that fills and duplicate removal mean the usual thing', () => {
    const fill = buildPreview(people, {
      kind: 'missing',
      options: {
        columnIds: ['c1'],
        placeholders: [],
        action: { kind: 'fill', value: 'x' },
      },
    })
    expect(fill.cellMarkKind).toBe('fill')
    expect(fill.summary.text).toBeUndefined()
  })
})

describe('applyToDataset: text cleaning', () => {
  it('cleans the text and leaves numbers, true/false, dates and untouched rows alone', () => {
    const result = applyToDataset(people, text(ALL, TIDY))
    expect(result.rows.map((row) => row.cells)).toEqual([
      ['Asha Singh', 5, 'ASHA@X.COM'],
      ['Ravi', 7, 'ravi@x.com'],
      [null, 0, '\u200B'],
      ['Zoe', true, 'Zoe'],
      [null, date, 'Zoe'],
    ])
    expect(result.rows[2]).toBe(people.rows[2])
  })

  it('returns the same dataset when there is nothing to change', () => {
    const data = dataset(['v'], [['Asha'], [3]])
    expect(applyToDataset(data, text(['c1'], TIDY))).toBe(data)
  })

  it('refuses settings that cannot be used', () => {
    expect(() => buildPreview(people, text([], TIDY))).toThrow(OperationError)
    expect(() => buildPreview(people, text(ALL))).toThrow(
      'Choose at least one cleaning option.',
    )
    expect(() => applyToDataset(people, text([], TIDY))).toThrow(
      'Choose at least one column to clean.',
    )
  })
})

describe('countChangedCells: text cleaning', () => {
  it('counts the cells that cleaning changed, the same number the preview lists', () => {
    const after = applyToDataset(people, text(ALL, TIDY))
    expect(countChangedCells(people, after)).toBe(5)
    expect(buildPreview(people, text(ALL, TIDY)).summary.itemCount).toBe(5)
  })

  it('counts a cell that was cleaned down to nothing', () => {
    const data = dataset(['v'], [['   ']])
    const after = applyToDataset(data, text(['c1'], { trimEnds: true }))
    expect(after.rows[0]?.cells).toEqual([null])
    expect(countChangedCells(data, after)).toBe(1)
  })
})