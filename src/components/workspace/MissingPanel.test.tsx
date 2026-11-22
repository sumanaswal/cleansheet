import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MissingPanel } from '@/components/workspace/MissingPanel'
import { PLACEHOLDER_WORDS } from '@/engine/profiling/missing'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import { makeSession, makeSummary } from '@/test/session'
import type { PreviewPage } from '@/workers/importClient'
import type {
    DatasetSummary,
    MissingPreviewColumn,
    OperationPreviewSummary,
    OperationSpec,
} from '@/workers/protocol'

const columns = [
    { id: 'c1', name: 'Name' },
    { id: 'c2', name: 'City' },
    { id: 'c3', name: 'Phone' },
]
const initial = makeSummary({ columns, rowCount: 5 })
const after = makeSummary({ columns, rowCount: 3 })

function previewColumn(
    overrides: Partial<MissingPreviewColumn> & Pick<MissingPreviewColumn, 'columnId' | 'position' | 'name'>,
): MissingPreviewColumn {
    return {
        missingCount: 0,
        placeholderCount: 0,
        affectedCount: 0,
        insertAs: null,
        dateColumn: false,
        ...overrides,
    }
}

const fillPreview: OperationPreviewSummary = {
    totalRows: 5,
    removedRows: 0,
    retainedRows: 5,
    skippedRows: 0,
    itemCount: 4,
    missing: {
        action: 'fill',
        fillValue: '0',
        missingCells: 3,
        placeholderCells: 1,
        filledCells: 4,
        columns: [
            previewColumn({
                columnId: 'c1',
                position: 1,
                name: 'Name',
                missingCount: 2,
                placeholderCount: 1,
                affectedCount: 3,
                insertAs: 'text',
            }),
            previewColumn({
                columnId: 'c2',
                position: 2,
                name: 'City',
                missingCount: 1,
                affectedCount: 1,
                insertAs: 'number',
            }),
        ],
    },
}

const removePreview: OperationPreviewSummary = {
    totalRows: 5,
    removedRows: 2,
    retainedRows: 3,
    skippedRows: 0,
    itemCount: 2,
    missing: {
        action: 'removeRows',
        fillValue: null,
        missingCells: 3,
        placeholderCells: 0,
        filledCells: 0,
        columns: [
            previewColumn({
                columnId: 'c1',
                position: 1,
                name: 'Name',
                missingCount: 2,
                affectedCount: 2,
            }),
        ],
    },
}

const nothingPreview: OperationPreviewSummary = {
    totalRows: 5,
    removedRows: 0,
    retainedRows: 5,
    skippedRows: 0,
    itemCount: 0,
    missing: {
        action: 'fill',
        fillValue: '0',
        missingCells: 0,
        placeholderCells: 0,
        filledCells: 0,
        columns: [],
    },
}

const fillRecords: PreviewPage = {
    offset: 0,
    itemCount: 4,
    items: [
        {
            kind: 'filledCell',
            row: { sourceRow: 3, cells: [null, 'Pune', null] },
            columnPosition: 1,
            columnName: 'Name',
            oldValue: null,
            newValue: '0',
        },
        {
            kind: 'filledCell',
            row: { sourceRow: 4, cells: ['Ravi', ' ', null] },
            columnPosition: 2,
            columnName: 'City',
            oldValue: ' ',
            newValue: 0,
        },
    ],
}

const removeRecords: PreviewPage = {
    offset: 0,
    itemCount: 2,
    items: [
        {
            kind: 'removedMissingRow',
            row: { sourceRow: 3, cells: [null, 'Pune', null] },
            missingColumns: [{ position: 1, name: 'Name' }],
        },
    ],
}

function fillSpec(overrides: Partial<{ columnIds: string[]; placeholders: string[]; value: string }> = {}): OperationSpec {
    return {
        kind: 'missing',
        options: {
            columnIds: overrides.columnIds ?? ['c1', 'c2', 'c3'],
            placeholders: overrides.placeholders ?? [],
            action: { kind: 'fill', value: overrides.value ?? '0' },
        },
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

/** Mimics the real session: applying an operation replaces the summary. */
function Harness(props: {
    session: SpreadsheetSession
    onClose: () => void
    onPreviewChange: () => void
}) {
    const [summary, setSummary] = useState<DatasetSummary>(initial)
    const wired: SpreadsheetSession = {
        ...props.session,
        applyOperation: async (operation) => {
            const result = await props.session.applyOperation(operation)
            setSummary(result.summary)
            return result
        },
    }
    return (
        <MissingPanel
            session={wired}
            summary={summary}
            onClose={props.onClose}
            onPreviewChange={props.onPreviewChange}
        />
    )
}

function setup(overrides: Partial<SpreadsheetSession> = {}) {
    const session = makeSession({
        status: 'ready',
        summary: initial,
        previewOperation: vi.fn().mockResolvedValue(fillPreview),
        getPreviewPage: vi.fn().mockResolvedValue(fillRecords),
        applyOperation: vi.fn().mockResolvedValue({
            summary: after,
            removedRows: 0,
            filledCells: 4,
            historyDepth: 1,
        }),
        ...overrides,
    })
    const onClose = vi.fn()
    const onPreviewChange = vi.fn()
    const view = render(
        <Harness session={session} onClose={onClose} onPreviewChange={onPreviewChange} />,
    )
    return { session, onClose, onPreviewChange, ...view }
}

function typeValue(value: string): void {
    fireEvent.change(screen.getByRole('textbox', { name: 'Value to insert' }), {
        target: { value },
    })
}

async function runFillPreview() {
    typeValue('0')
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    await screen.findByRole('region', { name: 'Preview' })
}

/** The value shown next to a figure label in the preview. */
function figure(label: string): Element | null {
    return screen.getByText(label).nextElementSibling
}

function cellTexts(row: HTMLElement): (string | null)[] {
    return within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
}

describe('MissingPanel: settings', () => {
    it('starts on filling, with every column chosen and no placeholder chosen', () => {
        setup()
        expect(screen.getByRole('radio', { name: 'Fill missing values' })).toBeChecked()
        expect(
            screen.getByRole('radio', { name: 'Remove rows with missing values' }),
        ).not.toBeChecked()
        for (const name of ['1. Name', '2. City', '3. Phone']) {
            expect(screen.getByRole('checkbox', { name })).toBeChecked()
        }
        for (const word of PLACEHOLDER_WORDS) {
            expect(screen.getByRole('checkbox', { name: word })).not.toBeChecked()
        }
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
        expect(screen.getByText(/Apply cannot be undone yet/)).toBeInTheDocument()
    })

    it('needs a value to fill with', () => {
        setup()
        expect(screen.getByText('Type the value to insert.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
        typeValue('0')
        expect(screen.queryByText('Type the value to insert.')).toBeNull()
        expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled()
        typeValue('   ')
        expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    })

    it('needs no value for removing rows, and offers the any or all choice', () => {
        setup()
        fireEvent.click(screen.getByRole('radio', { name: 'Remove rows with missing values' }))
        expect(screen.queryByRole('textbox', { name: 'Value to insert' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled()
        expect(
            screen.getByRole('radio', { name: 'Remove a row if any chosen column is missing' }),
        ).toBeChecked()
        fireEvent.click(
            screen.getByRole('radio', { name: 'Remove a row only if all chosen columns are missing' }),
        )
        expect(
            screen.getByRole('radio', { name: 'Remove a row only if all chosen columns are missing' }),
        ).toBeChecked()
    })

    it('needs at least one column, and can choose all or none at once', () => {
        setup()
        typeValue('0')
        fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
        for (const name of ['1. Name', '2. City', '3. Phone']) {
            expect(screen.getByRole('checkbox', { name })).not.toBeChecked()
        }
        expect(screen.getByText('Choose at least one column.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
        expect(screen.queryByText('Choose at least one column.')).toBeNull()
        expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled()
    })
})

describe('MissingPanel: preview', () => {
    it('previews with the chosen settings and shows the counts', async () => {
        const { session, onPreviewChange } = setup()
        await runFillPreview()

        expect(session.previewOperation).toHaveBeenCalledWith(fillSpec())
        expect(figure('Cells to fill')).toHaveTextContent('4')
        expect(figure('Missing cells found')).toHaveTextContent('3')
        expect(figure('Placeholder cells')).toHaveTextContent('1')
        expect(screen.getByText('Inserted value: 0')).toBeInTheDocument()
        expect(onPreviewChange).toHaveBeenCalled()
    })

    it('shows what each column would get, and how the value goes in', async () => {
        setup()
        await runFillPreview()
        const table = screen.getByRole('table', { name: 'Preview by column' })
        const rows = within(table).getAllByRole('row')
        expect(rows).toHaveLength(3)
        expect(within(rows[1] as HTMLElement).getByRole('rowheader')).toHaveTextContent('1. Name')
        expect(cellTexts(rows[1] as HTMLElement)).toEqual(['2', '1', '3', 'Text'])
        expect(cellTexts(rows[2] as HTMLElement)).toEqual(['1', '0', '1', 'Number'])
    })

    it('lists the cells that would be filled', async () => {
        setup()
        await runFillPreview()
        expect(
            screen.getByRole('heading', { name: 'Cells that will be filled' }),
        ).toBeInTheDocument()
        expect(await screen.findByText('Row 3')).toBeInTheDocument()
        expect(screen.getByText('(empty) → 0')).toBeInTheDocument()
    })

    it('sends the chosen placeholders and leaves out the columns that were unticked', async () => {
        const { session } = setup()
        fireEvent.click(screen.getByRole('checkbox', { name: 'n/a' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Other placeholders (one per line)' }), {
            target: { value: 'Unknown\n\n  ?  ' },
        })
        fireEvent.click(screen.getByRole('checkbox', { name: '2. City' }))
        await runFillPreview()

        expect(session.previewOperation).toHaveBeenCalledWith(
            fillSpec({ columnIds: ['c1', 'c3'], placeholders: ['n/a', 'Unknown', '?'] }),
        )
    })

    it('previews removing rows with the chosen rule', async () => {
        const { session } = setup({
            previewOperation: vi.fn().mockResolvedValue(removePreview),
            getPreviewPage: vi.fn().mockResolvedValue(removeRecords),
        })
        fireEvent.click(screen.getByRole('radio', { name: 'Remove rows with missing values' }))
        fireEvent.click(
            screen.getByRole('radio', { name: 'Remove a row only if all chosen columns are missing' }),
        )
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        await screen.findByRole('region', { name: 'Preview' })

        expect(session.previewOperation).toHaveBeenCalledWith({
            kind: 'missing',
            options: {
                columnIds: ['c1', 'c2', 'c3'],
                placeholders: [],
                action: { kind: 'removeRows', when: 'all' },
            },
        })
        expect(figure('Rows now')).toHaveTextContent('5')
        expect(figure('Will be removed')).toHaveTextContent('2')
        expect(figure('Will stay')).toHaveTextContent('3')
        const table = screen.getByRole('table', { name: 'Preview by column' })
        expect(within(table).queryByRole('columnheader', { name: 'Inserted as' })).toBeNull()
        expect(cellTexts(within(table).getAllByRole('row')[1] as HTMLElement)).toEqual([
            '2',
            '0',
            '2',
        ])
        expect(
            screen.getByRole('heading', { name: 'Rows that will be removed' }),
        ).toBeInTheDocument()
        expect(await screen.findByText(/missing in: Name/)).toBeInTheDocument()
    })

    it('warns when a column holds Excel dates', async () => {
        const dated: OperationPreviewSummary = {
            ...fillPreview,
            missing: {
                ...(fillPreview.missing as NonNullable<OperationPreviewSummary['missing']>),
                columns: [
                    previewColumn({
                        columnId: 'c2',
                        position: 2,
                        name: 'Joined',
                        missingCount: 1,
                        affectedCount: 1,
                        insertAs: 'text',
                        dateColumn: true,
                    }),
                ],
            },
        }
        setup({ previewOperation: vi.fn().mockResolvedValue(dated) })
        await runFillPreview()
        expect(
            screen.getByText(/Column 2 \(Joined\) holds Excel dates/),
        ).toBeInTheDocument()
    })

    it('enables Apply only after a preview that would change something', async () => {
        setup()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
        await runFillPreview()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    })

    it('cannot apply a preview that would change nothing', async () => {
        setup({ previewOperation: vi.fn().mockResolvedValue(nothingPreview) })
        await runFillPreview()
        expect(
            screen.getByText('No missing values were found with these settings.'),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    })

    it('discards the preview when a setting changes', async () => {
        const { session, onPreviewChange } = setup()
        await runFillPreview()
        const calls = onPreviewChange.mock.calls.length

        fireEvent.click(screen.getByRole('checkbox', { name: 'n/a' }))
        expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
        expect(session.clearPreview).toHaveBeenCalledTimes(1)
        expect(onPreviewChange.mock.calls.length).toBeGreaterThan(calls)
    })

    it('shows an error when the preview cannot be built', async () => {
        const { onPreviewChange } = setup({
            previewOperation: vi
                .fn()
                .mockRejectedValue(new Error('"0" is a real value (a number or true/false), so it cannot be treated as missing.')),
        })
        typeValue('x')
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(/is a real value/)
        expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
        expect(onPreviewChange).toHaveBeenCalled()
    })

    it('hides a preview that was made for different data', async () => {
        const session = makeSession({
            status: 'ready',
            summary: initial,
            previewOperation: vi.fn().mockResolvedValue(fillPreview),
            getPreviewPage: vi.fn().mockResolvedValue(fillRecords),
        })
        const view = render(
            <MissingPanel
                session={session}
                summary={initial}
                onClose={vi.fn()}
                onPreviewChange={vi.fn()}
            />,
        )
        await runFillPreview()
        view.rerender(
            <MissingPanel
                session={session}
                summary={after}
                onClose={vi.fn()}
                onPreviewChange={vi.fn()}
            />,
        )
        expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    })
})

describe('MissingPanel: apply', () => {
    it('applies the same settings and reports how many cells were filled', async () => {
        const { session, onPreviewChange } = setup()
        await runFillPreview()
        const calls = onPreviewChange.mock.calls.length

        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(await screen.findByText('Filled 4 cells.')).toBeInTheDocument()
        expect(session.applyOperation).toHaveBeenCalledWith(fillSpec())
        expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
        expect(onPreviewChange.mock.calls.length).toBeGreaterThan(calls)
    })

    it('reports how many rows were removed and how many remain', async () => {
        setup({
            previewOperation: vi.fn().mockResolvedValue(removePreview),
            getPreviewPage: vi.fn().mockResolvedValue(removeRecords),
            applyOperation: vi.fn().mockResolvedValue({
                summary: after,
                removedRows: 2,
                filledCells: 0,
                historyDepth: 1,
            }),
        })
        fireEvent.click(screen.getByRole('radio', { name: 'Remove rows with missing values' }))
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        await screen.findByRole('region', { name: 'Preview' })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(
            await screen.findByText('Removed 2 rows. 3 rows remain.'),
        ).toBeInTheDocument()
    })

    it('says so when nothing was changed', async () => {
        setup({
            applyOperation: vi.fn().mockResolvedValue({
                summary: initial,
                removedRows: 0,
                filledCells: 0,
                historyDepth: 0,
            }),
        })
        await runFillPreview()
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(
            await screen.findByText('No missing values were found, so nothing was changed.'),
        ).toBeInTheDocument()
    })

    it('shows an error when applying fails, and asks for a new preview', async () => {
        setup({
            applyOperation: vi.fn().mockRejectedValue(new Error('No spreadsheet is loaded.')),
        })
        await runFillPreview()
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('No spreadsheet is loaded.')
        expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    })
})

describe('MissingPanel: leaving', () => {
    it('closes the panel and discards the preview when cancelled', async () => {
        const { session, onClose } = setup()
        await runFillPreview()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(session.clearPreview).toHaveBeenCalledTimes(1)
    })

    it('does not ask the worker to clear anything when no preview was made', () => {
        const { session, onClose, unmount } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        unmount()
        expect(session.clearPreview).not.toHaveBeenCalled()
    })

    it('discards the preview when the panel is closed', async () => {
        const { session, unmount } = setup()
        await runFillPreview()
        unmount()
        expect(session.clearPreview).toHaveBeenCalledTimes(1)
    })

    it('discards a preview that finishes after the user cancelled', async () => {
        const late = deferred<OperationPreviewSummary>()
        const { session, onClose } = setup({
            previewOperation: vi.fn().mockReturnValue(late.promise),
        })
        typeValue('0')
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Working')
        expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(session.clearPreview).not.toHaveBeenCalled()

        await act(async () => {
            late.resolve(fillPreview)
        })
        expect(session.clearPreview).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    })
})