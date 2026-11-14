import { useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import type { PageId } from '@/components/layout/navigation'
import { CleanSpreadsheetPage } from '@/pages/CleanSpreadsheetPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DataQualityPage } from '@/pages/DataQualityPage'
import { HelpPage } from '@/pages/HelpPage'

function renderPage(page: PageId) {
  switch (page) {
    case 'dashboard':
      return <DashboardPage />
    case 'clean':
      return <CleanSpreadsheetPage />
    case 'quality':
      return <DataQualityPage />
    case 'help':
      return <HelpPage />
  }
}

function App() {
  const [page, setPage] = useState<PageId>('dashboard')

  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {renderPage(page)}
    </AppShell>
  )
}

export default App