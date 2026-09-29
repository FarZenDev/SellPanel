import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allocateLotCost, buildMetrics, itemMetrics, platformFee } from '../shared/calc.ts'
import { checkBuild } from '../shared/compat.ts'
import { presetRange, summarize, dac7Status, collectSales } from '../shared/analytics.ts'
import type { Build, Category, Item, Platform } from '../shared/types.ts'

const base: Item = {
  id: 1,
  sku: 'SP-0001',
  title: 'RTX 3070',
  category_id: null,
  brand: null,
  model: null,
  condition: null,
  status: 'in_stock',
  purchase_platform_id: null,
  purchase_date: '2026-01-01',
  purchase_price: 250,
  purchase_shipping: 10,
  purchase_fees: 13.2,
  extra_costs: 0,
  seller: null,
  purchase_url: null,
  order_ref: null,
  received_date: null,
  lot_id: null,
  build_id: null,
  target_price: null,
  listed_price: null,
  listed_date: null,
  sale_platform_id: null,
  sale_price: null,
  sale_date: null,
  sale_fees: 0,
  sale_shipping: 0,
  buyer: null,
  sale_url: null,
  tracking_number: null,
  shipped_date: null,
  location: null,
  serial_number: null,
  warranty_until: null,
  tags: [],
  specs: {},
  photos: [],
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
const vinted: Platform = {
  id: 1,
  name: 'Vinted',
  color: '#000000',
  url: null,
  search_url: null,
  sale_fee_percent: 0,
  sale_fee_fixed: 0,
  buyer_fee_percent: 5,
  buyer_fee_fixed: 0.7,
  dac7: true,
  archived: false,
  sort_order: 0,
}

test('frais de protection acheteur Vinted : 5 % + 0,70 €', () => {
  assert.equal(platformFee(vinted, 100, 'buyer'), 5.7)
  assert.equal(platformFee(vinted, 100, 'sale'), 0)
})

test('marge et ROI d’un article vendu', () => {
  const m = itemMetrics({ ...base, status: 'sold', sale_price: 340, sale_date: '2026-01-31', sale_fees: 0, sale_shipping: 12 })
  assert.equal(m.cost, 273.2)
  assert.equal(m.net, 328)
  assert.equal(m.profit, 54.8)
  assert.equal(m.daysToSell, 30)
  assert.ok(Math.abs((m.roi ?? 0) - 54.8 / 273.2) < 1e-9)
})

test('bénéfice espéré d’un article en stock', () => {
  const m = itemMetrics({ ...base, listed_price: 320 }, [], '2026-02-10')
  assert.equal(m.expectedProfit, 46.8)
  assert.equal(m.daysHeld, 40)
})

test('répartition du coût d’un lot : somme exacte au centime', () => {
  const lines = [
    { id: 1, weight: 90, manual: null },
    { id: 2, weight: 60, manual: null },
    { id: 3, weight: 150, manual: null },
  ]
  const alloc = allocateLotCost(100, 'value', lines)
  assert.equal([...alloc.values()].reduce((a, b) => a + b, 0).toFixed(2), '100.00')
  assert.equal(alloc.get(3), 50)
  const equal = allocateLotCost(100, 'equal', lines)
  assert.deepEqual([...equal.values()].sort(), [33.33, 33.33, 33.34])
})

test('fiche PC : coût, bénéfice et gain de montage', () => {
  const build: Build = {
    id: 1,
    ref: 'PC-001',
    name: 'Test',
    status: 'sold',
    usage: null,
    description: null,
    target_price: null,
    listed_price: 700,
    listed_date: null,
    sale_platform_id: null,
    sale_price: 650,
    sale_date: '2026-03-01',
    sale_fees: 0,
    sale_shipping: 0,
    extra_costs: 20,
    labor_hours: 5,
    buyer: null,
    warranty_months: 3,
    benchmarks: [],
    checklist: [],
    photos: [],
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
  const parts = [
    { ...base, id: 2, purchase_price: 100, purchase_shipping: 0, purchase_fees: 0, target_price: 130, build_id: 1, status: 'in_build' as const },
    { ...base, id: 3, purchase_price: 300, purchase_shipping: 0, purchase_fees: 0, target_price: 360, build_id: 1, status: 'in_build' as const },
  ]
  const m = buildMetrics(build, parts, { hourly_rate: 10 })
  assert.equal(m.totalCost, 420)
  assert.equal(m.profit, 230)
  assert.equal(m.profitAfterLabor, 180)
  assert.equal(m.hourlyRate, 46)
  assert.equal(m.partsValue, 490)
  assert.equal(m.assemblyGain, 160)
})

test('compatibilité : socket et RAM incompatibles détectés', () => {
  const cats: Category[] = [
    { id: 1, name: 'CPU', slot: 'cpu', color: '#000000', sort_order: 0 },
    { id: 2, name: 'CM', slot: 'motherboard', color: '#000000', sort_order: 0 },
    { id: 3, name: 'RAM', slot: 'ram', color: '#000000', sort_order: 0 },
    { id: 4, name: 'PSU', slot: 'psu', color: '#000000', sort_order: 0 },
    { id: 5, name: 'GPU', slot: 'gpu', color: '#000000', sort_order: 0 },
  ]
  const r = checkBuild(
    [
      { ...base, id: 1, category_id: 1, specs: { socket: 'AM5', tdp: 105 } },
      { ...base, id: 2, category_id: 2, specs: { socket: 'AM4', ram_type: 'DDR4' } },
      { ...base, id: 3, category_id: 3, specs: { ram_type: 'DDR5', capacity: 32 } },
      { ...base, id: 4, category_id: 5, specs: { tdp: 320 } },
      { ...base, id: 5, category_id: 4, specs: { wattage: 450 } },
    ],
    cats,
  )
  const titles = r.checks.map((c) => `${c.level}:${c.title}`)
  assert.ok(titles.some((t) => t.startsWith('error:Socket incompatible')))
  assert.ok(titles.some((t) => t.startsWith('error:Type de mémoire incompatible')))
  assert.ok(titles.some((t) => t.startsWith('error:Alimentation insuffisante')))
})

test('périodes : mois courant et précédent', () => {
  const { range, previous } = presetRange('month', '2026-03-15')
  assert.deepEqual(range, { from: '2026-03-01', to: '2026-03-15' })
  assert.deepEqual(previous, { from: '2026-02-01', to: '2026-02-28' })
})

test('synthèse et seuils DAC7', () => {
  const items: Item[] = Array.from({ length: 31 }, (_, i) => ({
    ...base,
    id: i + 1,
    purchase_price: 10,
    purchase_shipping: 0,
    purchase_fees: 0,
    status: 'sold',
    sale_price: 20,
    sale_date: '2026-02-01',
    sale_platform_id: 1,
  }))
  const sales = collectSales(items, [], { hourly_rate: 0 })
  const s = summarize(sales, [{ id: 1, date: '2026-02-02', category: 'emballage', amount: 10, platform_id: null, description: null, created_at: '' }], {
    from: '2026-01-01',
    to: '2026-12-31',
  })
  assert.equal(s.count, 31)
  assert.equal(s.revenue, 620)
  assert.equal(s.grossProfit, 310)
  assert.equal(s.netProfit, 300)
  const d = dac7Status(sales, [vinted], 2026, { dac7_sales: 30, dac7_amount: 2000 })
  assert.equal(d[0].reached, true)
})
