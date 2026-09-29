import type { ReactNode } from 'react'
import type { Tone } from '@shared/constants'
import { cn } from '@/lib/utils'

export const toneClasses: Record<Tone, { badge: string; dot: string; soft: string }> = {
  slate: { badge: 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300', dot: 'bg-slate-500', soft: 'bg-slate-500/10' },
  sky: { badge: 'bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300', dot: 'bg-sky-500', soft: 'bg-sky-500/10' },
  amber: { badge: 'bg-amber-500/12 text-amber-800 ring-amber-500/25 dark:text-amber-300', dot: 'bg-amber-500', soft: 'bg-amber-500/10' },
  violet: { badge: 'bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300', dot: 'bg-violet-500', soft: 'bg-violet-500/10' },
  orange: { badge: 'bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300', dot: 'bg-orange-500', soft: 'bg-orange-500/10' },
  indigo: { badge: 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300', dot: 'bg-indigo-500', soft: 'bg-indigo-500/10' },
  emerald: { badge: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300', dot: 'bg-emerald-500', soft: 'bg-emerald-500/10' },
  rose: { badge: 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300', dot: 'bg-rose-500', soft: 'bg-rose-500/10' },
  teal: { badge: 'bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-300', dot: 'bg-teal-500', soft: 'bg-teal-500/10' },
  red: { badge: 'bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300', dot: 'bg-red-500', soft: 'bg-red-500/10' },
  zinc: { badge: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-400', dot: 'bg-zinc-500', soft: 'bg-zinc-500/10' },
}

export function Badge({ tone = 'slate', children, className, dot = false, title }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; title?: string }) {
  const t = toneClasses[tone]
  return (
    <span
      title={title}
      className={cn('inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset', t.badge, className)}
    >
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  )
}
