import fs from 'node:fs'
import path from 'node:path'
import { allocateLotCost, round2, todayISO } from '../shared/calc.ts'
import { BUILD_STATUSES, DEFAULT_CHECKLIST, ITEM_STATUSES } from '../shared/constants.ts'
import type { AppEvent, Backup, Build, BuildDetail, Category, Expense, Item, ItemDetail, Lot, LotDetail, Platform, Settings } from '../shared/types.ts'
import { getSettings, openDb, saveSettings, transaction, type DB, type Row, type SqlValue } from './db.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const JSON_COLUMNS: Record<string, string[]> = {
  items: ['tags', 'specs', 'photos'],
  builds: ['benchmarks', 'checklist', 'photos'],
}
const BOOL_COLUMNS: Record<string, string[]> = {
  platforms: ['dac7', 'archived'],
}
const TIMESTAMPED = new Set(['items', 'builds', 'lots'])

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const fmt = (n: number | null | undefined) => (n == null ? '—' : eur.format(n))
const itemStatusLabel = (s: string) => ITEM_STATUSES.find((x) => x.value === s)?.label ?? s
const buildStatusLabel = (s: string) => BUILD_STATUSES.find((x) => x.value === s)?.label ?? s
const nowIso = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 10)

function serialize(table: string, data: Record<string, unknown>): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = {}
  const jsonCols = JSON_COLUMNS[table] ?? []
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue
    if (jsonCols.includes(k)) out[k] = JSON.stringify(v ?? (k === 'specs' ? {} : []))
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0
    else out[k] = v as SqlValue
  }
  return out
}

function deserialize<T>(table: string, row: Row | undefined): T | undefined {
  if (!row) return undefined
  const out: Record<string, unknown> = { ...row }
  for (const col of JSON_COLUMNS[table] ?? []) {
    try {
      out[col] = JSON.parse(String(out[col] ?? ''))
    } catch {
      out[col] = col === 'specs' ? {} : []
    }
  }
  for (const col of BOOL_COLUMNS[table] ?? []) out[col] = !!out[col]
  return out as T
}

export interface StoreOptions {
  dbFile: string
  uploadsDir: string
}

export class Store {
  db: DB
  uploadsDir: string

  constructor(opts: StoreOptions) {
    this.db = openDb(opts.dbFile)
    this.uploadsDir = opts.uploadsDir
  }

  // ─── Utilitaires génériques ────────────────────────────────────────────────

  private insert(table: string, data: Record<string, unknown>): number {
    const row = serialize(table, data)
    const keys = Object.keys(row)
    const sql = keys.length ? `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((k) => `:${k}`).join(', ')})` : `INSERT INTO ${table} DEFAULT VALUES`
    return Number(this.db.prepare(sql).run(row).lastInsertRowid)
  }

  private update(table: string, id: number, data: Record<string, unknown>) {
    const row = serialize(table, data)
    if (TIMESTAMPED.has(table)) row.updated_at = nowIso()
    const keys = Object.keys(row)
    if (!keys.length) return
    this.db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = :${k}`).join(', ')} WHERE id = :__id`).run({ ...row, __id: id })
  }

  private one<T>(table: string, id: number): T | undefined {
    return deserialize<T>(table, this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined)
  }

  private must<T>(table: string, id: number, label: string): T {
    const row = this.one<T>(table, id)
    if (!row) throw new HttpError(404, `${label} introuvable`)
    return row
  }

  private all<T>(table: string, sql: string, ...params: SqlValue[]): T[] {
    return (this.db.prepare(sql).all(...params) as Row[]).map((r) => deserialize<T>(table, r)!)
  }

  private columnsOf(table: string): string[] {
    return (this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
  }

  log(entity: AppEvent['entity'], entityId: number, type: string, message: string) {
    this.db.prepare('INSERT INTO events (entity, entity_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)').run(entity, entityId, type, message, nowIso())
  }

  private eventsFor(entity: AppEvent['entity'], id: number): AppEvent[] {
    return this.db.prepare('SELECT * FROM events WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT 200').all(entity, id) as unknown as AppEvent[]
  }

  recentEvents(limit = 30): AppEvent[] {
    return this.db
      .prepare(
        `SELECT e.*, CASE e.entity
            WHEN 'item' THEN (SELECT title FROM items WHERE id = e.entity_id)
            WHEN 'build' THEN (SELECT name FROM builds WHERE id = e.entity_id)
            WHEN 'lot' THEN (SELECT name FROM lots WHERE id = e.entity_id)
          END AS label
         FROM events e ORDER BY e.id DESC LIMIT ?`,
      )
      .all(limit) as unknown as AppEvent[]
  }

  private platformName(id: number | null | undefined): string | null {
    if (id == null) return null
    return (this.db.prepare('SELECT name FROM platforms WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? null
  }

  private removePhotos(photos: string[]) {
    for (const p of photos) {
      const file = path.join(this.uploadsDir, path.basename(p))
      fs.promises.unlink(file).catch(() => {})
    }
  }

  get settings(): Settings {
    return getSettings(this.db)
  }

  updateSettings(patch: Partial<Settings>): Settings {
    saveSettings(this.db, patch)
    return this.settings
  }

  // ─── Plateformes & catégories ─────────────────────────────────────────────

  listPlatforms(): Platform[] {
    return this.all<Platform>('platforms', 'SELECT * FROM platforms ORDER BY archived, sort_order, name')
  }

  createPlatform(input: Partial<Platform>): Platform {
    const exists = this.db.prepare('SELECT id FROM platforms WHERE name = ? COLLATE NOCASE').get(input.name ?? '')
    if (exists) throw new HttpError(409, 'Une plateforme porte déjà ce nom')
    const max = (this.db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM platforms').get() as { m: number }).m
    const id = this.insert('platforms', { sort_order: max + 1, ...input })
    return this.one<Platform>('platforms', id)!
  }

  updatePlatform(id: number, patch: Partial<Platform>): Platform {
    this.must<Platform>('platforms', id, 'Plateforme')
    if (patch.name) {
      const clash = this.db.prepare('SELECT id FROM platforms WHERE name = ? COLLATE NOCASE AND id <> ?').get(patch.name, id)
      if (clash) throw new HttpError(409, 'Une plateforme porte déjà ce nom')
    }
    this.update('platforms', id, patch)
    return this.one<Platform>('platforms', id)!
  }

  deletePlatform(id: number) {
    this.must<Platform>('platforms', id, 'Plateforme')
    const used = this.db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM items WHERE purchase_platform_id = :id OR sale_platform_id = :id)
              + (SELECT COUNT(*) FROM builds WHERE sale_platform_id = :id)
              + (SELECT COUNT(*) FROM lots WHERE platform_id = :id)
              + (SELECT COUNT(*) FROM expenses WHERE platform_id = :id) AS n`,
      )
      .get({ id }) as { n: number }
    if (used.n > 0) throw new HttpError(409, `Plateforme utilisée par ${used.n} enregistrement(s) : archivez-la plutôt que de la supprimer.`)
    this.db.prepare('DELETE FROM platforms WHERE id = ?').run(id)
  }

  listCategories(): Category[] {
    return this.all<Category>('categories', 'SELECT * FROM categories ORDER BY sort_order, name')
  }

  createCategory(input: Partial<Category>): Category {
    const exists = this.db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(input.name ?? '')
    if (exists) throw new HttpError(409, 'Une catégorie porte déjà ce nom')
    const max = (this.db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get() as { m: number }).m
    const id = this.insert('categories', { sort_order: max + 1, ...input })
    return this.one<Category>('categories', id)!
  }

  updateCategory(id: number, patch: Partial<Category>): Category {
    this.must<Category>('categories', id, 'Catégorie')
    if (patch.name) {
      const clash = this.db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id <> ?').get(patch.name, id)
      if (clash) throw new HttpError(409, 'Une catégorie porte déjà ce nom')
    }
    this.update('categories', id, patch)
    return this.one<Category>('categories', id)!
  }

  deleteCategory(id: number) {
    this.must<Category>('categories', id, 'Catégorie')
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  }

  private resolveByName(table: 'platforms' | 'categories', name: string | null | undefined): number | null {
    const clean = name?.trim()
    if (!clean) return null
    const row = this.db.prepare(`SELECT id FROM ${table} WHERE name = ? COLLATE NOCASE`).get(clean) as { id: number } | undefined
    if (row) return row.id
    return table === 'platforms' ? this.createPlatform({ name: clean }).id : this.createCategory({ name: clean }).id
  }

  // ─── Articles ─────────────────────────────────────────────────────────────

  listItems(): Item[] {
    return this.all<Item>('items', 'SELECT * FROM items ORDER BY id DESC')
  }

  getItem(id: number): Item {
    return this.must<Item>('items', id, 'Article')
  }

  getItemDetail(id: number): ItemDetail {
    return { ...this.getItem(id), events: this.eventsFor('item', id) }
  }

  private applyItemRules(current: Item | null, patch: Partial<Item>): Partial<Item> {
    const next: Partial<Item> = { ...patch }
    const merged = { ...(current ?? {}), ...patch } as Item
    const today = todayISO()

    if ('build_id' in patch) {
      if (patch.build_id != null) {
        this.must<Build>('builds', patch.build_id, 'PC')
        next.status = 'in_build'
      } else if (current?.build_id != null && merged.status === 'in_build') {
        next.status = 'in_stock'
      }
    } else if (patch.status && patch.status !== 'in_build' && current?.build_id != null) {
      next.build_id = null
    }
    const status = next.status ?? merged.status
    if (status === 'in_build' && (next.build_id ?? merged.build_id) == null) {
      throw new HttpError(400, 'Pour intégrer un article dans un PC, ajoutez-le depuis la fiche du PC.')
    }
    if (patch.lot_id != null) this.must<Lot>('lots', patch.lot_id, 'Lot')

    const statusChanged = current ? status !== current.status : true
    if (statusChanged) {
      if (status === 'sold' && !merged.sale_date) next.sale_date = today
      if (status === 'listed' && !merged.listed_date) next.listed_date = today
      if (current?.status === 'ordered' && status !== 'ordered' && !merged.received_date) next.received_date = today
    }
    if (patch.listed_price != null && !merged.listed_date && status === 'listed') next.listed_date = today
    return next
  }

  createItem(input: Partial<Item> & { title: string }, opts: { log?: boolean } = {}): Item {
    const data = this.applyItemRules(null, { status: 'in_stock', ...input })
    return transaction(this.db, () => {
      const id = this.insert('items', data)
      const prefix = this.settings.sku_prefix
      this.db.prepare('UPDATE items SET sku = ? WHERE id = ?').run(`${prefix}-${String(id).padStart(4, '0')}`, id)
      const item = this.getItem(id)
      if (opts.log !== false) {
        const where = this.platformName(item.purchase_platform_id)
        this.log('item', id, 'created', `Article ajouté${item.purchase_price ? ` — acheté ${fmt(item.purchase_price)}` : ''}${where ? ` sur ${where}` : ''}`)
        if (item.status === 'sold')
          this.log('item', id, 'sold', `Vendu ${fmt(item.sale_price)}${this.platformName(item.sale_platform_id) ? ` sur ${this.platformName(item.sale_platform_id)}` : ''}`)
      }
      if (item.build_id != null) {
        const build = this.getBuild(item.build_id)
        this.log('item', id, 'build', `Intégré au PC ${build.ref} « ${build.name} »`)
        this.log('build', build.id, 'component', `Pièce ajoutée : ${item.title}`)
      }
      if (item.lot_id != null) this.reallocateLot(item.lot_id)
      return this.getItem(id)
    })
  }

  updateItem(id: number, patch: Partial<Item>): Item {
    const current = this.getItem(id)
    const data = this.applyItemRules(current, patch)
    return transaction(this.db, () => {
      this.update('items', id, data)
      const next = this.getItem(id)
      this.logItemChanges(current, next)
      const lotsToRealloc = new Set<number>()
      if (current.lot_id !== next.lot_id) {
        if (current.lot_id != null) lotsToRealloc.add(current.lot_id)
        if (next.lot_id != null) lotsToRealloc.add(next.lot_id)
      } else if (next.lot_id != null && (current.target_price !== next.target_price || current.listed_price !== next.listed_price)) {
        lotsToRealloc.add(next.lot_id)
      }
      for (const lotId of lotsToRealloc) this.reallocateLot(lotId)
      return this.getItem(id)
    })
  }

  private logItemChanges(prev: Item, next: Item) {
    if (prev.build_id !== next.build_id) {
      if (prev.build_id != null) {
        const b = this.one<Build>('builds', prev.build_id)
        if (b) {
          this.log('item', next.id, 'build', `Retiré du PC ${b.ref} « ${b.name} »`)
          this.log('build', b.id, 'component', `Pièce retirée : ${next.title}`)
        }
      }
      if (next.build_id != null) {
        const b = this.one<Build>('builds', next.build_id)
        if (b) {
          this.log('item', next.id, 'build', `Intégré au PC ${b.ref} « ${b.name} »`)
          this.log('build', b.id, 'component', `Pièce ajoutée : ${next.title}`)
        }
      }
    }
    if (prev.status !== next.status && !(prev.build_id !== next.build_id && [prev.status, next.status].includes('in_build'))) {
      if (next.status === 'sold') {
        const where = this.platformName(next.sale_platform_id)
        this.log('item', next.id, 'sold', `Vendu ${fmt(next.sale_price)}${where ? ` sur ${where}` : ''}`)
      } else {
        this.log('item', next.id, 'status', `Statut : ${itemStatusLabel(prev.status)} → ${itemStatusLabel(next.status)}`)
      }
    }
    if (prev.listed_price !== next.listed_price && next.listed_price != null) {
      this.log(
        'item',
        next.id,
        'price',
        prev.listed_price != null ? `Prix affiché : ${fmt(prev.listed_price)} → ${fmt(next.listed_price)}` : `Mis en vente à ${fmt(next.listed_price)}`,
      )
    }
    if (prev.status === 'sold' && next.status === 'sold' && prev.sale_price !== next.sale_price) {
      this.log('item', next.id, 'price', `Prix de vente corrigé : ${fmt(prev.sale_price)} → ${fmt(next.sale_price)}`)
    }
    if (!prev.shipped_date && next.shipped_date) {
      this.log('item', next.id, 'shipped', `Expédié${next.tracking_number ? ` (suivi ${next.tracking_number})` : ''}`)
    }
  }

  deleteItem(id: number) {
    const item = this.getItem(id)
    transaction(this.db, () => {
      this.db.prepare('DELETE FROM items WHERE id = ?').run(id)
      this.db.prepare("DELETE FROM events WHERE entity = 'item' AND entity_id = ?").run(id)
      if (item.build_id != null) this.log('build', item.build_id, 'component', `Pièce supprimée : ${item.title}`)
      if (item.lot_id != null) this.reallocateLot(item.lot_id)
    })
    this.removePhotos(item.photos)
  }

  duplicateItem(id: number): Item {
    const src = this.getItem(id)
    const copy: Partial<Item> & { title: string } = {
      title: src.title,
      category_id: src.category_id,
      brand: src.brand,
      model: src.model,
      condition: src.condition,
      status: src.status === 'in_build' || src.status === 'sold' ? 'in_stock' : src.status,
      purchase_platform_id: src.purchase_platform_id,
      purchase_date: src.purchase_date,
      purchase_price: src.purchase_price,
      purchase_shipping: src.purchase_shipping,
      purchase_fees: src.purchase_fees,
      extra_costs: src.extra_costs,
      seller: src.seller,
      target_price: src.target_price,
      location: src.location,
      tags: src.tags,
      specs: src.specs,
      notes: src.notes,
    }
    return this.createItem(copy)
  }

  bulkItems(ids: number[], action: string, value: string | number | null | undefined): number {
    let count = 0
    transaction(this.db, () => {
      for (const id of ids) {
        const item = this.one<Item>('items', id)
        if (!item) continue
        switch (action) {
          case 'delete':
            this.db.prepare('DELETE FROM items WHERE id = ?').run(id)
            this.db.prepare("DELETE FROM events WHERE entity = 'item' AND entity_id = ?").run(id)
            if (item.lot_id != null) this.reallocateLot(item.lot_id)
            this.removePhotos(item.photos)
            break
          case 'status': {
            const status = String(value) as Item['status']
            if (!ITEM_STATUSES.some((s) => s.value === status) || status === 'in_build') throw new HttpError(400, 'Statut invalide')
            const data = this.applyItemRules(item, { status })
            this.update('items', id, data)
            this.logItemChanges(item, this.getItem(id))
            break
          }
          case 'location':
            this.update('items', id, { location: value ? String(value).trim() : null })
            break
          case 'category':
            this.update('items', id, { category_id: value == null || value === '' ? null : Number(value) })
            break
          case 'add_tag': {
            const tag = String(value ?? '').trim()
            if (tag && !item.tags.includes(tag)) this.update('items', id, { tags: [...item.tags, tag] })
            break
          }
        }
        count++
      }
    })
    return count
  }

  importItems(rows: (Partial<Item> & { title: string; purchase_platform_name?: string; sale_platform_name?: string; category_name?: string })[]): number {
    return transaction(this.db, () => {
      let n = 0
      for (const row of rows) {
        const { purchase_platform_name, sale_platform_name, category_name, ...rest } = row
        const data: Partial<Item> & { title: string } = { ...rest }
        if (purchase_platform_name && data.purchase_platform_id == null) data.purchase_platform_id = this.resolveByName('platforms', purchase_platform_name)
        if (sale_platform_name && data.sale_platform_id == null) data.sale_platform_id = this.resolveByName('platforms', sale_platform_name)
        if (category_name && data.category_id == null) data.category_id = this.resolveByName('categories', category_name)
        if (data.status === 'in_build') data.status = 'in_stock'
        delete data.build_id
        delete data.lot_id
        const created = this.createItem(data, { log: false })
        this.log('item', created.id, 'created', 'Article importé (CSV)')
        n++
      }
      return n
    })
  }

  // ─── PC montés ────────────────────────────────────────────────────────────

  listBuilds(): Build[] {
    return this.all<Build>('builds', 'SELECT * FROM builds ORDER BY id DESC')
  }

  getBuild(id: number): Build {
    return this.must<Build>('builds', id, 'PC')
  }

  getBuildDetail(id: number): BuildDetail {
    const build = this.getBuild(id)
    return {
      ...build,
      components: this.all<Item>('items', 'SELECT * FROM items WHERE build_id = ? ORDER BY id', id),
      events: this.eventsFor('build', id),
    }
  }

  createBuild(input: Partial<Build> & { name: string }): Build {
    const settings = this.settings
    const data: Partial<Build> = {
      status: 'planning',
      warranty_months: settings.default_warranty_months,
      checklist: DEFAULT_CHECKLIST.map((label) => ({ id: uid(), label, done: false })),
      ...input,
    }
    if (data.status === 'sold' && !data.sale_date) data.sale_date = todayISO()
    if (data.status === 'listed' && !data.listed_date) data.listed_date = todayISO()
    return transaction(this.db, () => {
      const id = this.insert('builds', data)
      this.db.prepare('UPDATE builds SET ref = ? WHERE id = ?').run(`${settings.build_prefix}-${String(id).padStart(3, '0')}`, id)
      this.log('build', id, 'created', 'Fiche PC créée')
      return this.getBuild(id)
    })
  }

  updateBuild(id: number, patch: Partial<Build>): Build {
    const prev = this.getBuild(id)
    const data: Partial<Build> = { ...patch }
    const merged = { ...prev, ...patch }
    if (patch.status && patch.status !== prev.status) {
      if (patch.status === 'sold' && !merged.sale_date) data.sale_date = todayISO()
      if (patch.status === 'listed' && !merged.listed_date) data.listed_date = todayISO()
    }
    return transaction(this.db, () => {
      this.update('builds', id, data)
      const next = this.getBuild(id)
      if (prev.status !== next.status) {
        if (next.status === 'sold') {
          const where = this.platformName(next.sale_platform_id)
          this.log('build', id, 'sold', `PC vendu ${fmt(next.sale_price)}${where ? ` sur ${where}` : ''}`)
        } else {
          this.log('build', id, 'status', `Statut : ${buildStatusLabel(prev.status)} → ${buildStatusLabel(next.status)}`)
        }
      }
      if (prev.listed_price !== next.listed_price && next.listed_price != null) {
        this.log(
          'build',
          id,
          'price',
          prev.listed_price != null ? `Prix affiché : ${fmt(prev.listed_price)} → ${fmt(next.listed_price)}` : `Mis en vente à ${fmt(next.listed_price)}`,
        )
      }
      return next
    })
  }

  deleteBuild(id: number) {
    const build = this.getBuild(id)
    transaction(this.db, () => {
      const comps = this.all<Item>('items', 'SELECT * FROM items WHERE build_id = ?', id)
      for (const c of comps) {
        this.update('items', c.id, { build_id: null, status: 'in_stock' })
        this.log('item', c.id, 'build', `PC ${build.ref} supprimé — pièce remise en stock`)
      }
      this.db.prepare('DELETE FROM builds WHERE id = ?').run(id)
      this.db.prepare("DELETE FROM events WHERE entity = 'build' AND entity_id = ?").run(id)
    })
    this.removePhotos(build.photos)
  }

  attachComponent(buildId: number, itemId: number): BuildDetail {
    this.getBuild(buildId)
    const item = this.getItem(itemId)
    if (item.build_id === buildId) return this.getBuildDetail(buildId)
    if (item.status === 'sold') throw new HttpError(400, 'Cet article est déjà vendu.')
    this.updateItem(itemId, { build_id: buildId })
    return this.getBuildDetail(buildId)
  }

  detachComponent(buildId: number, itemId: number): BuildDetail {
    const item = this.getItem(itemId)
    if (item.build_id !== buildId) throw new HttpError(400, 'Cette pièce ne fait pas partie de ce PC.')
    this.updateItem(itemId, { build_id: null })
    return this.getBuildDetail(buildId)
  }

  /** Démonte un PC : toutes les pièces retournent en stock, individuellement revendables. */
  dismantleBuild(id: number): BuildDetail {
    const build = this.getBuild(id)
    transaction(this.db, () => {
      const comps = this.all<Item>('items', 'SELECT * FROM items WHERE build_id = ?', id)
      for (const c of comps) {
        this.update('items', c.id, { build_id: null, status: 'in_stock' })
        this.log('item', c.id, 'build', `PC ${build.ref} démonté — pièce remise en stock`)
      }
      this.update('builds', id, { status: 'dismantled' })
      this.log('build', id, 'status', `PC démonté : ${comps.length} pièce(s) remise(s) en stock`)
    })
    return this.getBuildDetail(id)
  }

  // ─── Lots / achats groupés ────────────────────────────────────────────────

  listLots(): Lot[] {
    return this.all<Lot>('lots', 'SELECT * FROM lots ORDER BY id DESC')
  }

  getLot(id: number): Lot {
    return this.must<Lot>('lots', id, 'Lot')
  }

  getLotDetail(id: number): LotDetail {
    const lot = this.getLot(id)
    return {
      ...lot,
      items: this.all<Item>('items', 'SELECT * FROM items WHERE lot_id = ? ORDER BY id', id),
      events: this.eventsFor('lot', id),
    }
  }

  createLot(input: Partial<Lot> & { name: string; items?: (Partial<Item> & { title: string })[] }): LotDetail {
    const { items = [], ...lotData } = input
    return transaction(this.db, () => {
      const id = this.insert('lots', { allocation: 'value', ...lotData })
      const lot = this.getLot(id)
      const where = this.platformName(lot.platform_id)
      this.log('lot', id, 'created', `Lot acheté ${fmt(lot.price + lot.shipping + lot.fees)}${where ? ` sur ${where}` : ''} — ${items.length} article(s)`)
      for (const it of items) {
        this.createItem(
          {
            ...it,
            lot_id: id,
            purchase_platform_id: lot.platform_id,
            purchase_date: lot.purchase_date,
            seller: lot.seller,
            purchase_url: lot.url,
          },
          { log: false },
        )
      }
      for (const it of this.all<Item>('items', 'SELECT * FROM items WHERE lot_id = ?', id)) {
        this.log('item', it.id, 'created', `Article issu du lot « ${lot.name} »`)
      }
      this.reallocateLot(id)
      return this.getLotDetail(id)
    })
  }

  updateLot(id: number, patch: Partial<Lot>): LotDetail {
    const prev = this.getLot(id)
    return transaction(this.db, () => {
      this.update('lots', id, patch)
      const next = this.getLot(id)
      const propagate: Partial<Item> = {}
      if (prev.platform_id !== next.platform_id) propagate.purchase_platform_id = next.platform_id
      if (prev.purchase_date !== next.purchase_date) propagate.purchase_date = next.purchase_date
      if (Object.keys(propagate).length) {
        for (const it of this.all<Item>('items', 'SELECT * FROM items WHERE lot_id = ?', id)) this.update('items', it.id, propagate)
      }
      const totalChanged = prev.price + prev.shipping + prev.fees !== next.price + next.shipping + next.fees
      if (totalChanged) this.log('lot', id, 'price', `Coût total : ${fmt(prev.price + prev.shipping + prev.fees)} → ${fmt(next.price + next.shipping + next.fees)}`)
      if (totalChanged || prev.allocation !== next.allocation) this.reallocateLot(id)
      return this.getLotDetail(id)
    })
  }

  deleteLot(id: number, withItems: boolean) {
    this.getLot(id)
    transaction(this.db, () => {
      const items = this.all<Item>('items', 'SELECT * FROM items WHERE lot_id = ?', id)
      if (withItems) {
        for (const it of items) {
          this.db.prepare('DELETE FROM items WHERE id = ?').run(it.id)
          this.db.prepare("DELETE FROM events WHERE entity = 'item' AND entity_id = ?").run(it.id)
          this.removePhotos(it.photos)
        }
      }
      this.db.prepare('DELETE FROM lots WHERE id = ?').run(id)
      this.db.prepare("DELETE FROM events WHERE entity = 'lot' AND entity_id = ?").run(id)
    })
  }

  /** Répartit le coût du lot sur ses articles (prix d'achat unitaire). */
  reallocateLot(id: number, force = false) {
    const lot = this.one<Lot>('lots', id)
    if (!lot) return
    if (lot.allocation === 'manual' && !force) return
    const items = this.all<Item>('items', 'SELECT * FROM items WHERE lot_id = ? ORDER BY id', id)
    const total = round2(lot.price + lot.shipping + lot.fees)
    const alloc = allocateLotCost(
      total,
      lot.allocation,
      items.map((i) => ({ id: i.id, weight: i.target_price ?? i.listed_price ?? i.sale_price, manual: i.purchase_price + i.purchase_shipping + i.purchase_fees })),
    )
    const stmt = this.db.prepare('UPDATE items SET purchase_price = ?, purchase_shipping = 0, purchase_fees = 0, updated_at = ? WHERE id = ?')
    for (const [itemId, amount] of alloc) stmt.run(amount, nowIso(), itemId)
  }

  // ─── Dépenses ─────────────────────────────────────────────────────────────

  listExpenses(): Expense[] {
    return this.all<Expense>('expenses', 'SELECT * FROM expenses ORDER BY date DESC, id DESC')
  }

  createExpense(input: Partial<Expense>): Expense {
    const id = this.insert('expenses', { category: 'autre', ...input })
    return this.one<Expense>('expenses', id)!
  }

  updateExpense(id: number, patch: Partial<Expense>): Expense {
    this.must<Expense>('expenses', id, 'Dépense')
    this.update('expenses', id, patch)
    return this.one<Expense>('expenses', id)!
  }

  deleteExpense(id: number) {
    this.must<Expense>('expenses', id, 'Dépense')
    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  }

  // ─── Sauvegarde ───────────────────────────────────────────────────────────

  backup(): Backup {
    return {
      version: 1,
      exported_at: nowIso(),
      platforms: this.all<Platform>('platforms', 'SELECT * FROM platforms ORDER BY id'),
      categories: this.all<Category>('categories', 'SELECT * FROM categories ORDER BY id'),
      items: this.all<Item>('items', 'SELECT * FROM items ORDER BY id'),
      builds: this.all<Build>('builds', 'SELECT * FROM builds ORDER BY id'),
      lots: this.all<Lot>('lots', 'SELECT * FROM lots ORDER BY id'),
      expenses: this.all<Expense>('expenses', 'SELECT * FROM expenses ORDER BY id'),
      events: this.db.prepare('SELECT * FROM events ORDER BY id').all() as unknown as AppEvent[],
      settings: this.settings,
    }
  }

  restore(data: Backup) {
    if (!data || typeof data !== 'object' || data.version !== 1) throw new HttpError(400, 'Fichier de sauvegarde invalide ou incompatible.')
    const tables = ['platforms', 'categories', 'lots', 'builds', 'items', 'expenses', 'events'] as const
    for (const t of tables) {
      if (!Array.isArray(data[t])) throw new HttpError(400, `Sauvegarde incomplète : « ${t} » manquant.`)
    }
    transaction(this.db, () => {
      this.db.exec('PRAGMA defer_foreign_keys = ON')
      for (const t of [...tables].reverse()) this.db.exec(`DELETE FROM ${t}`)
      this.db.exec("DELETE FROM settings WHERE key NOT LIKE '\\_%' ESCAPE '\\'")
      this.db.exec("DELETE FROM sqlite_sequence WHERE name IN ('platforms','categories','lots','builds','items','expenses','events')")
      for (const t of tables) {
        const cols = new Set(this.columnsOf(t))
        for (const row of data[t] as unknown as Record<string, unknown>[]) {
          const clean: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) if (cols.has(k)) clean[k] = v
          this.insert(t, clean)
        }
      }
      if (data.settings) saveSettings(this.db, data.settings)
    })
  }

  counts() {
    return this.db.prepare('SELECT (SELECT COUNT(*) FROM items) AS items, (SELECT COUNT(*) FROM builds) AS builds, (SELECT COUNT(*) FROM lots) AS lots').get() as {
      items: number
      builds: number
      lots: number
    }
  }
}
