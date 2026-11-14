// @vitest-environment node
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

// These tests document what we rely on from the SheetJS library.
// If one fails after a library upgrade, the cleaning engine's
// data-integrity assumptions need to be revisited.

function roundTrip(ws: XLSX.WorkSheet): XLSX.WorkSheet {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const bytes: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const loaded = XLSX.read(bytes, { type: 'array' })
    const name = loaded.SheetNames[0]
    if (name === undefined) throw new Error('Workbook has no sheets')
    const sheet = loaded.Sheets[name]
    if (sheet === undefined) throw new Error('Sheet not found')
    return sheet
}

function cell(ws: XLSX.WorkSheet, address: string): XLSX.CellObject {
    const found = ws[address] as XLSX.CellObject | undefined
    if (found === undefined) throw new Error(`No cell at ${address}`)
    return found
}

describe('SheetJS behaviour the engine relies on', () => {
    it('keeps text identifiers with leading zeros as text', () => {
        const ws = XLSX.utils.aoa_to_sheet([['ID'], ['00123']])
        const c = cell(roundTrip(ws), 'A2')
        expect(c.t).toBe('s')
        expect(c.v).toBe('00123')
    })

    it('keeps the raw number and the formatted text of a formatted number', () => {
        const ws: XLSX.WorkSheet = {
            A1: { t: 'n', v: 123, z: '00000' },
            '!ref': 'A1:A1',
        }
        const c = cell(roundTrip(ws), 'A1')
        expect(c.t).toBe('n')
        expect(c.v).toBe(123)
        expect(c.w).toBe('00123')
    })

    it('keeps a date cell as a raw Excel serial number', () => {
        const ws: XLSX.WorkSheet = {
            A1: { t: 'n', v: 46000, z: 'dd-mm-yyyy' },
            '!ref': 'A1:A1',
        }
        const c = cell(roundTrip(ws), 'A1')
        expect(c.t).toBe('n')
        expect(c.v).toBe(46000)
        expect(c.w).toBe('09-12-2025')
    })

    it('keeps zero and false as real values', () => {
        const ws: XLSX.WorkSheet = {
            A1: { t: 'n', v: 0 },
            B1: { t: 'b', v: false },
            '!ref': 'A1:B1',
        }
        const out = roundTrip(ws)
        expect(cell(out, 'A1').v).toBe(0)
        expect(cell(out, 'B1').v).toBe(false)
    })
})