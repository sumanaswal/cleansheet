// Creates test spreadsheets in private-data/ (ignored by git, never committed).
// Run from the project root:  node scripts/make-test-files.mjs
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const OUT = 'private-data'
mkdirSync(OUT, { recursive: true })

const HEADER = ['Employee ID', 'Name', 'City', 'Joined', 'Phone', 'Notes']
const CITIES = ['Delhi', 'Mumbai', 'Pune', 'Chennai', 'Kolkata']

function makeRows(count) {
    const rows = []
    for (let i = 1; i <= count; i += 1) {
        let name = `Employee ${i}`
        if (i % 50 === 0) name = `Singh, Employee ${i}`
        if (i % 97 === 0) name = `Employee "${i}"`
        let note = `Note ${i}`
        if (i % 7 === 0) note = ''
        else if (i % 11 === 0) note = 'N/A'
        else if (i % 101 === 0) note = 'line one\nline two'
        rows.push([
            String(i).padStart(6, '0'), // leading zeros, as text
            name,
            CITIES[i % CITIES.length],
            `${String((i % 28) + 1).padStart(2, '0')}/${String((i % 12) + 1).padStart(2, '0')}/2024`,
            `98${String(10_000_000 + i).slice(-8)}`,
            note,
        ])
    }
    return rows
}

function csvCell(value) {
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function writeCsv(name, rows, header = HEADER) {
    const lines = [header, ...rows].map((row) => row.map(csvCell).join(','))
    writeFileSync(`${OUT}/${name}`, lines.join('\r\n') + '\r\n')
}

function writeXlsx(name, sheets) {
    const book = XLSX.utils.book_new()
    for (const [sheetName, sheet] of sheets) {
        XLSX.utils.book_append_sheet(book, sheet, sheetName)
    }
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
    writeFileSync(`${OUT}/${name}`, Buffer.from(bytes))
}

// Valid files
for (const count of [100, 5000, 25000, 50000]) {
    writeCsv(`csv-${count}.csv`, makeRows(count))
}
for (const count of [5000, 50000]) {
    writeXlsx(`xlsx-${count}.xlsx`, [
        ['Staff', XLSX.utils.aoa_to_sheet([HEADER, ...makeRows(count)])],
    ])
}

// A workbook with two sheets, numbers formatted as 00000, date cells,
// a formula column, a thousands format, zero, false and a whitespace cell.
const staff = {
    A1: { t: 's', v: 'Employee ID' },
    B1: { t: 's', v: 'Joined' },
    C1: { t: 's', v: 'Salary' },
    D1: { t: 's', v: 'Double ID' },
    '!ref': 'A1:D101',
}
for (let i = 1; i <= 100; i += 1) {
    const row = i + 1
    staff[`A${row}`] = { t: 'n', v: i, z: '00000' }
    staff[`B${row}`] = { t: 'n', v: 45000 + i, z: 'dd-mm-yyyy' }
    staff[`C${row}`] = { t: 'n', v: 30000 + i * 10.5, z: '#,##0.00' }
    staff[`D${row}`] = { t: 'n', v: i * 2, f: `A${row}*2` }
}
writeXlsx('mixed-types.xlsx', [
    ['Staff', staff],
    ['Notes', XLSX.utils.aoa_to_sheet([['Value'], [0], [false], ['   ']])],
])

// Files that CleanSheet must reject with a clear message
writeFileSync(`${OUT}/empty.csv`, '')
writeFileSync(`${OUT}/notes.txt`, 'hello')
writeFileSync(`${OUT}/not-really.xlsx`, 'a,b\n1,2')
writeFileSync(`${OUT}/unclosed-quote.csv`, 'a,b\n"oops,2\n3,4\n')
writeFileSync(`${OUT}/too-many-rows.csv`, 'n\n' + '1\n'.repeat(50_001))
writeFileSync(
    `${OUT}/too-many-columns.csv`,
    Array.from({ length: 101 }, (_, i) => `c${i + 1}`).join(',') +
    '\n' +
    Array.from({ length: 101 }, () => '1').join(',') +
    '\n',
)
writeFileSync(
    `${OUT}/too-big.csv`,
    'a\n' + Array.from({ length: 110_000 }, () => 'x'.repeat(100)).join('\n'),
)

for (const name of readdirSync(OUT).sort()) {
    const kb = (statSync(`${OUT}/${name}`).size / 1024).toFixed(1)
    console.log(`${name.padEnd(24)} ${kb} KB`)
}