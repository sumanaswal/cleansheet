import { useState } from 'react'

import { OperationsPanel } from '@/components/workspace/OperationsPanel'
import { PreviewPanel } from '@/components/workspace/PreviewPanel'
import { SettingsPanel } from '@/components/workspace/SettingsPanel'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'

interface CleanSpreadsheetPageProps {
    session: SpreadsheetSession
}

export function CleanSpreadsheetPage({ session }: CleanSpreadsheetPageProps) {
    const [activeOperation, setActiveOperation] = useState<string | null>(null)
    // Bumped whenever the preview of an operation changes, so the table
    // reloads its rows together with up-to-date highlights.
    const [previewRevision, setPreviewRevision] = useState(0)

    const hasData = session.summary !== null
    const active = hasData ? activeOperation : null

    return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Clean Spreadsheet
            </h1>

            <div className="mt-4 grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
                <div className="order-2 lg:order-1">
                    <OperationsPanel
                        hasData={hasData}
                        activeId={active}
                        onSelect={setActiveOperation}
                    />
                </div>
                <div className="order-1 lg:order-2">
                    <PreviewPanel session={session} refreshKey={previewRevision} />
                </div>
                <div className="order-3">
                    <SettingsPanel
                        session={session}
                        activeOperation={active}
                        onClose={() => setActiveOperation(null)}
                        onPreviewChange={() => setPreviewRevision((value) => value + 1)}
                    />
                </div>
            </div>
        </div>
    )
}