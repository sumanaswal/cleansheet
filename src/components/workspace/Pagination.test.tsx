import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from '@/components/workspace/Pagination'

function renderPagination(
    props: Partial<Parameters<typeof Pagination>[0]> = {},
) {
    const onPageChange = vi.fn()
    render(
        <Pagination
            pageIndex={1}
            pageCount={13}
            rowCount={1234}
            pageSize={100}
            onPageChange={onPageChange}
            {...props}
        />,
    )
    return onPageChange
}

describe('Pagination', () => {
    it('shows the data rows on the page and moves between pages', () => {
        const onPageChange = renderPagination()
        expect(screen.getByText('Data rows 101–200 of 1,234')).toBeInTheDocument()
        expect(screen.getByText('Page 2 of 13')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
        expect(onPageChange).toHaveBeenLastCalledWith(2)
        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
        expect(onPageChange).toHaveBeenLastCalledWith(0)
        fireEvent.click(screen.getByRole('button', { name: 'First page' }))
        expect(onPageChange).toHaveBeenLastCalledWith(0)
        fireEvent.click(screen.getByRole('button', { name: 'Last page' }))
        expect(onPageChange).toHaveBeenLastCalledWith(12)
    })

    it('cannot go back from the first page', () => {
        renderPagination({ pageIndex: 0 })
        expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    })

    it('cannot go forward from the last page and shows its shorter row range', () => {
        renderPagination({ pageIndex: 12 })
        expect(screen.getByText('Data rows 1,201–1,234 of 1,234')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'First page' })).toBeEnabled()
    })

    it('has no page buttons when everything fits on one page', () => {
        renderPagination({ pageIndex: 0, pageCount: 1, rowCount: 5 })
        expect(screen.getByText('Data rows 1–5 of 5')).toBeInTheDocument()
        expect(screen.queryByRole('button')).toBeNull()
    })

    it('says so when there are no data rows', () => {
        renderPagination({ pageIndex: 0, pageCount: 1, rowCount: 0 })
        expect(screen.getByText('No data rows')).toBeInTheDocument()
    })
})