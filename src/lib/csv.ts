import Papa from 'papaparse'
import { itemCost, itemMetrics } from '@shared/calc'
import { CONDITIONS, ITEM_STATUSES } from '@shared/constants'
import type { SaleRecord } from '@shared/analytics'
import type { Item } from '@shared/types'
import type { Lookups } from './queries'
import { downloadFile, normalize } from './utils'

const n2 = (v: number | null | undefined) => (v == null ? '' : v.toFixed(2).replace('.', ','))

function toCsv(rows: Record<string, unknown>[]): string {
  // Point-virgule + BOM : ouverture directe dans Excel en français.
  return '﻿' + Papa.unparse(rows, { delimiter: ';' })
}

export function exportItemsCsv(items: Item[], lk: Lookups, name = 'inventaire') {
  const rows = items.map((i) => {
    const m = itemMetrics(i, lk.platforms)
    return {
      SKU: i.sku,
      Titre: i.title,
      Catégorie: lk.category(i.category_id)?.name ?? '',
      Marque: i.brand ?? '',
      Modèle: i.model ?? '',
      État: CONDITIONS.find((c) => c.value === i.condition)?.label ?? '',
      Statut: ITEM_STATUSES.find((s) => s.value === i.status)?.label ?? i.status,
      'Plateforme achat': lk.platform(i.purchase_platform_id)?.name ?? '',
      'Date achat': i.purchase_date ?? '',
      'Prix achat': n2(i.purchase_price),
      'Frais de port achat': n2(i.purchase_shipping),
      'Frais protection': n2(i.purchase_fees),
      'Frais annexes': n2(i.extra_costs),
      'Coût de revient': n2(itemCost(i)),
      Vendeur: i.seller ?? '',
      'Prix visé': n2(i.target_price),
      'Prix affiché': n2(i.listed_price),
      'Plateforme vente': lk.platform(i.sale_platform_id)?.name ?? '',
      'Date vente': i.sale_date ?? '',
      'Prix vente': n2(i.sale_price),
      'Frais vente': n2(i.sale_fees),
      'Frais envoi': n2(i.sale_shipping),
      Bénéfice: n2(m.profit),
      Acheteur: i.buyer ?? '',
      Emplacement: i.location ?? '',
      'N° série': i.serial_number ?? '',
      Tags: i.tags.join(', '),
      Notes: i.notes ?? '',
    }
  })
  downloadFile(`sellpanel-${name}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
}

/** Livre des recettes (micro-entreprise) : chronologique, montant encaissé et mode d'encaissement. */
export function exportSalesLedger(sales: SaleRecord[], lk: Lookups, name = 'livre-des-recettes') {
  const rows = [...sales]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      Date: s.date,
      Référence: s.ref,
      Client: s.buyer ?? '',
      Nature: s.kind === 'build' ? `PC monté — ${s.title}` : s.title,
      Plateforme: lk.platform(s.platformId)?.name ?? '',
      'Montant encaissé': n2(s.revenue),
      'Frais plateforme': n2(s.fees),
      "Frais d'envoi": n2(s.shipping),
      'Coût de revient': n2(s.cost),
      Bénéfice: n2(s.profit),
    }))
  downloadFile(`sellpanel-${name}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
}

/** Registre des achats : un achat par ligne (articles unitaires). */
export function exportPurchaseRegister(items: Item[], lk: Lookups) {
  const rows = [...items]
    .filter((i) => i.purchase_date)
    .sort((a, b) => (a.purchase_date ?? '').localeCompare(b.purchase_date ?? ''))
    .map((i) => ({
      Date: i.purchase_date ?? '',
      Référence: i.sku,
      Fournisseur: i.seller ?? '',
      Plateforme: lk.platform(i.purchase_platform_id)?.name ?? '',
      Nature: i.title,
      Montant: n2(itemCost(i)),
      'Réf. commande': i.order_ref ?? '',
    }))
  downloadFile(`sellpanel-registre-des-achats-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
}

export interface ImportRow extends Partial<Item> {
  title: string
  purchase_platform_name?: string
  sale_platform_name?: string
  category_name?: string
}

const num = (v: unknown): number | null => {
  if (v == null) return null
  const s = String(v).replace(/\s|€/g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const date = (v: unknown): string | null => {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

/** Lit un CSV (export SellPanel ou tableur maison) — colonnes reconnues sans tenir compte des accents / majuscules. */
export function parseItemsCsv(text: string): { rows: ImportRow[]; skipped: number } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true, delimiter: '' })
  const get = (row: Record<string, string>, ...names: string[]) => {
    for (const key of Object.keys(row)) {
      const k = normalize(key).replace(/[^a-z0-9]/g, '')
      if (names.some((n) => normalize(n).replace(/[^a-z0-9]/g, '') === k)) return row[key]
    }
    return undefined
  }
  const statusOf = (label: string | undefined) => {
    if (!label) return undefined
    const l = normalize(label)
    return ITEM_STATUSES.find((s) => normalize(s.label) === l || s.value === l)?.value
  }
  const conditionOf = (label: string | undefined) => {
    if (!label) return undefined
    const l = normalize(label)
    return CONDITIONS.find((c) => normalize(c.label) === l || c.value === l)?.value
  }
  let skipped = 0
  const rows: ImportRow[] = []
  for (const r of parsed.data) {
    const title = (get(r, 'Titre', 'Title', 'Article', 'Nom', 'Désignation') ?? '').trim()
    if (!title) {
      skipped++
      continue
    }
    const salePrice = num(get(r, 'Prix vente', 'Prix de vente', 'Vendu'))
    const row: ImportRow = {
      title,
      brand: get(r, 'Marque', 'Brand')?.trim() || null,
      model: get(r, 'Modèle', 'Model')?.trim() || null,
      condition: conditionOf(get(r, 'État', 'Etat', 'Condition')) ?? null,
      status: statusOf(get(r, 'Statut', 'Status')) ?? (salePrice != null ? 'sold' : 'in_stock'),
      purchase_date: date(get(r, 'Date achat', "Date d'achat")),
      purchase_price: num(get(r, 'Prix achat', "Prix d'achat", 'Achat')) ?? 0,
      purchase_shipping: num(get(r, 'Frais de port achat', 'Port achat')) ?? 0,
      purchase_fees: num(get(r, 'Frais protection', 'Frais achat')) ?? 0,
      extra_costs: num(get(r, 'Frais annexes', 'Réparations')) ?? 0,
      seller: get(r, 'Vendeur')?.trim() || null,
      target_price: num(get(r, 'Prix visé', 'Prix estimé', 'Cote')),
      listed_price: num(get(r, 'Prix affiché', 'Prix annonce')),
      sale_date: date(get(r, 'Date vente', 'Date de vente')),
      sale_price: salePrice,
      sale_fees: num(get(r, 'Frais vente', 'Commission')) ?? 0,
      sale_shipping: num(get(r, 'Frais envoi', "Frais d'envoi")) ?? 0,
      buyer: get(r, 'Acheteur')?.trim() || null,
      location: get(r, 'Emplacement')?.trim() || null,
      serial_number: get(r, 'N° série', 'Numéro de série', 'Serial')?.trim() || null,
      tags: (get(r, 'Tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: get(r, 'Notes')?.trim() || null,
      purchase_platform_name: get(r, 'Plateforme achat', 'Acheté sur', 'Site achat')?.trim() || undefined,
      sale_platform_name: get(r, 'Plateforme vente', 'Vendu sur', 'Site vente')?.trim() || undefined,
      category_name: get(r, 'Catégorie', 'Categorie', 'Category')?.trim() || undefined,
    }
    rows.push(row)
  }
  return { rows, skipped }
}
