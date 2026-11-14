import {
    CalendarDays,
    ClipboardCheck,
    Copy,
    Eraser,
    Link,
    Pencil,
    Plus,
    Scissors,
    Trash2,
    Type,
    ArrowLeftRight,
    type LucideIcon,
} from 'lucide-react'

export interface OperationItem {
    id: string
    label: string
    icon: LucideIcon
}

export interface OperationGroup {
    title: string
    items: readonly OperationItem[]
}

export const OPERATION_GROUPS: readonly OperationGroup[] = [
    {
        title: 'Cleaning operations',
        items: [
            { id: 'duplicates', label: 'Remove duplicates', icon: Copy },
            { id: 'missing', label: 'Missing values', icon: Eraser },
            { id: 'text', label: 'Text cleaning', icon: Type },
            { id: 'dates', label: 'Standardize dates', icon: CalendarDays },
        ],
    },
    {
        title: 'Data quality tools',
        items: [
            { id: 'overview', label: 'Data quality overview', icon: ClipboardCheck },
        ],
    },
    {
        title: 'Column operations',
        items: [
            { id: 'split', label: 'Split column', icon: Scissors },
            { id: 'merge', label: 'Merge columns', icon: Link },
            { id: 'rename', label: 'Rename column', icon: Pencil },
            { id: 'reorder', label: 'Reorder columns', icon: ArrowLeftRight },
            { id: 'remove', label: 'Remove columns', icon: Trash2 },
            { id: 'add', label: 'Add empty column', icon: Plus },
        ],
    },
]

