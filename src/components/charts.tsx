import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { MonthPoint } from '@shared/analytics'
import { eur, eurCompact } from '@/lib/format'
import { useChartColors } from '@/lib/theme'

function ChartTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as MonthPoint
  return (
    <div className="min-w-44 rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] shadow-xl">
      <p className="mb-1.5 font-semibold capitalize">{label}</p>
      {payload.map((s) => (
        <div key={String(s.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-fg-2">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
          <span className="tabular font-medium">{eur(Number(s.value))}</span>
        </div>
      ))}
      <div className="mt-1.5 flex justify-between gap-4 border-t border-border pt-1.5 text-muted">
        <span>
          {p.count} vente{p.count > 1 ? 's' : ''}
        </span>
        {p.expenses > 0 && <span>Dépenses {eur(p.expenses)}</span>}
      </div>
    </div>
  )
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-fg-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Chiffre d'affaires et bénéfice mensuels : même unité (€), un seul axe. */
export function RevenueProfitChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  const c = useChartColors()
  return (
    <div className="space-y-3">
      <ChartLegend
        items={[
          { label: 'Chiffre d’affaires', color: c.s1 },
          { label: 'Bénéfice brut', color: c.s2 },
        ]}
      />
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.axis, fontSize: 12 }} tickMargin={8} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 12 }} tickFormatter={(v: number) => eurCompact(v)} width={64} />
            <Tooltip content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} />} cursor={{ fill: c.grid, opacity: 0.6 }} />
            <Bar dataKey="revenue" name="Chiffre d’affaires" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="profit" name="Bénéfice brut" fill={c.s2} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Série unique (dépenses mensuelles, achats…). */
export function SingleBarChart({ data, dataKey, name, height = 220 }: { data: MonthPoint[]; dataKey: keyof MonthPoint; name: string; height?: number }) {
  const c = useChartColors()
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.axis, fontSize: 12 }} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 12 }} tickFormatter={(v: number) => eurCompact(v)} width={56} />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.6 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] shadow-xl">
                  <p className="font-semibold capitalize">{label}</p>
                  <p className="tabular text-fg-2">
                    {name} : <strong>{eur(Number(payload[0].value))}</strong>
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey={dataKey as string} name={name} fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
