import { Activity, CircleDollarSign, Cpu, Package, PackageCheck, Pencil, Plus, Tag } from 'lucide-react'
import { Link } from 'react-router'
import type { AppEvent } from '@shared/types'
import { fmtDateTime, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

const icons: Record<string, typeof Activity> = {
  created: Plus,
  sold: CircleDollarSign,
  status: Activity,
  price: Tag,
  build: Cpu,
  component: Cpu,
  shipped: PackageCheck,
  lot: Package,
}

export function Timeline({ events, showLinks = false, empty = 'Aucune activité pour le moment.' }: { events: AppEvent[]; showLinks?: boolean; empty?: string }) {
  if (!events.length) return <p className="py-4 text-sm text-muted">{empty}</p>
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
      {events.map((e) => {
        const Icon = icons[e.type] ?? Pencil
        const href = e.entity === 'item' ? `/items/${e.entity_id}` : e.entity === 'build' ? `/builds/${e.entity_id}` : `/lots/${e.entity_id}`
        return (
          <li key={e.id} className="relative flex gap-3">
            <span
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface',
                e.type === 'sold' && 'border-positive/40 bg-positive/10 text-positive',
              )}
            >
              <Icon className="size-3" />
            </span>
            <div className="min-w-0 pt-0.5 text-[13px]">
              {showLinks && e.label && (
                <Link to={href} className="block truncate font-medium text-fg hover:text-accent">
                  {e.label}
                </Link>
              )}
              <p className="text-fg-2">{e.message}</p>
              <p className="mt-0.5 text-xs text-muted" title={fmtDateTime(e.created_at)}>
                {timeAgo(e.created_at)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
