// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ImportError } from '@/engine/io/types'
import {
  formatBytes,
  IMPORT_LIMITS,
  validateDatasetLimits,
  validateFile,
} from '@/engine/io/validation'
import type { Dataset } from '@/engine/types'

const csvHead = new TextEncoder().encode('a,b\n1,2')
const zipHead = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
const oleHead = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

function makeDataset(columnCount: number, rowCount: number): Dataset {
  return {
    columns: Array.from({ length: columnCount }, (_, i) => ({
      id: `c${i + 1}`,
      name: `Column ${i + 1}`,
    })),
    rows: Array.from({ length: rowCount }, (_, i) => ({
      sourceRow: i + 2,
      cells: [],
    })),
  }
}

describe('validateFile', () => {
  it('accepts a csv file', () => {
    expect(validateFile('data.csv', 100, csvHead)).toBe('csv')
  })

  it('accepts an xlsx file and ignores capitalisation of the extension', () => {
    expect(validateFile('Report.XLSX', 5000, zipHead)).toBe('xlsx')
  })

  it('rejects an empty file', () => {
    expect(() => validateFile('data.csv', 0, new Uint8Array())).toThrow(
      'The file is empty.',
    )
  })

  it('rejects a file over the size limit and states both sizes', () => {
    const size = IMPORT_LIMITS.maxFileSizeBytes + 1
    expect(() => validateFile('big.csv', size, csvHead)).toThrow(
      /over the 10\.00 MB limit/,
    )
  })

  it('accepts a file exactly at the size limit', () => {
    expect(
      validateFile('edge.csv', IMPORT_LIMITS.maxFileSizeBytes, csvHead),
    ).toBe('csv')
  })

  it.each(['xls', 'xlsm', 'xlsb', 'ods'])(
    'explains how to convert .%s files',
    (extension) => {
      expect(() => validateFile(`old.${extension}`, 100, oleHead)).toThrow(
        new RegExp(`\\.${extension} files are not supported directly`),
      )
    },
  )

  it('rejects other file types', () => {
    expect(() => validateFile('notes.pdf', 100, csvHead)).toThrow(
      /\.pdf files are not supported/,
    )
  })

  it('rejects a file with no extension', () => {
    expect(() => validateFile('README', 100, csvHead)).toThrow(/no extension/)
  })

  it('rejects an .xlsx file that is not a ZIP archive', () => {
    expect(() => validateFile('fake.xlsx', 100, csvHead)).toThrow(
      /damaged, or it may not really be/,
    )
  })

  it('explains that a password-protected or old-format .xlsx cannot be read', () => {
    expect(() => validateFile('locked.xlsx', 100, oleHead)).toThrow(
      /password-protected/,
    )
  })

  it('rejects a .csv file that is really an Excel workbook', () => {
    expect(() => validateFile('renamed.csv', 100, zipHead)).toThrow(
      /looks like an Excel workbook/,
    )
    expect(() => validateFile('renamed.csv', 100, oleHead)).toThrow(ImportError)
  })
})

describe('formatBytes', () => {
  it('uses a readable unit', () => {
    expect(formatBytes(1)).toBe('1 byte')
    expect(formatBytes(500)).toBe('500 bytes')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.00 MB')
  })
})

describe('validateDatasetLimits', () => {
  it('accepts a dataset exactly at the limits', () => {
    expect(() =>
      validateDatasetLimits(
        makeDataset(IMPORT_LIMITS.maxColumns, IMPORT_LIMITS.maxRows),
      ),
    ).not.toThrow()
  })

  it('rejects too many columns and states the counts', () => {
    expect(() =>
      validateDatasetLimits(makeDataset(IMPORT_LIMITS.maxColumns + 1, 1)),
    ).toThrow('The sheet has 101 columns. CleanSheet currently supports up to 100 columns.')
  })

  it('rejects too many rows and states the counts', () => {
    expect(() =>
      validateDatasetLimits(makeDataset(2, IMPORT_LIMITS.maxRows + 1)),
    ).toThrow('The sheet has 50,001 data rows. CleanSheet currently supports up to 50,000 rows.')
  })
})