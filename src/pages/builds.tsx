import { Cpu, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { buildMetrics, round2 } from '@shared/calc'
import { ACTIVE_BUILD_STATUSES } from '@shared/constants'
import { BuildStatusBadge } from '@/components/badges'
import { useEditors } from '@/components/editors'
import { PageHeader } from '@/components/layout/app-shell'
import { Profit } from '@/components/money'
import { KpiCard } from '@/components/stats'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, PageLoader, Progress, Segmented } from '@/components/ui/misc'
import { photoUrl } from '@/lib/api'
import { eur, eur0, fmtDate, fmtDays, pct } from '@/lib/format'
import { useAllData } from '@/lib/use-data'

type Tab = 'active' | 'sold' | 'all'

export function BuildsPage() {
  const data = useAllData()
  const editors = useEditors()
  const [tab, setTab] = useState<Tab>('active')

  const rows = useMemo(
    () => data.builds.map((b) => ({ build: b, comps: data.components.get(b.id) ?? [], m: buildMetrics(b, data.components.get(b.id) ?? [], data.settings, data.platforms) })),
    [data.builds, data.components, data.settings, data.platforms],
  )
  const filtered = rows.filter((r) => (tab === 'all' ? true : tab === 'sold' ? r.build.status === 'sold' : ACTIVE_BUILD_STATUSES.includes(r.build.status)))

  const stats = useMemo(() => {
    const active = rows.filter((r) => ACTIVE_BUILD_STATUSES.includes(r.build.status))
    const sold = rows.filter((r) => r.m.sold)
    const soldProfit = sold.reduce((s, r) => s + (r.m.profit ?? 0), 0)
    const hours = sold.reduce((s, r) => s + r.build.labor_hours, 0)
    const days = sold.map((r) => r.m.daysToSell).filter((d): d is number => d != null)
    return {
      active: active.length,
      capital: round2(active.reduce((s, r) => s + r.m.totalCost, 0)),
      avgProfit: sold.length ? soldProfit / sold.length : null,
      hourly: hours > 0 ? soldProfit / hours : null,
      sold: sold.length,
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    }
  }, [rows])

  if (data.isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="PC montés"
        description="Assemblez, testez et revendez des PC complets : coût des pièces, main d’œuvre et marge réelle."
        actions={
          <Button variant="primary" onClick={() => editors.openBuild()}>
            <Plus /> Nouveau PC
          </Button>
        }
      />

      {rows.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="PC en cours" value={stats.active} sub={`${eur0(stats.capital)} immobilisés`} />
          <KpiCard label="PC vendus" value={stats.sold} sub={stats.avgDays != null ? `vendus en ${fmtDays(stats.avgDays)} en moyenne` : undefined} />
          <KpiCard label="Bénéfice moyen / PC" value={<Profit value={stats.avgProfit} signed={false} className="font-semibold" />} />
          <KpiCard
            label="Taux horaire réel"
            value={stats.hourly != null ? `${eur0(stats.hourly)}/h` : '—'}
            hint="Bénéfice des PC vendus divisé par les heures de montage et de test saisies."
          />
        </div>
      )}

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'En cours', count: rows.filter((r) => ACTIVE_BUILD_STATUSES.includes(r.build.status)).length },
          { value: 'sold', label: 'Vendus', count: rows.filter((r) => r.build.status === 'sold').length },
          { value: 'all', label: 'Tous', count: rows.length },
        ]}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Cpu />}
            title={rows.length ? 'Aucun PC dans cette vue' : 'Aucun PC monté'}
            description="Créez une fiche PC, ajoutez les pièces depuis votre stock : SellPanel calcule le coût total, vérifie la compatibilité et génère l’annonce."
            action={
              <Button variant="primary" onClick={() => editors.openBuild()}>
                <Plus /> Nouveau PC
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ build, m }) => {
            const done = build.checklist.filter((c) => c.done).length
            return (
              <Link key={build.id} to={`/builds/${build.id}`} className="group">
                <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                  <div className="relative aspect-[16/7] overflow-hidden border-b border-border bg-gradient-to-br from-accent/20 via-accent/5 to-surface-2">
                    {build.photos[0] ? (
                      <img src={photoUrl(build.photos[0])} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Cpu className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-accent/40" strokeWidth={1.25} />
                    )}
                    <div className="absolute top-3 left-3">
                      <BuildStatusBadge status={build.status} className="bg-surface/90 backdrop-blur" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-xs text-muted">
                      {build.ref}
                      {build.usage && ` · ${build.usage}`}
                    </p>
                    <h3 className="mt-0.5 truncate text-[15px] font-semibold group-hover:text-accent">{build.name}</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted">Coût</p>
                        <p className="tabular font-medium">{eur0(m.totalCost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">{m.sold ? 'Vendu' : 'Prix'}</p>
                        <p className="tabular font-medium">{eur0(m.price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Bénéfice</p>
                        <Profit value={m.profit} estimated={!m.sold} className="text-sm" />
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="mb-1.5 flex justify-between text-xs text-muted">
                        <span>
                          {m.componentCount} pièce{m.componentCount > 1 ? 's' : ''} · {m.margin != null ? `marge ${pct(m.margin)}` : 'prix à définir'}
                        </span>
                        <span>{m.sold && build.sale_date ? fmtDate(build.sale_date) : `Tests ${done}/${build.checklist.length}`}</span>
                      </div>
                      {!m.sold && build.checklist.length > 0 && <Progress value={done / build.checklist.length} tone={done === build.checklist.length ? 'positive' : 'accent'} />}
                      {m.sold && <p className="text-xs text-muted">Net encaissé {eur(m.net)}</p>}
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
