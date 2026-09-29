import type { Build, Item, Platform, Settings } from './types.ts'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const DAY = 86_400_000

/** Convertit une date 'YYYY-MM-DD' (ou ISO) en timestamp UTC minuit. */
export function toTime(date: string | null | undefined): number | null {
  if (!date) return null
  const t = Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date)
  return Number.isNaN(t) ? null : t
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = toTime(from)
  const b = toTime(to)
  if (a == null || b == null) return null
  return Math.max(0, Math.round((b - a) / DAY))
}

/** Frais calculés selon la grille d'une plateforme. */
export function platformFee(platform: Platform | undefined | null, price: number | null | undefined, kind: 'sale' | 'buyer'): number {
  if (!platform || !price) return 0
  const pct = kind === 'sale' ? platform.sale_fee_percent : platform.buyer_fee_percent
  const fixed = kind === 'sale' ? platform.sale_fee_fixed : platform.buyer_fee_fixed
  if (!pct && !fixed) return 0
  return round2((price * pct) / 100 + fixed)
}

/** Coût de revient complet d'un article (prix + port + frais d'achat + réparations). */
export function itemCost(i: Pick<Item, 'purchase_price' | 'purchase_shipping' | 'purchase_fees' | 'extra_costs'>): number {
  return round2((i.purchase_price || 0) + (i.purchase_shipping || 0) + (i.purchase_fees || 0) + (i.extra_costs || 0))
}

export function isItemSold(i: Pick<Item, 'status' | 'sale_price'>): boolean {
  return i.status === 'sold' && i.sale_price != null
}

export function isBuildSold(b: Pick<Build, 'status' | 'sale_price'>): boolean {
  return b.status === 'sold' && b.sale_price != null
}

export interface ItemMetrics {
  cost: number
  sold: boolean
  revenue: number | null
  net: number | null
  profit: number | null
  margin: number | null
  roi: number | null
  daysHeld: number | null
  daysToSell: number | null
  /** Prix de vente espéré (affiché ou estimé). */
  expectedPrice: number | null
  expectedProfit: number | null
  expectedRoi: number | null
}

export function itemMetrics(item: Item, platforms: Platform[] = [], today = todayISO()): ItemMetrics {
  const cost = itemCost(item)
  const sold = isItemSold(item)
  const start = item.purchase_date ?? item.created_at?.slice(0, 10) ?? null
  if (sold) {
    const revenue = item.sale_price ?? 0
    const net = round2(revenue - (item.sale_fees || 0) - (item.sale_shipping || 0))
    const profit = round2(net - cost)
    return {
      cost,
      sold,
      revenue,
      net,
      profit,
      margin: revenue > 0 ? profit / revenue : null,
      roi: cost > 0 ? profit / cost : null,
      daysHeld: daysBetween(start, item.sale_date),
      daysToSell: daysBetween(start, item.sale_date),
      expectedPrice: revenue,
      expectedProfit: profit,
      expectedRoi: cost > 0 ? profit / cost : null,
    }
  }
  const expectedPrice = item.listed_price ?? item.target_price ?? null
  let expectedProfit: number | null = null
  if (expectedPrice != null) {
    const platform = platforms.find((p) => p.id === item.sale_platform_id)
    expectedProfit = round2(expectedPrice - platformFee(platform, expectedPrice, 'sale') - cost)
  }
  return {
    cost,
    sold,
    revenue: null,
    net: null,
    profit: null,
    margin: null,
    roi: null,
    daysHeld: daysBetween(start, today),
    daysToSell: null,
    expectedPrice,
    expectedProfit,
    expectedRoi: expectedProfit != null && cost > 0 ? expectedProfit / cost : null,
  }
}

export interface BuildMetrics {
  componentsCost: number
  extraCosts: number
  totalCost: number
  laborCost: number
  /** Valeur de revente estimée des pièces vendues séparément. */
  partsValue: number
  price: number | null
  sold: boolean
  net: number | null
  profit: number | null
  profitAfterLabor: number | null
  margin: number | null
  roi: number | null
  hourlyRate: number | null
  /** Gain (ou perte) de valeur apporté par le montage vs revente en pièces. */
  assemblyGain: number | null
  daysToSell: number | null
  componentCount: number
}

export function buildMetrics(build: Build, components: Item[], settings: Pick<Settings, 'hourly_rate'>, platforms: Platform[] = []): BuildMetrics {
  const componentsCost = round2(components.reduce((s, c) => s + itemCost(c), 0))
  const extraCosts = round2(build.extra_costs || 0)
  const totalCost = round2(componentsCost + extraCosts)
  const laborCost = round2((build.labor_hours || 0) * (settings.hourly_rate || 0))
  const partsValue = round2(components.reduce((s, c) => s + (c.target_price ?? c.listed_price ?? itemCost(c)), 0))
  const sold = isBuildSold(build)
  const price = sold ? build.sale_price : (build.listed_price ?? build.target_price ?? null)
  let net: number | null = null
  if (price != null) {
    if (sold) {
      net = round2(price - (build.sale_fees || 0) - (build.sale_shipping || 0))
    } else {
      const platform = platforms.find((p) => p.id === build.sale_platform_id)
      net = round2(price - platformFee(platform, price, 'sale'))
    }
  }
  const profit = net != null ? round2(net - totalCost) : null
  const firstPurchase = components
    .map((c) => c.purchase_date)
    .filter((d): d is string => !!d)
    .sort()[0]
  return {
    componentsCost,
    extraCosts,
    totalCost,
    laborCost,
    partsValue,
    price,
    sold,
    net,
    profit,
    profitAfterLabor: profit != null ? round2(profit - laborCost) : null,
    margin: profit != null && price ? profit / price : null,
    roi: profit != null && totalCost > 0 ? profit / totalCost : null,
    hourlyRate: profit != null && build.labor_hours > 0 ? round2(profit / build.labor_hours) : null,
    assemblyGain: price != null ? round2(price - partsValue) : null,
    daysToSell: sold ? daysBetween(firstPurchase ?? build.created_at.slice(0, 10), build.sale_date) : null,
    componentCount: components.length,
  }
}

export interface AllocationInput {
  id: number
  weight: number | null
  manual: number | null
}

/**
 * Répartit le coût total d'un lot entre ses articles.
 * - value : au prorata de la valeur de revente estimée (méthode recommandée pour la revente en pièces)
 * - equal : parts égales
 * - manual : montants saisis, remis à l'échelle si leur somme diffère du total
 * La somme des montants retournés est toujours exactement égale au total (arrondi au centime).
 */
export function allocateLotCost(total: number, method: 'value' | 'equal' | 'manual', lines: AllocationInput[]): Map<number, number> {
  const out = new Map<number, number>()
  if (lines.length === 0) return out
  const cents = Math.round(total * 100)
  let weights: number[]
  if (method === 'manual') {
    weights = lines.map((l) => Math.max(0, l.manual ?? 0))
  } else if (method === 'value') {
    weights = lines.map((l) => Math.max(0, l.weight ?? 0))
  } else {
    weights = lines.map(() => 1)
  }
  let sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    weights = lines.map(() => 1)
    sum = lines.length
  }
  const raw = weights.map((w) => (cents * w) / sum)
  const floored = raw.map(Math.floor)
  let remainder = cents - floored.reduce((a, b) => a + b, 0)
  // Distribue les centimes restants aux plus grandes parties décimales (méthode du plus fort reste).
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (remainder <= 0) break
    floored[i] += 1
    remainder -= 1
  }
  lines.forEach((l, idx) => out.set(l.id, floored[idx] / 100))
  return out
}
