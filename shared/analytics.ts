import { buildMetrics, daysBetween, itemCost, itemMetrics, isBuildSold, isItemSold, round2, todayISO } from './calc.ts'
import { ACTIVE_BUILD_STATUSES, ACTIVE_ITEM_STATUSES } from './constants.ts'
import type { Build, Category, Expense, Item, Platform, Settings } from './types.ts'

export interface SaleRecord {
  kind: 'item' | 'build'
  id: number
  ref: string
  title: string
  date: string
  platformId: number | null
  sourcePlatformId: number | null
  categoryId: number | null
  revenue: number
  fees: number
  shipping: number
  cost: number
  profit: number
  daysToSell: number | null
  buyer: string | null
}

export interface DateRange {
  from: string | null
  to: string | null
}

export type PeriodPreset = '30d' | 'month' | 'last_month' | '90d' | 'year' | '12m' | 'all'

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: '30d', label: '30 derniers jours' },
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: '90d', label: '3 derniers mois' },
  { value: 'year', label: 'Cette année' },
  { value: '12m', label: '12 derniers mois' },
  { value: 'all', label: 'Depuis le début' },
]

const iso = (d: Date) => todayISO(d)

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}

/** Renvoie la période demandée et la période précédente de même durée (pour les variations). */
export function presetRange(preset: PeriodPreset, today = todayISO()): { range: DateRange; previous: DateRange | null } {
  const [y, m] = today.split('-').map(Number)
  switch (preset) {
    case '30d': {
      const from = addDays(today, -29)
      return { range: { from, to: today }, previous: { from: addDays(from, -30), to: addDays(from, -1) } }
    }
    case '90d': {
      const from = addDays(today, -89)
      return { range: { from, to: today }, previous: { from: addDays(from, -90), to: addDays(from, -1) } }
    }
    case 'month': {
      const from = iso(new Date(y, m - 1, 1))
      const prevFrom = iso(new Date(y, m - 2, 1))
      const prevTo = iso(new Date(y, m - 1, 0))
      return { range: { from, to: today }, previous: { from: prevFrom, to: prevTo } }
    }
    case 'last_month': {
      const from = iso(new Date(y, m - 2, 1))
      const to = iso(new Date(y, m - 1, 0))
      return { range: { from, to }, previous: { from: iso(new Date(y, m - 3, 1)), to: iso(new Date(y, m - 2, 0)) } }
    }
    case 'year': {
      const from = `${y}-01-01`
      return { range: { from, to: today }, previous: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` } }
    }
    case '12m': {
      const from = iso(new Date(y - 1, m - 1, Number(today.slice(8, 10)) + 1))
      return { range: { from, to: today }, previous: { from: iso(new Date(y - 2, m - 1, Number(today.slice(8, 10)) + 1)), to: addDays(from, -1) } }
    }
    default:
      return { range: { from: null, to: null }, previous: null }
  }
}

export function inRange(date: string | null | undefined, range: DateRange): boolean {
  if (!date) return false
  const d = date.slice(0, 10)
  if (range.from && d < range.from) return false
  if (range.to && d > range.to) return false
  return true
}

export function componentsByBuild(items: Item[]): Map<number, Item[]> {
  const map = new Map<number, Item[]>()
  for (const i of items) {
    if (i.build_id == null) continue
    const list = map.get(i.build_id)
    if (list) list.push(i)
    else map.set(i.build_id, [i])
  }
  return map
}

/** Unifie ventes d'articles et ventes de PC montés en un seul registre. */
export function collectSales(items: Item[], builds: Build[], settings: Pick<Settings, 'hourly_rate'>): SaleRecord[] {
  const sales: SaleRecord[] = []
  for (const i of items) {
    if (i.build_id != null || !isItemSold(i) || !i.sale_date) continue
    const m = itemMetrics(i)
    sales.push({
      kind: 'item',
      id: i.id,
      ref: i.sku,
      title: i.title,
      date: i.sale_date,
      platformId: i.sale_platform_id,
      sourcePlatformId: i.purchase_platform_id,
      categoryId: i.category_id,
      revenue: i.sale_price ?? 0,
      fees: i.sale_fees || 0,
      shipping: i.sale_shipping || 0,
      cost: m.cost,
      profit: m.profit ?? 0,
      daysToSell: m.daysToSell,
      buyer: i.buyer,
    })
  }
  const byBuild = componentsByBuild(items)
  for (const b of builds) {
    if (!isBuildSold(b) || !b.sale_date) continue
    const comps = byBuild.get(b.id) ?? []
    const m = buildMetrics(b, comps, settings)
    sales.push({
      kind: 'build',
      id: b.id,
      ref: b.ref,
      title: b.name,
      date: b.sale_date,
      platformId: b.sale_platform_id,
      sourcePlatformId: null,
      categoryId: null,
      revenue: b.sale_price ?? 0,
      fees: b.sale_fees || 0,
      shipping: b.sale_shipping || 0,
      cost: m.totalCost,
      profit: m.profit ?? 0,
      daysToSell: m.daysToSell,
      buyer: b.buyer,
    })
  }
  return sales.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export interface Summary {
  count: number
  revenue: number
  cost: number
  fees: number
  shipping: number
  grossProfit: number
  expenses: number
  netProfit: number
  margin: number | null
  roi: number | null
  avgProfit: number | null
  avgBasket: number | null
  avgDaysToSell: number | null
}

export function summarize(sales: SaleRecord[], expenses: Expense[], range: DateRange): Summary {
  const s = sales.filter((x) => inRange(x.date, range))
  const exp = expenses.filter((e) => inRange(e.date, range))
  const revenue = round2(s.reduce((a, x) => a + x.revenue, 0))
  const cost = round2(s.reduce((a, x) => a + x.cost, 0))
  const fees = round2(s.reduce((a, x) => a + x.fees, 0))
  const shipping = round2(s.reduce((a, x) => a + x.shipping, 0))
  const grossProfit = round2(s.reduce((a, x) => a + x.profit, 0))
  const expensesTotal = round2(exp.reduce((a, e) => a + e.amount, 0))
  const netProfit = round2(grossProfit - expensesTotal)
  const days = s.map((x) => x.daysToSell).filter((d): d is number => d != null)
  return {
    count: s.length,
    revenue,
    cost,
    fees,
    shipping,
    grossProfit,
    expenses: expensesTotal,
    netProfit,
    margin: revenue > 0 ? grossProfit / revenue : null,
    roi: cost > 0 ? grossProfit / cost : null,
    avgProfit: s.length ? grossProfit / s.length : null,
    avgBasket: s.length ? revenue / s.length : null,
    avgDaysToSell: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
  }
}

export interface AgingBucket {
  label: string
  min: number
  max: number | null
  count: number
  value: number
}

export interface InventorySnapshot {
  itemCount: number
  buildCount: number
  costValue: number
  expectedRevenue: number
  expectedProfit: number
  listedCount: number
  listedValue: number
  unpricedCount: number
  stale: { item: Item; days: number }[]
  aging: AgingBucket[]
  inTransit: Item[]
  toTest: Item[]
  toShip: { kind: 'item' | 'build'; id: number; title: string; ref: string; date: string | null }[]
}

export function inventorySnapshot(
  items: Item[],
  builds: Build[],
  platforms: Platform[],
  settings: Pick<Settings, 'hourly_rate' | 'stale_days'>,
  today = todayISO(),
): InventorySnapshot {
  const active = items.filter((i) => i.build_id == null && ACTIVE_ITEM_STATUSES.includes(i.status))
  const activeBuilds = builds.filter((b) => ACTIVE_BUILD_STATUSES.includes(b.status))
  const byBuild = componentsByBuild(items)
  let costValue = 0
  let expectedRevenue = 0
  let expectedProfit = 0
  let listedValue = 0
  let unpricedCount = 0
  const aging: AgingBucket[] = [
    { label: '< 30 j', min: 0, max: 29, count: 0, value: 0 },
    { label: '30–59 j', min: 30, max: 59, count: 0, value: 0 },
    { label: '60–89 j', min: 60, max: 89, count: 0, value: 0 },
    { label: '90–179 j', min: 90, max: 179, count: 0, value: 0 },
    { label: '180 j +', min: 180, max: null, count: 0, value: 0 },
  ]
  const stale: { item: Item; days: number }[] = []
  for (const i of active) {
    const m = itemMetrics(i, platforms, today)
    costValue += m.cost
    if (m.expectedPrice != null) {
      expectedRevenue += m.expectedPrice
      expectedProfit += m.expectedProfit ?? 0
    } else {
      unpricedCount++
    }
    if (i.status === 'listed') listedValue += i.listed_price ?? 0
    const days = m.daysHeld ?? 0
    const bucket = aging.find((b) => days >= b.min && (b.max == null || days <= b.max))
    if (bucket && i.status !== 'ordered') {
      bucket.count++
      bucket.value += m.cost
    }
    if (i.status !== 'ordered' && days >= settings.stale_days) stale.push({ item: i, days })
  }
  for (const b of activeBuilds) {
    const m = buildMetrics(b, byBuild.get(b.id) ?? [], settings, platforms)
    costValue += m.totalCost
    if (m.price != null) {
      expectedRevenue += m.price
      expectedProfit += m.profit ?? 0
    } else {
      unpricedCount++
    }
    if (b.status === 'listed') listedValue += b.listed_price ?? 0
  }
  const toShip: InventorySnapshot['toShip'] = []
  for (const i of items) {
    if (i.build_id == null && i.status === 'sold' && !i.shipped_date && i.sale_platform_id != null) {
      const platform = platforms.find((p) => p.id === i.sale_platform_id)
      // Les ventes en main propre n'ont pas d'envoi.
      if (platform && /main propre|direct/i.test(platform.name)) continue
      if (i.sale_date && daysBetween(i.sale_date, today)! > 30) continue
      toShip.push({ kind: 'item', id: i.id, title: i.title, ref: i.sku, date: i.sale_date })
    }
  }
  return {
    itemCount: active.length,
    buildCount: activeBuilds.length,
    costValue: round2(costValue),
    expectedRevenue: round2(expectedRevenue),
    expectedProfit: round2(expectedProfit),
    listedCount: active.filter((i) => i.status === 'listed').length + activeBuilds.filter((b) => b.status === 'listed').length,
    listedValue: round2(listedValue),
    unpricedCount,
    stale: stale.sort((a, b) => b.days - a.days),
    aging: aging.map((a) => ({ ...a, value: round2(a.value) })),
    inTransit: active.filter((i) => i.status === 'ordered'),
    toTest: active.filter((i) => i.status === 'testing'),
    toShip,
  }
}

export interface MonthPoint {
  key: string
  label: string
  revenue: number
  cost: number
  profit: number
  expenses: number
  netProfit: number
  count: number
  purchases: number
}

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' })

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return monthFmt.format(new Date(y, m - 1, 15)).replace('.', '')
}

export function monthKeys(count: number, today = todayISO()): string[] {
  const [y, m] = today.split('-').map(Number)
  const keys: string[] = []
  for (let k = count - 1; k >= 0; k--) {
    const d = new Date(y, m - 1 - k, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export function monthlySeries(sales: SaleRecord[], expenses: Expense[], items: Item[], keys: string[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>(
    keys.map((key) => [key, { key, label: monthLabel(key), revenue: 0, cost: 0, profit: 0, expenses: 0, netProfit: 0, count: 0, purchases: 0 }]),
  )
  for (const s of sales) {
    const p = map.get(s.date.slice(0, 7))
    if (!p) continue
    p.revenue += s.revenue
    p.cost += s.cost
    p.profit += s.profit
    p.count++
  }
  for (const e of expenses) {
    const p = map.get(e.date.slice(0, 7))
    if (p) p.expenses += e.amount
  }
  for (const i of items) {
    if (!i.purchase_date) continue
    const p = map.get(i.purchase_date.slice(0, 7))
    if (p) p.purchases += itemCost(i)
  }
  return [...map.values()].map((p) => ({
    ...p,
    revenue: round2(p.revenue),
    cost: round2(p.cost),
    profit: round2(p.profit),
    expenses: round2(p.expenses),
    netProfit: round2(p.profit - p.expenses),
    purchases: round2(p.purchases),
  }))
}

export interface GroupStat {
  id: number | null
  name: string
  color: string
  count: number
  revenue: number
  profit: number
  margin: number | null
  avgDaysToSell: number | null
}

function group(sales: SaleRecord[], keyOf: (s: SaleRecord) => number | null, describe: (id: number | null) => { name: string; color: string }): GroupStat[] {
  const map = new Map<number | null, SaleRecord[]>()
  for (const s of sales) {
    const k = keyOf(s)
    const list = map.get(k)
    if (list) list.push(s)
    else map.set(k, [s])
  }
  return [...map.entries()]
    .map(([id, list]) => {
      const revenue = round2(list.reduce((a, s) => a + s.revenue, 0))
      const profit = round2(list.reduce((a, s) => a + s.profit, 0))
      const days = list.map((s) => s.daysToSell).filter((d): d is number => d != null)
      return {
        id,
        ...describe(id),
        count: list.length,
        revenue,
        profit,
        margin: revenue > 0 ? profit / revenue : null,
        avgDaysToSell: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

export function byPlatform(sales: SaleRecord[], platforms: Platform[]): GroupStat[] {
  return group(
    sales,
    (s) => s.platformId,
    (id) => {
      const p = platforms.find((x) => x.id === id)
      return { name: p?.name ?? 'Non renseigné', color: p?.color ?? '#94a3b8' }
    },
  )
}

export const BUILD_CATEGORY_ID = -1

export function byCategory(sales: SaleRecord[], categories: Category[]): GroupStat[] {
  return group(
    sales,
    (s) => (s.kind === 'build' ? BUILD_CATEGORY_ID : s.categoryId),
    (id) => {
      if (id === BUILD_CATEGORY_ID) return { name: 'PC montés', color: '#6366f1' }
      const c = categories.find((x) => x.id === id)
      return { name: c?.name ?? 'Sans catégorie', color: c?.color ?? '#94a3b8' }
    },
  )
}

export interface SourceStat {
  id: number | null
  name: string
  color: string
  bought: number
  spent: number
  sold: number
  revenue: number
  profit: number
  roi: number | null
  sellThrough: number | null
}

/** Performance des sources d'achat : où trouve-t-on les meilleures affaires ? */
export function sourcePerformance(items: Item[], platforms: Platform[], range: DateRange): SourceStat[] {
  const map = new Map<number | null, SourceStat>()
  for (const i of items) {
    if (!inRange(i.purchase_date ?? i.created_at, range)) continue
    const key = i.purchase_platform_id
    let stat = map.get(key)
    if (!stat) {
      const p = platforms.find((x) => x.id === key)
      stat = { id: key, name: p?.name ?? 'Non renseigné', color: p?.color ?? '#94a3b8', bought: 0, spent: 0, sold: 0, revenue: 0, profit: 0, roi: null, sellThrough: null }
      map.set(key, stat)
    }
    stat.bought++
    stat.spent += itemCost(i)
    if (i.build_id == null && isItemSold(i)) {
      const m = itemMetrics(i)
      stat.sold++
      stat.revenue += i.sale_price ?? 0
      stat.profit += m.profit ?? 0
    }
  }
  return [...map.values()]
    .map((s) => {
      const soldCost = items
        .filter((i) => i.purchase_platform_id === s.id && i.build_id == null && isItemSold(i) && inRange(i.purchase_date ?? i.created_at, range))
        .reduce((a, i) => a + itemCost(i), 0)
      return {
        ...s,
        spent: round2(s.spent),
        revenue: round2(s.revenue),
        profit: round2(s.profit),
        roi: soldCost > 0 ? s.profit / soldCost : null,
        sellThrough: s.bought ? s.sold / s.bought : null,
      }
    })
    .sort((a, b) => b.spent - a.spent)
}

export interface Dac7Stat {
  platform: Platform
  count: number
  amount: number
  countRatio: number
  amountRatio: number
  reached: boolean
}

/**
 * Suivi des seuils DAC7 : au-delà de 30 ventes OU 2 000 € encaissés sur une année civile,
 * la plateforme transmet vos données de vendeur à l'administration fiscale.
 */
export function dac7Status(sales: SaleRecord[], platforms: Platform[], year: number, settings: Pick<Settings, 'dac7_sales' | 'dac7_amount'>): Dac7Stat[] {
  const range = { from: `${year}-01-01`, to: `${year}-12-31` }
  return platforms
    .filter((p) => p.dac7)
    .map((platform) => {
      const list = sales.filter((s) => s.platformId === platform.id && inRange(s.date, range))
      const count = list.length
      const amount = round2(list.reduce((a, s) => a + s.revenue, 0))
      const countRatio = settings.dac7_sales > 0 ? count / settings.dac7_sales : 0
      const amountRatio = settings.dac7_amount > 0 ? amount / settings.dac7_amount : 0
      return { platform, count, amount, countRatio, amountRatio, reached: countRatio >= 1 || amountRatio >= 1 }
    })
    .filter((d) => d.count > 0 || !d.platform.archived)
    .sort((a, b) => Math.max(b.countRatio, b.amountRatio) - Math.max(a.countRatio, a.amountRatio))
}

export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null
  return (current - previous) / Math.abs(previous)
}
