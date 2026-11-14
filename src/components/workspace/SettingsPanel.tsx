export function SettingsPanel() {
  return (
    <section
      aria-label="Operation settings"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Operation settings
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose an operation on the left to see its options here. Every change
        is previewed before it is applied.
      </p>
    </section>
  )
}