import { useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import type { PageId } from '@/components/layout/navigation'
import { useSpreadsheetSession } from '@/hooks/useSpreadsheetSession'
import { CleanSpreadsheetPage } from '@/pages/CleanSpreadsheetPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DataQualityPage } from '@/pages/DataQualityPage'
import { HelpPage } from '@/pages/HelpPage'
import { createBrowserImportClient } from '@/workers/browserImportClient'

function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  // The background worker is only started when the first file is opened.
  const [client] = useState(createBrowserImportClient)
  const session = useSpreadsheetSession(client)

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return (
          <DashboardPage
            session={session}
            onOpenWorkspace={() => setPage('clean')}
          />
        )
      case 'clean':
        return <CleanSpreadsheetPage session={session} />
      case 'quality':
        return <DataQualityPage summary={session.summary} />
      case 'help':
        return <HelpPage />
    }
  }

  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {renderPage()}
    </AppShell>
  )
}

export default App