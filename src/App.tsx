import { Button } from '@/components/ui/button'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">CleanSheet</h1>
        <p className="mt-2 text-slate-600">
          Tailwind CSS and shadcn/ui are working. Clean your spreadsheets
          without writing formulas.
        </p>
        <Button className="mt-6">Test button</Button>
      </div>
    </div>
  )
}

export default App