import { OperationsPanel } from '@/components/workspace/OperationsPanel'
import { PreviewPanel } from '@/components/workspace/PreviewPanel'
import { SettingsPanel } from '@/components/workspace/SettingsPanel'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'

interface CleanSpreadsheetPageProps {
    session: SpreadsheetSession
}

export function CleanSpreadsheetPage({ session }: CleanSpreadsheetPageProps) {
    const notice =
        session.summary === null
            ? 'Available after you upload a spreadsheet.'
            : 'Cleaning operations are added in a later development phase.'

    return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Clean Spreadsheet
            </h1>

            <div className="mt-4 grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
                <div className="order-2 lg:order-1">
                    <OperationsPanel notice={notice} />
                </div>
                <div className="order-1 lg:order-2">
                    <PreviewPanel session={session} />
                </div>
                <div className="order-3">
                    <SettingsPanel />
                </div>
            </div>
        </div>
    )
}