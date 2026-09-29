import { BUILD_STATUSES, ITEM_STATUSES } from '@shared/constants'
import type { BuildStatus, ItemStatus, Platform } from '@shared/types'
import { cn } from '@/lib/utils'
import { Badge } from './ui/badge'

export function ItemStatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  const def = ITEM_STATUSES.find((s) => s.value === status)!
  return (
    <Badge tone={def.tone} dot className={className} title={def.hint}>
      {def.label}
    </Badge>
  )
}

export function BuildStatusBadge({ status, className }: { status: BuildStatus; className?: string }) {
  const def = BUILD_STATUSES.find((s) => s.value === status)!
  return (
    <Badge tone={def.tone} dot className={className} title={def.hint}>
      {def.label}
    </Badge>
  )
}

export function PlatformDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full ring-2 ring-surface', className)} style={{ background: color }} />
}

export function PlatformTag({ platform, className, muted }: { platform: Platform | undefined; className?: string; muted?: boolean }) {
  if (!platform) return <span className={cn('text-muted', className)}>—</span>
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[13px]', muted ? 'text-muted' : 'text-fg-2', className)}>
      <PlatformDot color={platform.color} />
      <span className="truncate">{platform.name}</span>
    </span>
  )
}
