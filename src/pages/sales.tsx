import { Cpu, Download, PackageCheck, ShoppingBag, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { inRange, inventorySnapshot, presetRange, summarize, PERIOD_PRESETS, type PeriodPreset } from '@shared/analytics'
import { todayISO } from '@shared/calc'
import { PlatformTag } from '@/components/badges'
import { PageHeader } from '@/components/layout/app-shell'
import { Percent, Profit } from '@/components/money'
import { KpiCard } from '@/components/stats'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/form'
import { EmptyState, PageLoader } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { exportSalesLedger } from '@/lib/csv'
import { eur, eur0, fmtDate, fmtDateShort, fmtDays, num, pct } from '@/lib/format'
import { useAction } from '@/lib/queries'
import { useAllData } from '@/lib/use-data'

function ShipRow({ id, title, sku, date }: { id: number; title: string; sku: string; date: string | null }) {
  const [tracking, setTracking] = useState('')
  const ship = useAction(() => api.patch(`/api/items/${id}`, { shipped_date: todayISO(), ...(tracking ? { tracking_number: tracking } : {}) }), { success: 'Marqué comme expédié' })
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <Link to={`/items/${id}`} className="block truncate text-sm font-medium hover:text-accent">
          {title}
        </Link>
        <p className="text-xs text-muted">
          {sku} · vendu le {fmtDate(date)}
        </p>
      </div>
      <Input className="h-8 w-44" placeholder="N° de suivi (optionnel)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
      <Button size="sm" variant="outline" loading={ship.isPending} onClick={() => ship.mutate(undefined)}>
        <PackageCheck /> Expédié
      </Button>
    </div>
  )
}

export function SalesPage() {
  const data = useAllData()
  const [preset, setPreset] = useState<PeriodPreset>('year')
  const [platform, setPlatform] = useState('')
  const [kind, setKind] = useState('')
  const today = todayISO()
  const { range } = presetRange(preset, today)

  const sales = useMemo(
    () => data.sales.filter((s) => inRange(s.date, range) && (!platform || String(s.platformId) === platform) && (!kind || s.kind === kind)),
    [data.sales, range, platform, kind],
  )
  const summary = useMemo(() => summarize(sales, [], { from: null, to: null }), [sales])
  // Même règle que le tableau de bord : ventes à distance non expédiées depuis moins de 30 jours.
  const toShip = useMemo(() => {
    const ids = new Set(inventorySnapshot(data.items, data.builds, data.platforms, data.settings, today).toShip.map((t) => t.id))
    return data.items.filter((i) => ids.has(i.id)).sort((a, b) => (a.sale_date ?? '').localeCompare(b.sale_date ?? ''))
  }, [data, today])

  if (data.isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventes"
        description="Registre de toutes vos ventes (articles et PC montés), avec le détail des frais et du bénéfice."
        actions={
          <Button variant="outline" onClick={() => exportSalesLedger(sales, data)} disabled={!sales.length}>
            <Download /> Livre des recettes (CSV)
          </Button>
        }
      />

      {toShip.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader title={`À expédier (${toShip.length})`} icon={<Truck />} description="Ventes à distance pas encore marquées comme envoyées." />
          <div className="divide-y divide-border border-t border-border">
            {toShip.map((i) => (
              <ShipRow key={i.id} id={i.id} title={i.title} sku={i.sku} date={i.sale_date} />
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Select className="w-48" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)}>
          {PERIOD_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select className="w-44" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">Toutes plateformes</option>
          {data.platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select className="w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Articles et PC</option>
          <option value="item">Articles seuls</option>
          <option value="build">PC montés</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Ventes" value={num(summary.count)} />
        <KpiCard label="Chiffre d’affaires" value={eur0(summary.revenue)} />
        <KpiCard
          label="Frais & envois"
          value={eur0(summary.fees + summary.shipping)}
          sub={summary.revenue ? `${pct((summary.fees + summary.shipping) / summary.revenue)} du CA` : undefined}
        />
        <KpiCard
          label="Bénéfice brut"
          value={<Profit value={summary.grossProfit} signed={false} className="font-semibold" />}
          sub={summary.margin != null ? `marge ${pct(summary.margin)}` : undefined}
        />
        <KpiCard label="Panier moyen" value={eur0(summary.avgBasket)} sub={summary.avgProfit != null ? `${eur0(summary.avgProfit)} de bénéfice` : undefined} />
        <KpiCard label="Délai de vente moyen" value={summary.avgDaysToSell != null ? fmtDays(Math.round(summary.avgDaysToSell)) : '—'} sub="de l’achat à la vente" />
      </div>

      {sales.length === 0 ? (
        <Card>
          <EmptyState icon={<ShoppingBag />} title="Aucune vente sur la période" description="Marquez un article comme vendu depuis l’inventaire pour le voir apparaître ici." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Vente</th>
                  <th className="px-3 py-2.5 font-medium">Plateforme</th>
                  <th className="px-3 py-2.5 font-medium">Acheteur</th>
                  <th className="px-3 py-2.5 text-right font-medium">Prix</th>
                  <th className="px-3 py-2.5 text-right font-medium">Frais + envoi</th>
                  <th className="px-3 py-2.5 text-right font-medium">Coût</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bénéfice</th>
                  <th className="px-3 py-2.5 text-right font-medium">Marge</th>
                  <th className="px-5 py-2.5 text-right font-medium">Délai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map((s) => (
                  <tr key={`${s.kind}${s.id}`} className="hover:bg-surface-2/60">
                    <td className="tabular px-5 py-2.5 text-muted">{fmtDateShort(s.date)}</td>
                    <td className="max-w-[280px] px-3 py-2.5">
                      <Link to={s.kind === 'build' ? `/builds/${s.id}` : `/items/${s.id}`} className="flex items-center gap-1.5 font-medium hover:text-accent">
                        {s.kind === 'build' && <Cpu className="size-4 shrink-0 text-accent" />}
                        <span className="truncate">{s.title}</span>
                      </Link>
                      <p className="text-xs text-muted">{s.ref}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <PlatformTag platform={data.platform(s.platformId)} />
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-fg-2">{s.buyer ?? <span className="text-muted">—</span>}</td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">{eur(s.revenue)}</td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">{s.fees + s.shipping ? eur(-(s.fees + s.shipping)) : '—'}</td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">{eur(s.cost)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Profit value={s.profit} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px]">
                      <Percent value={s.revenue ? s.profit / s.revenue : null} />
                    </td>
                    <td className="tabular px-5 py-2.5 text-right text-muted">{fmtDays(s.daysToSell)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-surface-2/60 text-[13px] font-medium">
                <tr>
                  <td className="px-5 py-2.5" colSpan={4}>
                    {sales.length} vente{sales.length > 1 ? 's' : ''}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{eur(summary.revenue)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{eur(-(summary.fees + summary.shipping))}</td>
                  <td className="tabular px-3 py-2.5 text-right">{eur(summary.cost)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Profit value={summary.grossProfit} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Percent value={summary.margin} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
