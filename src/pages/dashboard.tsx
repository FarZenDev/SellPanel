import {
  AlertTriangle,
  ArrowRight,
  Box,
  CircleDollarSign,
  Clock,
  Cpu,
  Flame,
  Landmark,
  Package,
  PackageCheck,
  Percent as PercentIcon,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { byPlatform, dac7Status, inventorySnapshot, monthKeys, monthlySeries, pctChange, presetRange, summarize, PERIOD_PRESETS, type PeriodPreset } from '@shared/analytics'
import { buildMetrics, todayISO } from '@shared/calc'
import { ACTIVE_BUILD_STATUSES } from '@shared/constants'
import { BuildStatusBadge, PlatformTag } from '@/components/badges'
import { RevenueProfitChart } from '@/components/charts'
import { useEditors } from '@/components/editors'
import { PageHeader } from '@/components/layout/app-shell'
import { Profit } from '@/components/money'
import { BarList, KpiCard } from '@/components/stats'
import { Timeline } from '@/components/timeline'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/form'
import { EmptyState, PageLoader, Progress, Segmented } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { eur, eur0, fmtDays, num, pct } from '@/lib/format'
import { useAction, useEvents } from '@/lib/queries'
import { useAllData } from '@/lib/use-data'
import { cn } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir'
}

function Welcome() {
  const editors = useEditors()
  const demo = useAction(() => api.post('/api/demo'), { success: 'Données de démonstration chargées' })
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-accent/15 via-transparent to-transparent">
        <EmptyState
          icon={<Sparkles />}
          title="Bienvenue sur SellPanel"
          description="Enregistrez vos achats (Vinted, Leboncoin, eBay…), suivez vos marges, montez des PC et analysez votre activité. Commencez par votre premier achat ou explorez avec des données de démo."
          action={
            <>
              <Button variant="primary" onClick={() => editors.openItem()}>
                <Plus /> Ajouter mon premier achat
              </Button>
              <Button variant="outline" loading={demo.isPending} onClick={() => demo.mutate(undefined)}>
                Charger des données de démo
              </Button>
            </>
          }
        />
      </div>
    </Card>
  )
}

function TodoRow({ icon, label, count, to, tone }: { icon: React.ReactNode; label: string; count: number; to: string; tone: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2">
      <span className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', tone)}>{icon}</span>
      <span className="flex-1 text-sm text-fg-2">{label}</span>
      <span className="tabular text-sm font-semibold">{count}</span>
      <ArrowRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

export function DashboardPage() {
  const data = useAllData()
  const { data: events = [] } = useEvents(12)
  const editors = useEditors()
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const today = todayISO()

  const view = useMemo(() => {
    const { range, previous } = presetRange(preset, today)
    const current = summarize(data.sales, data.expenses, range)
    const prev = previous ? summarize(data.sales, data.expenses, previous) : null
    const inventory = inventorySnapshot(data.items, data.builds, data.platforms, data.settings, today)
    const series = monthlySeries(data.sales, data.expenses, data.items, monthKeys(12, today))
    const monthRange = presetRange('month', today).range
    const monthSummary = summarize(data.sales, data.expenses, monthRange)
    const platforms = byPlatform(
      data.sales.filter((s) => range.from == null || (s.date >= range.from && s.date <= (range.to ?? s.date))),
      data.platforms,
    )
    const dac7 = dac7Status(data.sales, data.platforms, Number(today.slice(0, 4)), data.settings)
    const top = data.sales
      .filter((s) => (!range.from || s.date >= range.from) && (!range.to || s.date <= range.to))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)
    const activeBuilds = data.builds
      .filter((b) => ACTIVE_BUILD_STATUSES.includes(b.status))
      .map((b) => ({ build: b, m: buildMetrics(b, data.components.get(b.id) ?? [], data.settings, data.platforms) }))
    return { current, prev, inventory, series, monthSummary, platforms, dac7, top, activeBuilds }
  }, [data, preset, today])

  if (data.isLoading) return <PageLoader />
  const empty = data.items.length === 0 && data.builds.length === 0

  const { current, prev, inventory, series, monthSummary, platforms, dac7, top, activeBuilds } = view
  const goal = data.settings.monthly_goal
  const goalRatio = goal > 0 ? monthSummary.netProfit / goal : 0
  const dayOfMonth = Number(today.slice(8, 10))
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()
  const projected = (monthSummary.netProfit / dayOfMonth) * daysInMonth

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()} 👋`}
        description="Vue d’ensemble de votre activité d’achat-revente."
        actions={
          <>
            <Select className="w-44 sm:hidden" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)}>
              {PERIOD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Segmented
              className="hidden sm:inline-flex"
              value={preset}
              onChange={setPreset}
              options={[
                { value: '30d', label: '30 j' },
                { value: 'month', label: 'Ce mois' },
                { value: 'last_month', label: 'Mois dernier' },
                { value: '90d', label: '3 mois' },
                { value: 'year', label: 'Année' },
                { value: 'all', label: 'Tout' },
              ]}
            />
          </>
        }
      />

      {empty ? (
        <Welcome />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Chiffre d’affaires"
              icon={<CircleDollarSign />}
              value={eur0(current.revenue)}
              delta={pctChange(current.revenue, prev?.revenue)}
              sub={prev ? 'vs période préc.' : undefined}
            />
            <KpiCard
              label="Bénéfice net"
              icon={<TrendingUp />}
              value={<Profit value={current.netProfit} signed={false} className="font-semibold" />}
              delta={pctChange(current.netProfit, prev?.netProfit)}
              sub={current.expenses > 0 ? `dont ${eur0(current.expenses)} de frais` : 'après dépenses'}
              hint="Bénéfice des ventes moins les dépenses générales de la période."
            />
            <KpiCard
              label="Marge moyenne"
              icon={<PercentIcon />}
              value={pct(current.margin)}
              sub={current.roi != null ? `ROI ${pct(current.roi)}` : undefined}
              hint="Bénéfice / prix de vente. Le ROI rapporte le bénéfice au coût d’achat."
            />
            <KpiCard
              label="Ventes"
              icon={<Package />}
              value={num(current.count)}
              delta={pctChange(current.count, prev?.count)}
              sub={current.avgDaysToSell != null ? `vendu en ${fmtDays(Math.round(current.avgDaysToSell))}` : undefined}
            />
            <KpiCard
              label="Stock (coût)"
              icon={<Box />}
              value={eur0(inventory.costValue)}
              sub={`${inventory.itemCount} articles · ${inventory.buildCount} PC`}
              hint="Capital immobilisé : coût de revient des articles non vendus et des PC en cours."
            />
            <KpiCard
              label="Bénéfice potentiel"
              icon={<Target />}
              value={<Profit value={inventory.expectedProfit} signed={false} className="font-semibold" />}
              sub={inventory.unpricedCount ? `${inventory.unpricedCount} sans prix visé` : `sur ${eur0(inventory.expectedRevenue)} de revente`}
              hint="Si tout le stock se vend au prix affiché (ou visé)."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Chiffre d’affaires & bénéfice" description="12 derniers mois — articles et PC vendus" />
              <CardBody>
                <RevenueProfitChart data={series} />
              </CardBody>
            </Card>
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader
                  title="Objectif du mois"
                  icon={<Target />}
                  action={
                    <Link to="/settings" className="text-xs text-muted hover:text-accent">
                      Modifier
                    </Link>
                  }
                />
                <CardBody className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <Profit value={monthSummary.netProfit} signed={false} className="text-2xl font-semibold tracking-tight" />
                    <span className="text-sm text-muted">/ {eur0(goal)}</span>
                  </div>
                  <Progress value={goalRatio} tone={goalRatio >= 1 ? 'positive' : 'accent'} className="h-2" />
                  <p className="text-xs text-muted">
                    {goalRatio >= 1 ? '🎉 Objectif atteint ! ' : `${pct(Math.max(0, goalRatio))} atteint. `}
                    Projection fin de mois : <strong className="text-fg-2">{eur0(projected)}</strong>
                  </p>
                </CardBody>
              </Card>
              <Card className="flex-1">
                <CardHeader title="À faire" />
                <CardBody className="-mt-1 space-y-0.5 px-2 sm:px-3">
                  <TodoRow icon={<Truck />} label="Ventes à expédier" count={inventory.toShip.length} to="/sales" tone="bg-orange-500/10 text-orange-600 dark:text-orange-400" />
                  <TodoRow
                    icon={<PackageCheck />}
                    label="Commandes en transit"
                    count={inventory.inTransit.length}
                    to="/items?status=ordered"
                    tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  />
                  <TodoRow
                    icon={<Wrench />}
                    label="À tester / réparer"
                    count={inventory.toTest.length}
                    to="/items?status=testing"
                    tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  />
                  <TodoRow
                    icon={<Clock />}
                    label={`Stock dormant (> ${data.settings.stale_days} j)`}
                    count={inventory.stale.length}
                    to="/items?stale=1"
                    tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  />
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Ventes par plateforme" description={PERIOD_PRESETS.find((p) => p.value === preset)?.label} />
              <CardBody>
                <BarList
                  rows={platforms.map((p) => ({
                    key: p.id ?? 'none',
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: p.color }} />
                        {p.name}
                      </span>
                    ),
                    value: p.revenue,
                    display: eur0(p.revenue),
                    secondary: `${p.count} · ${pct(p.margin)}`,
                  }))}
                  empty="Aucune vente sur la période"
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Stock dormant"
                icon={<Flame />}
                description="Articles immobilisés depuis longtemps : pensez à baisser le prix."
                action={
                  <Link to="/items?stale=1" className="text-xs text-muted hover:text-accent">
                    Tout voir
                  </Link>
                }
              />
              <CardBody className="space-y-1">
                {inventory.stale.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">Rien ne dort en stock. 👌</p>
                ) : (
                  inventory.stale.slice(0, 5).map(({ item, days }) => (
                    <Link key={item.id} to={`/items/${item.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                      <span className="tabular text-xs text-muted">{eur(item.listed_price ?? item.target_price)}</span>
                      <span className="tabular w-14 text-right text-xs font-medium text-negative">{fmtDays(days)}</span>
                    </Link>
                  ))
                )}
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted">Âge du stock (valeur au coût)</p>
                  <BarList rows={inventory.aging.map((a) => ({ key: a.label, label: a.label, value: a.value, display: eur0(a.value), secondary: `${a.count}` }))} />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Seuils DAC7"
                icon={<Landmark />}
                description={`Année ${today.slice(0, 4)} — déclaration automatique au fisc au-delà de ${data.settings.dac7_sales} ventes ou ${eur0(data.settings.dac7_amount)} par plateforme.`}
                action={
                  <Link to="/reports" className="text-xs text-muted hover:text-accent">
                    Détails
                  </Link>
                }
              />
              <CardBody className="space-y-4">
                {dac7.filter((d) => d.count > 0).length === 0 && <p className="py-4 text-center text-sm text-muted">Aucune vente cette année.</p>}
                {dac7
                  .filter((d) => d.count > 0)
                  .slice(0, 4)
                  .map((d) => {
                    const ratio = Math.max(d.countRatio, d.amountRatio)
                    return (
                      <div key={d.platform.id}>
                        <div className="mb-1.5 flex items-center justify-between text-[13px]">
                          <PlatformTag platform={d.platform} />
                          <span className={cn('tabular text-xs', d.reached ? 'font-medium text-negative' : 'text-muted')}>
                            {d.reached && <AlertTriangle className="mr-1 inline size-3.5" />}
                            {d.count}/{data.settings.dac7_sales} ventes · {eur0(d.amount)}
                          </span>
                        </div>
                        <Progress value={ratio} tone={d.reached ? 'negative' : ratio > 0.75 ? 'warning' : 'accent'} />
                      </div>
                    )
                  })}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Meilleures ventes"
                description="Par bénéfice, sur la période"
                action={
                  <Link to="/sales" className="text-xs text-muted hover:text-accent">
                    Registre des ventes
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <tbody className="divide-y divide-border">
                    {top.length === 0 && (
                      <tr>
                        <td className="px-5 py-8 text-center text-muted">Aucune vente sur la période.</td>
                      </tr>
                    )}
                    {top.map((s) => (
                      <tr key={`${s.kind}${s.id}`} className="hover:bg-surface-2/60">
                        <td className="px-5 py-2.5">
                          <Link to={s.kind === 'build' ? `/builds/${s.id}` : `/items/${s.id}`} className="flex items-center gap-2 font-medium hover:text-accent">
                            {s.kind === 'build' && <Cpu className="size-4 text-accent" />}
                            <span className="truncate">{s.title}</span>
                          </Link>
                          <span className="text-xs text-muted">{s.ref}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <PlatformTag platform={data.platform(s.platformId)} />
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-fg-2">{eur(s.revenue)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <Profit value={s.profit} />
                          <div className="text-xs text-muted">{s.cost > 0 ? `ROI ${pct(s.profit / s.cost)}` : ''}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardHeader title="Activité récente" />
              <CardBody className="max-h-96 overflow-y-auto">
                <Timeline events={events} showLinks />
              </CardBody>
            </Card>
          </div>

          {activeBuilds.length > 0 && (
            <Card>
              <CardHeader
                title="PC en cours"
                icon={<Cpu />}
                action={
                  <Button size="sm" variant="outline" onClick={() => editors.openBuild()}>
                    <Plus /> Nouveau PC
                  </Button>
                }
              />
              <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeBuilds.map(({ build, m }) => {
                  const done = build.checklist.filter((c) => c.done).length
                  return (
                    <Link
                      key={build.id}
                      to={`/builds/${build.id}`}
                      className="rounded-xl border border-border p-3.5 transition-colors hover:border-accent/50 hover:bg-surface-2/50"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{build.name}</p>
                          <p className="text-xs text-muted">
                            {build.ref} · {m.componentCount} pièces
                          </p>
                        </div>
                        <BuildStatusBadge status={build.status} />
                      </div>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-muted">
                          Coût <span className="tabular text-fg-2">{eur0(m.totalCost)}</span>
                        </span>
                        <Profit value={m.profit} estimated={!m.sold} />
                      </div>
                      {build.checklist.length > 0 && (
                        <Progress className="mt-2.5" value={done / build.checklist.length} tone={done === build.checklist.length ? 'positive' : 'accent'} />
                      )}
                    </Link>
                  )
                })}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
