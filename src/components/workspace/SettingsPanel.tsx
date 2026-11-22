import { DuplicatesPanel } from '@/components/workspace/DuplicatesPanel'
import { MissingPanel } from '@/components/workspace/MissingPanel'
import type { SpreadsheetSession } from '@/hooks/useSpreadsheetSession'

interface SettingsPanelProps {
  session: SpreadsheetSession
  /** The operation whose settings are shown, if any. */
  activeOperation: string | null
  onClose: () => void
  onPreviewChange: () => void
}

export function SettingsPanel({
  session,
  activeOperation,
  onClose,
  onPreviewChange,
}: SettingsPanelProps) {
  const { summary } = session

  return (
    <section
      aria-label="Operation settings"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Operation settings
      </h2>
      {summary !== null && activeOperation === 'duplicates' && (
        <DuplicatesPanel
          session={session}
          summary={summary}
          onClose={onClose}
          onPreviewChange={onPreviewChange}
        />
      )}
      {summary !== null && activeOperation === 'missing' && (
        <MissingPanel
          session={session}
          summary={summary}
          onClose={onClose}
          onPreviewChange={onPreviewChange}
        />
      )}
      {(summary === null ||
        (activeOperation !== 'duplicates' && activeOperation !== 'missing')) && (
          <p className="mt-2 text-sm text-muted-foreground">
            Choose an operation on the left to see its options here. Every change
            is previewed before it is applied.
          </p>
        )}
    </section>
  )
}