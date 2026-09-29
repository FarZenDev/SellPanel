import { Boxes, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { PlatformTag } from '@/components/badges'
import { useEditors } from '@/components/editors'
import { PageHeader } from '@/components/layout/app-shell'
import { Profit } from '@/components/money'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, PageLoader, Progress } from '@/components/ui/misc'
import { eur, fmtDate, pct } from '@/lib/format'
import { lotStats } from '@/lib/lot-stats'
import { useAllData } from '@/lib/use-data'

export function LotsPage() {
  const data = useAllData()
  const editors = useEditors()
  const navigate = useNavigate()
  const rows = useMemo(
    () =>
      data.lots.map((lot) => ({
        lot,
        s: lotStats(
          lot,
          data.items.filter((i) => i.lot_id === lot.id),
          data.platforms,
        ),
      })),
    [data.lots, data.items, data.platforms],
  )
  if (data.isLoading) return <PageLoader />
  return (
    <div>
      <PageHeader
        title="Lots & achats groupés"
        description="Lots d’articles et PC complets achetés pour être revendus en pièces : le coût est réparti automatiquement."
        actions={
          <Button variant="primary" onClick={() => editors.openLot()}>
            <Plus /> Nouvel achat groupé
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes />}
            title="Aucun lot"
            description="Vous avez acheté un PC complet pour le démonter, ou un lot de RAM ? Créez un achat groupé : chaque pièce devient un article avec sa part du coût."
            action={
              <Button variant="primary" onClick={() => editors.openLot()}>
                <Plus /> Nouvel achat groupé
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Lot</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 text-right font-medium">Coût</th>
                  <th className="px-3 py-2.5 text-center font-medium">Vendus</th>
                  <th className="w-56 px-3 py-2.5 font-medium">Coût récupéré</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bénéfice réalisé</th>
                  <th className="px-5 py-2.5 text-right font-medium">Projeté</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ lot, s }) => (
                  <tr key={lot.id} onClick={() => navigate(`/lots/${lot.id}`)} className="cursor-pointer hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <p className="font-medium">{lot.name}</p>
                      <p className="text-xs text-muted">{fmtDate(lot.purchase_date)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <PlatformTag platform={data.platform(lot.platform_id)} />
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium">{eur(s.total)}</td>
                    <td className="tabular px-3 py-3 text-center">
                      {s.soldCount}/{s.count}
                    </td>
                    <td className="px-3 py-3">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="tabular">{eur(s.recovered)}</span>
                        <span className={s.recoveredRatio >= 1 ? 'font-medium text-positive' : 'text-muted'}>{pct(s.recoveredRatio)}</span>
                      </div>
                      <Progress value={s.recoveredRatio} tone={s.recoveredRatio >= 1 ? 'positive' : 'accent'} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Profit value={s.realizedProfit} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Profit value={s.projectedProfit} estimated />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
