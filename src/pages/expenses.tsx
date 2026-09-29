import { MoreHorizontal, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { inRange, monthKeys, monthlySeries, presetRange, summarize, PERIOD_PRESETS, type PeriodPreset } from '@shared/analytics'
import { round2, todayISO } from '@shared/calc'
import { EXPENSE_CATEGORIES } from '@shared/constants'
import type { Expense } from '@shared/types'
import { PlatformTag } from '@/components/badges'
import { SingleBarChart } from '@/components/charts'
import { useEditors } from '@/components/editors'
import { PageHeader } from '@/components/layout/app-shell'
import { BarList, KpiCard } from '@/components/stats'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog'
import { Select } from '@/components/ui/form'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, PageLoader } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { eur, eur0, fmtDate, pct } from '@/lib/format'
import { useAction } from '@/lib/queries'
import { useAllData } from '@/lib/use-data'

export function ExpensesPage() {
  const data = useAllData()
  const editors = useEditors()
  const confirm = useConfirm()
  const [preset, setPreset] = useState<PeriodPreset>('year')
  const [category, setCategory] = useState('')
  const remove = useAction((id: number) => api.del(`/api/expenses/${id}`), { success: 'Dépense supprimée' })
  const today = todayISO()
  const { range } = presetRange(preset, today)

  const list = useMemo(() => data.expenses.filter((e) => inRange(e.date, range) && (!category || e.category === category)), [data.expenses, range, category])
  const total = round2(list.reduce((s, e) => s + e.amount, 0))
  const summary = useMemo(() => summarize(data.sales, [], range), [data.sales, range])
  const series = useMemo(() => monthlySeries([], data.expenses, [], monthKeys(12, today)), [data.expenses, today])
  const months = new Set(list.map((e) => e.date.slice(0, 7))).size
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ ...c, amount: round2(list.filter((e) => e.category === c.value).reduce((s, e) => s + e.amount, 0)) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  if (data.isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dépenses"
        description="Frais généraux non rattachés à un article : ils sont déduits de votre bénéfice net."
        actions={
          <Button variant="primary" onClick={() => editors.openExpense()}>
            <Plus /> Nouvelle dépense
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Select className="w-48" value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)}>
          {PERIOD_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select className="w-56" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes catégories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total de la période" value={eur0(total)} sub={`${list.length} dépense${list.length > 1 ? 's' : ''}`} />
        <KpiCard label="Moyenne mensuelle" value={eur0(months ? total / months : 0)} />
        <KpiCard label="Part du chiffre d’affaires" value={summary.revenue ? pct(total / summary.revenue) : '—'} />
        <KpiCard label="Bénéfice net" value={eur0(summary.grossProfit - total)} sub={`${eur0(summary.grossProfit)} brut − frais`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Dépenses mensuelles" description="12 derniers mois" />
          <CardBody>
            <SingleBarChart data={series} dataKey="expenses" name="Dépenses" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Par catégorie" />
          <CardBody>
            <BarList
              rows={byCat.map((c) => ({ key: c.value, label: c.label, value: c.amount, display: eur(c.amount), secondary: total ? pct(c.amount / total) : undefined }))}
              empty="Aucune dépense"
            />
          </CardBody>
        </Card>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="Aucune dépense sur la période"
            description="Emballages, carburant pour récupérer un achat, pâte thermique, boosts d’annonces… tout compte pour votre bénéfice réel."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Description</th>
                  <th className="px-3 py-2.5 font-medium">Catégorie</th>
                  <th className="px-3 py-2.5 font-medium">Plateforme</th>
                  <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((e: Expense) => {
                  const cat = EXPENSE_CATEGORIES.find((c) => c.value === e.category)
                  return (
                    <tr key={e.id} className="group hover:bg-surface-2/60">
                      <td className="px-5 py-2.5 text-muted">{fmtDate(e.date)}</td>
                      <td className="px-3 py-2.5">{e.description ?? <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5">{cat && <Badge tone={cat.tone}>{cat.label}</Badge>}</td>
                      <td className="px-3 py-2.5">{e.platform_id ? <PlatformTag platform={data.platform(e.platform_id)} /> : <span className="text-muted">—</span>}</td>
                      <td className="tabular px-3 py-2.5 text-right font-medium">{eur(e.amount)}</td>
                      <td className="pr-3">
                        <Menu>
                          <MenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" className="opacity-60 group-hover:opacity-100" aria-label="Actions">
                              <MoreHorizontal />
                            </Button>
                          </MenuTrigger>
                          <MenuContent>
                            <MenuItem icon={<Pencil />} onSelect={() => editors.openExpense(e)}>
                              Modifier
                            </MenuItem>
                            <MenuItem
                              icon={<Trash2 />}
                              danger
                              onSelect={async () => {
                                if (await confirm({ title: 'Supprimer cette dépense ?', confirmLabel: 'Supprimer', danger: true })) remove.mutate(e.id)
                              }}
                            >
                              Supprimer
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-border bg-surface-2/60 text-[13px] font-medium">
                <tr>
                  <td className="px-5 py-2.5" colSpan={4}>
                    Total
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{eur(total)}</td>
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
