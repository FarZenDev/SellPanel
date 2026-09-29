import { AlertTriangle, Download, FileSpreadsheet, Info, Landmark } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { byCategory, byPlatform, dac7Status, inRange, monthlySeries, sourcePerformance, summarize } from '@shared/analytics'
import { round2, todayISO } from '@shared/calc'
import { PlatformTag } from '@/components/badges'
import { RevenueProfitChart } from '@/components/charts'
import { PageHeader } from '@/components/layout/app-shell'
import { Percent, Profit } from '@/components/money'
import { KpiCard } from '@/components/stats'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/form'
import { PageLoader, Progress } from '@/components/ui/misc'
import { exportItemsCsv, exportPurchaseRegister, exportSalesLedger } from '@/lib/csv'
import { eur, eur0, fmtDays, num, pct } from '@/lib/format'
import { useAllData } from '@/lib/use-data'
import { cn } from '@/lib/utils'

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('px-3 py-2.5 font-medium first:pl-5 last:pr-5', right && 'text-right')}>{children}</th>
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={cn('px-3 py-2.5 first:pl-5 last:pr-5', right && 'tabular text-right', className)}>{children}</td>
}

export function ReportsPage() {
  const data = useAllData()
  const currentYear = Number(todayISO().slice(0, 4))
  const years = useMemo(() => {
    const set = new Set<number>([currentYear])
    for (const s of data.sales) set.add(Number(s.date.slice(0, 4)))
    for (const i of data.items) if (i.purchase_date) set.add(Number(i.purchase_date.slice(0, 4)))
    return [...set].sort((a, b) => b - a)
  }, [data.sales, data.items, currentYear])
  const [year, setYear] = useState(currentYear)
  const range = { from: `${year}-01-01`, to: `${year}-12-31` }

  const r = useMemo(() => {
    const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
    const yearSales = data.sales.filter((s) => inRange(s.date, range))
    return {
      summary: summarize(data.sales, data.expenses, range),
      months: monthlySeries(data.sales, data.expenses, data.items, keys),
      monthsDetail: keys.map((k) => summarize(data.sales, data.expenses, { from: `${k}-01`, to: `${k}-31` })),
      platforms: byPlatform(yearSales, data.platforms),
      categories: byCategory(yearSales, data.categories),
      sources: sourcePerformance(data.items, data.platforms, range),
      dac7: dac7Status(data.sales, data.platforms, year, data.settings),
      yearSales,
    }
  }, [data, year])

  if (data.isLoading) return <PageLoader />
  const { summary, months, monthsDetail, platforms, categories, sources, dac7, yearSales } = r
  const micro = data.settings.micro_enabled
  const rate = data.settings.micro_rate / 100
  const quarters = [0, 1, 2, 3].map((q) => {
    const rev = round2(monthsDetail.slice(q * 3, q * 3 + 3).reduce((s, m) => s + m.revenue, 0))
    return { label: `T${q + 1}`, revenue: rev, contributions: round2(rev * rate) }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rapports & fiscalité"
        description="Compte de résultat, performance par canal, seuils DAC7 et exports comptables."
        actions={
          <Select className="w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Chiffre d’affaires" value={eur0(summary.revenue)} sub={`${num(summary.count)} ventes`} />
        <KpiCard label="Coût des ventes" value={eur0(summary.cost)} />
        <KpiCard label="Frais & envois" value={eur0(summary.fees + summary.shipping)} />
        <KpiCard label="Bénéfice brut" value={<Profit value={summary.grossProfit} signed={false} className="font-semibold" />} sub={`marge ${pct(summary.margin)}`} />
        <KpiCard label="Dépenses" value={eur0(summary.expenses)} />
        <KpiCard
          label="Bénéfice net"
          value={<Profit value={summary.netProfit} signed={false} className="font-semibold" />}
          sub={summary.roi != null ? `ROI ${pct(summary.roi)}` : undefined}
        />
      </div>

      <Card>
        <CardHeader title={`Évolution ${year}`} />
        <CardBody>
          <RevenueProfitChart data={months} height={260} />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Compte de résultat mensuel" description="Ventes d’articles et de PC montés, dépenses générales incluses." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
              <tr>
                <Th>Mois</Th>
                <Th right>Ventes</Th>
                <Th right>CA</Th>
                <Th right>Coût des ventes</Th>
                <Th right>Frais</Th>
                <Th right>Bénéfice brut</Th>
                <Th right>Dépenses</Th>
                <Th right>Bénéfice net</Th>
                <Th right>Marge</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months.map((m, i) => {
                const d = monthsDetail[i]
                const empty = d.count === 0 && d.expenses === 0
                return (
                  <tr key={m.key} className={cn('hover:bg-surface-2/60', empty && 'text-muted')}>
                    <Td className="capitalize">{m.label}</Td>
                    <Td right>{d.count || '—'}</Td>
                    <Td right>{d.revenue ? eur(d.revenue) : '—'}</Td>
                    <Td right>{d.cost ? eur(d.cost) : '—'}</Td>
                    <Td right>{d.fees + d.shipping ? eur(d.fees + d.shipping) : '—'}</Td>
                    <Td right>{d.count ? <Profit value={d.grossProfit} /> : '—'}</Td>
                    <Td right>{d.expenses ? eur(d.expenses) : '—'}</Td>
                    <Td right>{empty ? '—' : <Profit value={d.netProfit} />}</Td>
                    <Td right>{d.margin != null ? <Percent value={d.margin} /> : '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-border bg-surface-2/60 text-[13px] font-semibold">
              <tr>
                <Td>Total {year}</Td>
                <Td right>{summary.count}</Td>
                <Td right>{eur(summary.revenue)}</Td>
                <Td right>{eur(summary.cost)}</Td>
                <Td right>{eur(summary.fees + summary.shipping)}</Td>
                <Td right>
                  <Profit value={summary.grossProfit} />
                </Td>
                <Td right>{eur(summary.expenses)}</Td>
                <Td right>
                  <Profit value={summary.netProfit} />
                </Td>
                <Td right>
                  <Percent value={summary.margin} />
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Ventes par plateforme" description="Où vendez-vous le mieux ?" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <Th>Plateforme</Th>
                  <Th right>Ventes</Th>
                  <Th right>CA</Th>
                  <Th right>Bénéfice</Th>
                  <Th right>Marge</Th>
                  <Th right>Délai moyen</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {platforms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-muted">
                      Aucune vente en {year}.
                    </td>
                  </tr>
                )}
                {platforms.map((p) => (
                  <tr key={p.id ?? 'none'}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: p.color }} />
                        {p.name}
                      </span>
                    </Td>
                    <Td right>{p.count}</Td>
                    <Td right>{eur(p.revenue)}</Td>
                    <Td right>
                      <Profit value={p.profit} />
                    </Td>
                    <Td right>
                      <Percent value={p.margin} />
                    </Td>
                    <Td right className="text-muted">
                      {p.avgDaysToSell != null ? fmtDays(Math.round(p.avgDaysToSell)) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Sources d’achat" description="Où trouvez-vous les meilleures affaires ? (achats de l’année)" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <Th>Source</Th>
                  <Th right>Achats</Th>
                  <Th right>Investi</Th>
                  <Th right>Écoulement</Th>
                  <Th right>Bénéfice</Th>
                  <Th right>ROI</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-muted">
                      Aucun achat en {year}.
                    </td>
                  </tr>
                )}
                {sources.map((s) => (
                  <tr key={s.id ?? 'none'}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                    </Td>
                    <Td right>{s.bought}</Td>
                    <Td right>{eur0(s.spent)}</Td>
                    <Td right>
                      <span title="Articles revendus seuls / articles achetés (hors pièces intégrées à un PC)">{pct(s.sellThrough)}</span>
                    </Td>
                    <Td right>
                      <Profit value={s.profit} />
                    </Td>
                    <Td right>
                      <Percent value={s.roi} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Ventes par catégorie" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <Th>Catégorie</Th>
                  <Th right>Ventes</Th>
                  <Th right>CA</Th>
                  <Th right>Bénéfice</Th>
                  <Th right>Marge</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => (
                  <tr key={c.id ?? 'none'}>
                    <Td>{c.name}</Td>
                    <Td right>{c.count}</Td>
                    <Td right>{eur(c.revenue)}</Td>
                    <Td right>
                      <Profit value={c.profit} />
                    </Td>
                    <Td right>
                      <Percent value={c.margin} />
                    </Td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted">
                      Aucune vente en {year}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Seuils DAC7"
            icon={<Landmark />}
            description={`Depuis 2024, chaque plateforme transmet au fisc les vendeurs dépassant ${data.settings.dac7_sales} ventes OU ${eur0(data.settings.dac7_amount)} sur l’année civile.`}
          />
          <CardBody className="space-y-4">
            {dac7.map((d) => (
              <div key={d.platform.id}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <PlatformTag platform={d.platform} />
                  <span className={cn('tabular text-xs', d.reached ? 'font-medium text-negative' : 'text-muted')}>
                    {d.reached && <AlertTriangle className="mr-1 inline size-3.5" />}
                    {d.count} / {data.settings.dac7_sales} ventes · {eur0(d.amount)} / {eur0(data.settings.dac7_amount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Progress value={d.countRatio} tone={d.countRatio >= 1 ? 'negative' : d.countRatio > 0.75 ? 'warning' : 'accent'} />
                  <Progress value={d.amountRatio} tone={d.amountRatio >= 1 ? 'negative' : d.amountRatio > 0.75 ? 'warning' : 'accent'} />
                </div>
              </div>
            ))}
            <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
              <Info className="mt-0.5 size-4 shrink-0" />
              Être déclaré ne signifie pas être imposé : la revente de biens personnels d’occasion reste en principe non imposable, contrairement à une activité d’achat pour
              revente régulière. Gardez vos justificatifs d’achat (ils sont dans SellPanel).
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Micro-entreprise"
            description={
              micro
                ? `Estimation des cotisations sociales au taux de ${data.settings.micro_rate} % (vente de marchandises).`
                : 'Activez le suivi dans Paramètres si vous êtes auto-entrepreneur.'
            }
          />
          <CardBody>
            {micro ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-2 font-medium">Trimestre</th>
                      <th className="py-2 text-right font-medium">CA encaissé</th>
                      <th className="py-2 text-right font-medium">Cotisations estimées</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quarters.map((q) => (
                      <tr key={q.label}>
                        <td className="py-2">
                          {q.label} {year}
                        </td>
                        <td className="tabular py-2 text-right">{eur(q.revenue)}</td>
                        <td className="tabular py-2 text-right font-medium">{eur(q.contributions)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border font-semibold">
                    <tr>
                      <td className="py-2">Total</td>
                      <td className="tabular py-2 text-right">{eur(summary.revenue)}</td>
                      <td className="tabular py-2 text-right">{eur(round2(summary.revenue * rate))}</td>
                    </tr>
                  </tfoot>
                </table>
                <p className="mt-3 text-xs text-muted">
                  Estimation indicative hors CFP, taxe consulaire et versement libératoire. Bénéfice net après cotisations :{' '}
                  <strong className="text-fg-2">{eur(summary.netProfit - summary.revenue * rate)}</strong>.
                </p>
              </div>
            ) : (
              <Link to="/settings">
                <Button variant="outline">Activer le suivi micro-entreprise</Button>
              </Link>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Exports comptables" icon={<FileSpreadsheet />} description="Fichiers CSV compatibles Excel / LibreOffice / Google Sheets." />
          <CardBody className="grid gap-2 sm:grid-cols-1">
            <Button variant="outline" className="justify-start" onClick={() => exportSalesLedger(yearSales, data, `livre-des-recettes-${year}`)}>
              <Download /> Livre des recettes {year} ({yearSales.length} ventes)
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() =>
                exportPurchaseRegister(
                  data.items.filter((i) => inRange(i.purchase_date, range)),
                  data,
                )
              }
            >
              <Download /> Registre des achats {year}
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => exportItemsCsv(data.items, data)}>
              <Download /> Inventaire complet
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
