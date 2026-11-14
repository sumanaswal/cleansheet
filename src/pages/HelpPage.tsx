const STEPS = [
    { title: 'Upload', text: 'Choose or drag in an XLSX or CSV file.' },
    { title: 'Understand', text: 'Review the data quality summary.' },
    {
        title: 'Clean',
        text: 'Pick an operation and choose the columns it applies to.',
    },
    {
        title: 'Review',
        text: 'See exactly what will change, then apply it or cancel. Undo is available.',
    },
    { title: 'Download', text: 'Export the cleaned data as XLSX or CSV.' },
] as const

const PRINCIPLES = [
    'Every operation that changes data is previewed before it is applied.',
    'Records are never removed silently. You see the count first.',
    'Ambiguous dates, such as 03/04/2026, are never guessed. You choose how they are read.',
    'Identifiers such as employee IDs, postal codes and phone numbers keep their leading zeros.',
    'Zero and false are real values and are not treated as missing.',
    'Your original file is never modified. Cleaned data is saved as a new file.',
] as const

export function HelpPage() {
    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                About / Help
            </h1>
            <p className="mt-2 text-muted-foreground">
                CleanSheet helps you clean, standardize and organize spreadsheets
                without formulas, macros or programming.
            </p>

            <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                CleanSheet is under development and features are being added one phase
                at a time. This page describes the intended design of the finished
                local version.
            </p>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">How it works</h2>
                <ol className="mt-3 space-y-2">
                    {STEPS.map((step, index) => (
                        <li key={step.title} className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                            >
                                {index + 1}
                            </span>
                            <span className="text-sm text-foreground">
                                <span className="font-medium">{step.title}.</span> {step.text}
                            </span>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                    What CleanSheet does not preserve
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    CleanSheet cleans tabular data, one worksheet at a time. It is not a
                    full Excel editor. Formulas, macros, pivot tables, charts, embedded
                    objects and advanced formatting may not be preserved in the exported
                    file.
                </p>
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                    Privacy by design
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    CleanSheet is designed to read and clean your spreadsheet inside your
                    browser, without an account. This will be checked by inspecting real
                    network activity before any stronger privacy claim is made.
                </p>
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                    Data integrity principles
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    CleanSheet is being built around these rules:
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {PRINCIPLES.map((principle) => (
                        <li key={principle}>{principle}</li>
                    ))}
                </ul>
            </section>
        </div>
    )
}