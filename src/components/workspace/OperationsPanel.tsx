import { Button } from '@/components/ui/button'
import {
  AVAILABLE_OPERATIONS,
  OPERATION_GROUPS,
} from '@/components/workspace/operations'

interface OperationsPanelProps {
  /** Whether a spreadsheet is loaded. Nothing can be chosen without one. */
  hasData: boolean
  /** The operation whose settings are open, if any. */
  activeId: string | null
  onSelect: (id: string) => void
}

export function OperationsPanel({ hasData, activeId, onSelect }: OperationsPanelProps) {
  return (
    <section
      aria-label="Operations"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-sm font-semibold text-foreground">Operations</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasData
          ? 'Greyed-out operations are added in later development phases.'
          : 'Available after you upload a spreadsheet.'}
      </p>
      <div className="mt-4 space-y-5">
        {OPERATION_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h3>
            <div className="mt-2 flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = item.id === activeId
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant={active ? 'secondary' : 'ghost'}
                    className="justify-start"
                    aria-pressed={active}
                    disabled={!hasData || !AVAILABLE_OPERATIONS.has(item.id)}
                    onClick={() => onSelect(item.id)}
                  >
                    <Icon aria-hidden="true" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}