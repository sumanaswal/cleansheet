import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { NAV_ITEMS, type PageId } from '@/components/layout/navigation'
import { Button } from '@/components/ui/button'

interface AppShellProps {
    currentPage: PageId
    onNavigate: (page: PageId) => void
    children: ReactNode
}

export function AppShell({ currentPage, onNavigate, children }: AppShellProps) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="sticky top-0 z-10 border-b bg-background">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <Check className="size-5" aria-hidden="true" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-foreground">
                            CleanSheet
                        </span>
                    </div>

                    <nav aria-label="Main" className="flex items-center gap-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon
                            const isActive = item.id === currentPage
                            return (
                                <Button
                                    key={item.id}
                                    type="button"
                                    variant={isActive ? 'secondary' : 'ghost'}
                                    aria-label={item.label}
                                    aria-current={isActive ? 'page' : undefined}
                                    title={item.label}
                                    onClick={() => onNavigate(item.id)}
                                >
                                    <Icon aria-hidden="true" />
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Button>
                            )
                        })}
                    </nav>
                </div>
            </header>

            <main className="flex-1">{children}</main>
        </div>
    )
}