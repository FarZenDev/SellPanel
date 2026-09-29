import { ArrowLeft, Boxes, ExternalLink, Pencil, Plus, Scale, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { itemCost, itemMetrics, round2 } from '@shared/calc'
import type { AllocationMethod, Lot } from '@shared/types'
import { ItemStatusBadge, PlatformTag } from '@/components/badges'
import { useEditors } from '@/components/editors'
import { ALLOCATION_OPTIONS } from '@/components/entity-forms'
import { Profit } from '@/components/money'
import { KpiCard } from '@/components/stats'
import { Timeline } from '@/components/timeline'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog'
import { EmptyState, PageLoader, Progress, Segmented } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { eur, eur0, fmtDate, pct } from '@/lib/format'
import { lotStats } from '@/lib/lot-stats'
import { useAction, useLookups, useLot } from '@/lib/queries'

export function LotDetailPage() {
  const id = Number(useParams().id)
  const { data: lot, isLoading, error } = useLot(id)
  const lk = useLookups()
  const editors = useEditors()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const patch = useAction((body: Partial<Lot>) => api.patch(`/api/lots/${id}`, body), { success: 'Répartition mise à jour' })
  const allocate = useAction(() => api.post(`/api/lots/${id}/allocate`), { success: 'Coûts ajustés au total du lot' })
  const remove = useAction((withItems: boolean) => api.del(`/api/lots/${id}${withItems ? '?items=1' : ''}`), { success: 'Lot supprimé' })

  if (isLoading) return <PageLoader />
  if (error || !lot)
    return (
      <EmptyState
        icon={<Boxes />}
        title="Lot introuvable"
        action={
          <Link to="/lots">
            <Button>Retour aux lots</Button>
          </Link>
        }
      />
    )

  const s = lotStats(lot, lot.items, lk.platforms)
  const unallocated = round2(s.total - s.allocated)

  return (
    <div className="space-y-5">
      <div>
        <Link to="/lots" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Lots
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <PlatformTag platform={lk.platform(lot.platform_id)} />
              <span>· {fmtDate(lot.purchase_date)}</span>
              {lot.seller && <span>· {lot.seller}</span>}
              {lot.url && (
                <a href={lot.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Annonce <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{lot.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => editors.openItem(null, { lot_id: lot.id, purchase_platform_id: lot.platform_id, purchase_date: lot.purchase_date, seller: lot.seller })}
            >
              <Plus /> Ajouter un article
            </Button>
            <Button variant="primary" onClick={() => editors.openLot(lot)}>
              <Pencil /> Modifier
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Supprimer"
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Supprimer ce lot ?',
                    description: 'Les articles du lot sont conservés dans l’inventaire (avec leur coût actuel).',
                    confirmLabel: 'Supprimer le lot',
                    danger: true,
                  }))
                )
                  return
                remove.mutate(false, { onSuccess: () => navigate('/lots') })
              }}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Coût du lot" value={eur0(s.total)} sub={`${eur(lot.price)} + ${eur(lot.shipping + lot.fees)} frais`} />
        <KpiCard label="Articles vendus" value={`${s.soldCount}/${s.count}`} />
        <KpiCard label="Coût récupéré" value={pct(s.recoveredRatio)} sub={`${eur0(s.recovered)} encaissés`} />
        <KpiCard label="Bénéfice réalisé" value={<Profit value={s.realizedProfit} signed={false} className="font-semibold" />} />
        <KpiCard
          label="Bénéfice projeté"
          value={<Profit value={s.projectedProfit} signed={false} className="font-semibold" />}
          sub={`${eur0(s.remainingValue)} encore à vendre`}
          hint="Bénéfice réalisé + bénéfice estimé des articles restants à leur prix affiché ou visé."
        />
      </div>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">Rentabilisation du lot</span>
          <span className="tabular font-medium">
            {eur(s.recovered)} / {eur(s.total)}
          </span>
        </div>
        <Progress value={s.recoveredRatio} tone={s.recoveredRatio >= 1 ? 'positive' : 'accent'} className="h-2.5" />
        <p className="mt-2 text-xs text-muted">
          {s.recoveredRatio >= 1
            ? '✅ Lot remboursé : chaque nouvelle vente est du bénéfice pur.'
            : `Encore ${eur(s.total - s.recovered)} à récupérer avant que le lot soit remboursé.`}
        </p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Articles du lot"
            icon={<Scale />}
            description={ALLOCATION_OPTIONS.find((o) => o.value === lot.allocation)?.hint}
            action={
              lot.allocation === 'manual' ? (
                <Button size="sm" variant="outline" loading={allocate.isPending} onClick={() => allocate.mutate(undefined)} disabled={Math.abs(unallocated) < 0.01}>
                  Ajuster au total
                </Button>
              ) : undefined
            }
          />
          <div className="px-4 pb-3 sm:px-5">
            <Segmented
              value={lot.allocation}
              onChange={(v: AllocationMethod) => patch.mutate({ allocation: v })}
              options={ALLOCATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              size="sm"
            />
            {lot.allocation === 'manual' && Math.abs(unallocated) >= 0.01 && (
              <p className="mt-2 text-xs text-warning">{unallocated > 0 ? `${eur(unallocated)} restent à répartir` : `${eur(-unallocated)} répartis en trop`} sur les articles.</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur visée</th>
                  <th className="px-3 py-2 text-right font-medium">Coût réparti</th>
                  <th className="px-3 py-2 text-right font-medium">Vendu</th>
                  <th className="px-5 py-2 text-right font-medium">Bénéfice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lot.items.map((i) => {
                  const m = itemMetrics(i, lk.platforms)
                  return (
                    <tr key={i.id} onClick={() => navigate(`/items/${i.id}`)} className="cursor-pointer hover:bg-surface-2/60">
                      <td className="px-5 py-2.5">
                        <p className="font-medium">{i.title}</p>
                        <p className="text-xs text-muted">
                          {i.sku}
                          {lk.category(i.category_id) && ` · ${lk.category(i.category_id)?.name}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <ItemStatusBadge status={i.status} />
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-muted">{eur(i.target_price)}</td>
                      <td className="tabular px-3 py-2.5 text-right">{eur(itemCost(i))}</td>
                      <td className="tabular px-3 py-2.5 text-right">{m.sold ? eur(i.sale_price) : <span className="text-muted">{eur(i.listed_price)}</span>}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Profit value={m.sold ? m.profit : i.build_id != null ? null : m.expectedProfit} estimated={!m.sold} />
                      </td>
                    </tr>
                  )
                })}
                {lot.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      Aucun article dans ce lot.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-5">
          {lot.notes && (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="text-sm whitespace-pre-wrap text-fg-2">{lot.notes}</p>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Historique" />
            <CardBody>
              <Timeline events={lot.events} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
