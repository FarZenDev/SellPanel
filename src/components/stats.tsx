import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from './ui/card'
import { Tip } from './ui/misc'

export function KpiCard({
  label,
  value,
  delta,
  deltaInverted,
  hint,
  icon,
  sub,
  className,
}: {
  label: string
  value: ReactNode
  delta?: number | null
  deltaInverted?: boolean
  hint?: string
  icon?: ReactNode
  sub?: ReactNode
  className?: string
}) {
  const up = delta != null && delta > 0
  const flat = delta != null && Math.abs(delta) < 0.0005
  const good = delta == null || flat ? null : deltaInverted ? !up : up
  const content = (
    <Card className={cn('flex min-w-0 flex-col gap-2 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted">{label}</span>
        {icon && <span className="text-muted/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="tabular truncate text-2xl font-semibold tracking-tight">{value}</div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {delta != null && Number.isFinite(delta) && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
              good == null ? 'bg-surface-3 text-muted' : good ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative',
            )}
          >
            {flat ? <ArrowRight className="size-3.5" /> : up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {pct(Math.abs(delta))}
          </span>
        )}
        {sub && <span className="truncate text-muted">{sub}</span>}
      </div>
    </Card>
  )
  return hint ? <Tip content={hint}>{<div className="min-w-0">{content}</div>}</Tip> : content
}

export interface BarListRow {
  key: string | number
  label: ReactNode
  value: number
  display: ReactNode
  secondary?: ReactNode
  href?: string
}

/** Liste de barres horizontales (une seule série, une seule couleur) — lisible et accessible. */
export function BarList({ rows, className, color = 'var(--series-1)', empty = 'Aucune donnée' }: { rows: BarListRow[]; className?: string; color?: string; empty?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>
  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((r) => (
        <li key={r.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-fg-2">{r.label}</span>
            <span className="tabular shrink-0 font-medium">
              {r.display}
              {r.secondary && <span className="ml-2 font-normal text-muted">{r.secondary}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${max > 0 ? Math.max(2, (Math.max(0, r.value) / max) * 100) : 0}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatLine({ label, value, strong, muted, className }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5 text-sm', strong && 'font-semibold', muted && 'text-muted', className)}>
      <span className={cn(!strong && 'text-fg-2', muted && 'text-muted')}>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  )
}
