import { Button } from '@/components/ui/button'
import { OPERATION_GROUPS } from '@/components/workspace/operations'

interface OperationsPanelProps {
  /** Explains why the operations are unavailable. */
  notice: string
}

// Every operation stays disabled until its module is built (Phase 5).
export function OperationsPanel({ notice }: OperationsPanelProps) {
  return (
    <section
      aria-label="Operations"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-sm font-semibold text-foreground">Operations</h2>
      <p className="mt-1 text-xs text-muted-foreground">{notice}</p>
      <div className="mt-4 space-y-5">
        {OPERATION_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h3>
            <div className="mt-2 flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    className="justify-start"
                    disabled
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