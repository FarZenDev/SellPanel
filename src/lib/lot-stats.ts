import { itemCost, itemMetrics, round2 } from '@shared/calc'
import type { Item, Lot, Platform } from '@shared/types'

export interface LotStats {
  total: number
  allocated: number
  count: number
  soldCount: number
  recovered: number
  realizedProfit: number
  remainingValue: number
  projectedProfit: number
  recoveredRatio: number
}

/** Indicateurs d'un lot : combien du prix d'achat a déjà été récupéré par les ventes ? */
export function lotStats(lot: Lot, items: Item[], platforms: Platform[]): LotStats {
  const total = round2(lot.price + lot.shipping + lot.fees)
  let recovered = 0
  let realizedProfit = 0
  let remainingValue = 0
  let expectedProfit = 0
  let soldCount = 0
  for (const i of items) {
    const m = itemMetrics(i, platforms)
    if (m.sold) {
      soldCount++
      recovered += m.net ?? 0
      realizedProfit += m.profit ?? 0
    } else if (i.build_id == null && !['kept', 'broken'].includes(i.status)) {
      remainingValue += m.expectedPrice ?? 0
      expectedProfit += m.expectedProfit ?? 0
    }
  }
  return {
    total,
    allocated: round2(items.reduce((s, i) => s + itemCost(i) - i.extra_costs, 0)),
    count: items.length,
    soldCount,
    recovered: round2(recovered),
    realizedProfit: round2(realizedProfit),
    remainingValue: round2(remainingValue),
    projectedProfit: round2(realizedProfit + expectedProfit),
    recoveredRatio: total > 0 ? recovered / total : 0,
  }
}
