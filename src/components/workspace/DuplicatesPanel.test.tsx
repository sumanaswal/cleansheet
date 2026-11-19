import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DuplicatesPanel } from '@/components/workspace/DuplicatesPanel'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import { makeSession, makeSummary } from '@/test/session'
import type { PreviewPage } from '@/workers/importClient'
import type {
  DatasetSummary,
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

const previewResult: OperationPreviewSummary = {
  totalRows: 5,
  removedRows: 2,
  retainedRows: 3,
  skippedRows: 1,
  itemCount: 2,
}
const recordsPage: PreviewPage = {
  offset: 0,
  itemCount: 2,
  items: [
    { kind: 'removedRow', row: { sourceRow: 4, cells: ['A', 'x'] }, keptSourceRow: 2 },
    { kind: 'removedRow', row: { sourceRow: 6, cells: ['A', null] }, keptSourceRow: 2 },
  ],
}

const DEFAULT_SPEC: OperationSpec = {
  kind: 'duplicates',
  options: {
    columnIds: null,
    keep: 'first',
    caseInsensitive: false,
    normalizeSpaces: false,
  },
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
    <DuplicatesPanel
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
    previewOperation: vi.fn().mockResolvedValue(previewResult),
    getPreviewPage: vi.fn().mockResolvedValue(recordsPage),
    applyOperation: vi
      .fn()
      .mockResolvedValue({ summary: after, removedRows: 2, historyDepth: 1 }),
    ...overrides,
  })
  const onClose = vi.fn()
  const onPreviewChange = vi.fn()
  const view = render(
    <Harness session={session} onClose={onClose} onPreviewChange={onPreviewChange} />,
  )
  return { session, onClose, onPreviewChange, ...view }
}

async function runPreview() {
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  await screen.findByRole('region', { name: 'Preview' })
}

/** The value shown next to a figure label in the preview. */
function figure(label: string): Element | null {
  return screen.getByText(label).nextElementSibling
}

describe('DuplicatesPanel: settings', () => {
  it('starts with exact matching on all columns, keeping the first copy', () => {
    setup()
    expect(screen.getByRole('radio', { name: /All columns/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Selected columns/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Keep the first occurrence/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ignore capital/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ignore extra spaces/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  })

  it('says that Apply cannot be undone yet', () => {
    setup()
    expect(screen.getByText(/Apply cannot be undone yet/)).toBeInTheDocument()
  })

  it('needs at least one column when comparing selected columns', () => {
    setup()
    fireEvent.click(screen.getByRole('radio', { name: /Selected columns/ }))
    expect(screen.getByText('Choose at least one column.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: '2. City' }))
    expect(screen.queryByText('Choose at least one column.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled()
  })

  it('selects and clears all columns', () => {
    setup()
    fireEvent.click(screen.getByRole('radio', { name: /Selected columns/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    const boxes = screen.getAllByRole('checkbox', { name: /^\d+\. / })
    expect(boxes).toHaveLength(3)
    for (const box of boxes) expect(box).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    for (const box of screen.getAllByRole('checkbox', { name: /^\d+\. / })) {
      expect(box).not.toBeChecked()
    }
  })
})

describe('DuplicatesPanel: preview', () => {
  it('previews with the default settings and shows the counts and the records', async () => {
    const { session, onPreviewChange } = setup()
    await runPreview()

    expect(session.previewOperation).toHaveBeenCalledWith(DEFAULT_SPEC)
    expect(figure('Rows now')).toHaveTextContent('5')
    expect(figure('Will be removed')).toHaveTextContent('2')
    expect(figure('Will stay')).toHaveTextContent('3')
    expect(figure('Not compared')).toHaveTextContent('1')
    expect(
      screen.getByText('Completely empty rows are not compared and always stay.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Row 4')).toBeInTheDocument()
    expect(screen.getByText('Row 6')).toBeInTheDocument()
    expect(screen.getByText('A | x')).toBeInTheDocument()
    expect(onPreviewChange).toHaveBeenCalled()
  })

  it('sends every setting the user chose', async () => {
    const { session } = setup()
    fireEvent.click(screen.getByRole('radio', { name: /Keep the last occurrence/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Ignore capital/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Ignore extra spaces/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Selected columns/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: '2. City' }))
    await runPreview()

    expect(session.previewOperation).toHaveBeenCalledWith({
      kind: 'duplicates',
      options: {
        columnIds: ['c2'],
        keep: 'last',
        caseInsensitive: true,
        normalizeSpaces: true,
      },
    })
    expect(
      screen.getByText(
        'Rows with a missing value in a chosen column are not compared and always stay.',
      ),
    ).toBeInTheDocument()
  })

  it('enables Apply only after a preview that would remove rows', async () => {
    setup()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    await runPreview()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
  })

  it('cannot apply a preview that would remove nothing', async () => {
    setup({
      previewOperation: vi.fn().mockResolvedValue({
        totalRows: 5,
        removedRows: 0,
        retainedRows: 5,
        skippedRows: 0,
        itemCount: 0,
      }),
    })
    await runPreview()
    expect(
      screen.getByText('No duplicate rows were found with these settings.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  })

  it('discards the preview when a setting changes', async () => {
    const { session, onPreviewChange } = setup()
    await runPreview()
    const calls = onPreviewChange.mock.calls.length

    fireEvent.click(screen.getByRole('checkbox', { name: /Ignore capital/ }))
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(session.clearPreview).toHaveBeenCalledTimes(1)
    expect(onPreviewChange.mock.calls.length).toBeGreaterThan(calls)
  })

  it('shows an error when the preview cannot be built', async () => {
    const { onPreviewChange } = setup({
      previewOperation: vi
        .fn()
        .mockRejectedValue(new Error('Choose at least one column to compare.')),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose at least one column to compare.',
    )
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(onPreviewChange).toHaveBeenCalled()
  })

  it('hides a preview that was made for different data', async () => {
    const session = makeSession({
      status: 'ready',
      summary: initial,
      previewOperation: vi.fn().mockResolvedValue(previewResult),
      getPreviewPage: vi.fn().mockResolvedValue(recordsPage),
    })
    const view = render(
      <DuplicatesPanel
        session={session}
        summary={initial}
        onClose={vi.fn()}
        onPreviewChange={vi.fn()}
      />,
    )
    await runPreview()
    view.rerender(
      <DuplicatesPanel
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

describe('DuplicatesPanel: apply', () => {
  it('applies with the same settings and reports what happened', async () => {
    const { session, onPreviewChange } = setup()
    await runPreview()
    const calls = onPreviewChange.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(
      await screen.findByText('Removed 2 duplicate rows. 3 rows remain.'),
    ).toBeInTheDocument()
    expect(session.applyOperation).toHaveBeenCalledWith(DEFAULT_SPEC)
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(onPreviewChange.mock.calls.length).toBeGreaterThan(calls)
  })

  it('shows an error when applying fails, and asks for a new preview', async () => {
    setup({
      applyOperation: vi.fn().mockRejectedValue(new Error('No spreadsheet is loaded.')),
    })
    await runPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No spreadsheet is loaded.')
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  })
})

describe('DuplicatesPanel: leaving', () => {
  it('closes the panel and discards the preview when cancelled', async () => {
    const { session, onClose } = setup()
    await runPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(session.clearPreview).toHaveBeenCalledTimes(1)
  })

  it('does not ask the worker to clear anything when no preview was made', () => {
    const { session, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(session.clearPreview).not.toHaveBeenCalled()
  })

  it('discards the preview when the panel is closed', async () => {
    const { session, unmount } = setup()
    await runPreview()
    unmount()
    expect(session.clearPreview).toHaveBeenCalledTimes(1)
  })

  it('does not ask the worker to clear anything on close when no preview was made', () => {
    const { session, unmount } = setup()
    unmount()
    expect(session.clearPreview).not.toHaveBeenCalled()
  })

  it('discards a preview that finishes after the user cancelled', async () => {
    const late = deferred<OperationPreviewSummary>()
    const { session, onClose } = setup({
      previewOperation: vi.fn().mockReturnValue(late.promise),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Working')
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(session.clearPreview).not.toHaveBeenCalled()

    await act(async () => {
      late.resolve(previewResult)
    })
    expect(session.clearPreview).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
  })
})