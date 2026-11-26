import { resolveColumnIndexes } from '@/engine/operations/columns'
import { OperationError } from '@/engine/operations/types'
import type { ColumnId, Dataset, Row } from '@/engine/types'

export type TextCase = 'none' | 'upper' | 'lower' | 'title'

/** What to do to the text. The rules run in a fixed order, whatever is ticked. */
export interface TextRules {
    /**
     * Remove control characters (not tabs or line breaks), the delete character,
     * the zero-width space, the word joiner, the soft hyphen and the byte order
     * mark. The zero-width joiner and non-joiner and the left-to-right and
     * right-to-left marks are kept: scripts such as Hindi and Persian need them.
     */
    readonly removeNonPrinting: boolean
    /** Replace each line break inside a cell with a space. */
    readonly lineBreaksToSpace: boolean
    /** Remove all whitespace, line breaks included, at the start and end. */
    readonly trimEnds: boolean
    /**
     * Turn each run of spaces, tabs and non-breaking spaces into one normal
     * space. Line breaks are not touched.
     */
    readonly collapseSpaces: boolean
    readonly textCase: TextCase
    /** Leave a cell that is only an email or web address in its original case. */
    readonly keepAddressCase: boolean
}

export const DEFAULT_TEXT_RULES: TextRules = {
    removeNonPrinting: true,
    lineBreaksToSpace: false,
    trimEnds: true,
    collapseSpaces: true,
    textCase: 'none',
    keepAddressCase: true,
}

export interface TextCleaningOptions extends TextRules {
    /** Columns to clean. Leave a column out to ignore it. */
    readonly columnIds: readonly ColumnId[]
}

export type TextRule = 'nonPrinting' | 'trim' | 'lineBreaks' | 'collapse' | 'textCase'

export type TextRuleFlags = Record<TextRule, boolean>
export type TextRuleCounts = Record<TextRule, number>

const RULES: readonly TextRule[] = [
    'nonPrinting',
    'trim',
    'lineBreaks',
    'collapse',
    'textCase',
]

export interface CleanedText {
    /** The cleaned text, or null when nothing is left of it. */
    readonly text: string | null
    readonly changed: boolean
    /** Which rules changed the text, judged on what the earlier rules left. */
    readonly changedBy: TextRuleFlags
    /** How many characters the non-printing rule removed. */
    readonly removedChars: number
    /** The case rule would have changed the text, but it is an email or web address. */
    readonly keptAddress: boolean
}

const LINE_BREAKS = /\r\n|[\r\n\u2028\u2029]/g
// Whitespace other than line breaks: spaces, tabs, non-breaking spaces and so on.
const HORIZONTAL_SPACE = /[^\S\r\n\u2028\u2029]+/g
// A letter at the start, or after whitespace, a slash, an opening bracket or a hyphen.
const WORD_START = /(^|[\s/([{-])(\p{L})/gu
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEB_ADDRESS = /^(?:https?:\/\/|ftp:\/\/|www\.)\S+$/i

function isNonPrinting(code: number): boolean {
    // Control characters, except tab, line feed and carriage return.
    if (code <= 0x1f) return code !== 0x09 && code !== 0x0a && code !== 0x0d
    // The delete character and the C1 control characters.
    if (code >= 0x7f && code <= 0x9f) return true
    // Soft hyphen, zero-width space, word joiner and byte order mark.
    return code === 0x00ad || code === 0x200b || code === 0x2060 || code === 0xfeff
}

function removeNonPrinting(text: string): { text: string; removed: number } {
    const parts: string[] = []
    let start = 0
    let removed = 0
    for (let i = 0; i < text.length; i += 1) {
        if (isNonPrinting(text.charCodeAt(i))) {
            parts.push(text.slice(start, i))
            start = i + 1
            removed += 1
        }
    }
    if (removed === 0) return { text, removed: 0 }
    parts.push(text.slice(start))
    return { text: parts.join(''), removed }
}

function titleCase(text: string): string {
    return text
        .toLowerCase()
        .replace(WORD_START, (_match: string, separator: string, letter: string) => {
            return separator + letter.toUpperCase()
        })
}

function applyCase(text: string, mode: TextCase): string {
    switch (mode) {
        case 'upper':
            return text.toUpperCase()
        case 'lower':
            return text.toLowerCase()
        case 'title':
            return titleCase(text)
        case 'none':
            return text
    }
}

function looksLikeAddress(text: string): boolean {
    return EMAIL.test(text) || WEB_ADDRESS.test(text)
}

/**
 * Cleans one piece of text. The rules run in this order: remove non-printing
 * characters, trim the ends, replace line breaks, collapse spaces, change case.
 */
export function cleanText(original: string, rules: TextRules): CleanedText {
    let text = original
    let removedChars = 0
    const changedBy: TextRuleFlags = {
        nonPrinting: false,
        trim: false,
        lineBreaks: false,
        collapse: false,
        textCase: false,
    }

    if (rules.removeNonPrinting) {
        const result = removeNonPrinting(text)
        text = result.text
        removedChars = result.removed
        changedBy.nonPrinting = result.removed > 0
    }
    if (rules.trimEnds) {
        const next = text.trim()
        changedBy.trim = next !== text
        text = next
    }
    if (rules.lineBreaksToSpace) {
        const next = text.replace(LINE_BREAKS, ' ')
        changedBy.lineBreaks = next !== text
        text = next
    }
    if (rules.collapseSpaces) {
        const next = text.replace(HORIZONTAL_SPACE, ' ')
        changedBy.collapse = next !== text
        text = next
    }

    let keptAddress = false
    if (rules.textCase !== 'none') {
        const cased = applyCase(text, rules.textCase)
        if (cased !== text) {
            if (rules.keepAddressCase && looksLikeAddress(text)) {
                keptAddress = true
            } else {
                text = cased
                changedBy.textCase = true
            }
        }
    }

    return {
        text: text === '' ? null : text,
        changed: text !== original,
        changedBy,
        removedChars,
        keptAddress,
    }
}

export interface TextColumnPlan {
    readonly columnId: ColumnId
    /** Position of the column in the dataset. */
    readonly columnIndex: number
    /** Cells with text in them. Empty cells are not counted. */
    readonly textCells: number
    /** Numbers, true/false and dates. These are never changed. */
    readonly nonTextCells: number
    /** Text cells that would change. */
    readonly changedCount: number
    /** Cells changed by each rule. A cell can be counted under several rules. */
    readonly ruleCounts: TextRuleCounts
    /** Characters the non-printing rule would remove. */
    readonly removedChars: number
    /** Cells left in their original case because they are email or web addresses. */
    readonly keptAddressCount: number
}

export interface TextPlan {
    readonly totalRows: number
    /** One entry per chosen column, in column order. */
    readonly columns: readonly TextColumnPlan[]
    readonly textCells: number
    readonly nonTextCells: number
    readonly changedCells: number
    readonly removedChars: number
    readonly keptAddresses: number
    /**
     * The cells that would change, as two lists of the same length in row order,
     * then column order. Position of the row, position of the column.
     */
    readonly cellRows: readonly number[]
    readonly cellColumns: readonly number[]
}

interface ColumnStat {
    textCells: number
    nonTextCells: number
    changed: number
    rules: TextRuleCounts
    removedChars: number
    keptAddresses: number
}

function hasActiveRule(rules: TextRules): boolean {
    return (
        rules.removeNonPrinting ||
        rules.lineBreaksToSpace ||
        rules.trimEnds ||
        rules.collapseSpaces ||
        rules.textCase !== 'none'
    )
}

function emptyCounts(): TextRuleCounts {
    return { nonPrinting: 0, trim: 0, lineBreaks: 0, collapse: 0, textCase: 0 }
}

/**
 * Works out what the cleaning would do without changing anything. Only text
 * cells are looked at. Numbers, true/false and dates are never changed.
 * Throws an OperationError, with a message for the user, when the settings
 * cannot be used.
 */
export function planTextCleaning(
    dataset: Dataset,
    options: TextCleaningOptions,
): TextPlan {
    const indexes = resolveColumnIndexes(
        dataset,
        options.columnIds,
        'Choose at least one column to clean.',
    )
    if (!hasActiveRule(options)) {
        throw new OperationError('Choose at least one cleaning option.')
    }

    const stats: ColumnStat[] = indexes.map(() => ({
        textCells: 0,
        nonTextCells: 0,
        changed: 0,
        rules: emptyCounts(),
        removedChars: 0,
        keptAddresses: 0,
    }))
    const cellRows: number[] = []
    const cellColumns: number[] = []

    for (const [rowIndex, row] of dataset.rows.entries()) {
        for (const [k, columnIndex] of indexes.entries()) {
            const stat = stats[k]
            if (stat === undefined) continue
            const cell = row.cells[columnIndex] ?? null
            if (cell === null || cell === '') continue
            if (typeof cell !== 'string') {
                stat.nonTextCells += 1
                continue
            }
            stat.textCells += 1
            const cleaned = cleanText(cell, options)
            stat.removedChars += cleaned.removedChars
            if (cleaned.keptAddress) stat.keptAddresses += 1
            if (!cleaned.changed) continue
            stat.changed += 1
            for (const rule of RULES) {
                if (cleaned.changedBy[rule]) stat.rules[rule] += 1
            }
            cellRows.push(rowIndex)
            cellColumns.push(columnIndex)
        }
    }

    const columns: TextColumnPlan[] = []
    let textCells = 0
    let nonTextCells = 0
    let removedChars = 0
    let keptAddresses = 0
    for (const [k, columnIndex] of indexes.entries()) {
        const stat = stats[k]
        const column = dataset.columns[columnIndex]
        if (stat === undefined || column === undefined) continue
        textCells += stat.textCells
        nonTextCells += stat.nonTextCells
        removedChars += stat.removedChars
        keptAddresses += stat.keptAddresses
        columns.push({
            columnId: column.id,
            columnIndex,
            textCells: stat.textCells,
            nonTextCells: stat.nonTextCells,
            changedCount: stat.changed,
            ruleCounts: stat.rules,
            removedChars: stat.removedChars,
            keptAddressCount: stat.keptAddresses,
        })
    }

    return {
        totalRows: dataset.rows.length,
        columns,
        textCells,
        nonTextCells,
        changedCells: cellRows.length,
        removedChars,
        keptAddresses,
        cellRows,
        cellColumns,
    }
}

/**
 * Returns the dataset with its text cleaned. Rows that are not touched are the
 * same objects as before, and nothing is reordered. A cell with nothing left
 * in it becomes empty (null). When there is nothing to change, the same
 * dataset is returned.
 */
export function applyTextCleaning(
    dataset: Dataset,
    options: TextCleaningOptions,
): Dataset {
    const plan = planTextCleaning(dataset, options)
    if (plan.changedCells === 0) return dataset

    const width = dataset.columns.length
    const rows: Row[] = dataset.rows.slice()
    let i = 0
    while (i < plan.cellRows.length) {
        const rowIndex = plan.cellRows[i]
        const original = rowIndex === undefined ? undefined : dataset.rows[rowIndex]
        if (rowIndex === undefined || original === undefined) {
            i += 1
            continue
        }
        const cells = original.cells.slice()
        while (cells.length < width) cells.push(null)
        while (i < plan.cellRows.length && plan.cellRows[i] === rowIndex) {
            const columnIndex = plan.cellColumns[i]
            const old = columnIndex === undefined ? undefined : cells[columnIndex]
            if (columnIndex !== undefined && typeof old === 'string') {
                cells[columnIndex] = cleanText(old, options).text
            }
            i += 1
        }
        rows[rowIndex] = { sourceRow: original.sourceRow, cells }
    }
    return { columns: dataset.columns, rows }
}