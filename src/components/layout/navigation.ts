import {
    CircleHelp,
    ClipboardCheck,
    LayoutDashboard,
    Table2,
    type LucideIcon,
} from 'lucide-react'

export type PageId = 'dashboard' | 'clean' | 'quality' | 'help'

export interface NavItem {
    id: PageId
    label: string
    icon: LucideIcon
}

export const NAV_ITEMS: readonly NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clean', label: 'Clean Spreadsheet', icon: Table2 },
    { id: 'quality', label: 'Data Quality', icon: ClipboardCheck },
    { id: 'help', label: 'About / Help', icon: CircleHelp },
]