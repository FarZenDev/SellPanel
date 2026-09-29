import * as M from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Menu = M.Root
export const MenuTrigger = M.Trigger

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn('animate-fade-in z-50 min-w-48 rounded-xl border border-border bg-surface p-1 shadow-xl', className)}>
        {children}
      </M.Content>
    </M.Portal>
  )
}

export function MenuItem({
  children,
  onSelect,
  danger,
  icon,
  disabled,
  shortcut,
}: {
  children: ReactNode
  onSelect?: () => void
  danger?: boolean
  icon?: ReactNode
  disabled?: boolean
  shortcut?: string
}) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4',
        danger ? 'text-negative data-[highlighted]:bg-negative/10' : 'text-fg-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg',
      )}
    >
      {icon && <span className={cn('shrink-0', danger ? 'text-negative' : 'text-muted')}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <kbd className="text-[11px] text-muted">{shortcut}</kbd>}
    </M.Item>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{children}</M.Label>
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />
}
