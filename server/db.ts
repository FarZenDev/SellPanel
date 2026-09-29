import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_SETTINGS } from '../shared/constants.ts'
import type { Settings } from '../shared/types.ts'

// Le module SQLite natif de Node émet un avertissement « expérimental » à chaque démarrage : on le masque.
const originalEmit = process.emitWarning.bind(process)
process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const msg = typeof warning === 'string' ? warning : warning.message
  if (/SQLite/i.test(msg)) return
  return (originalEmit as (...a: unknown[]) => void)(warning, ...args)
}) as typeof process.emitWarning

const { DatabaseSync } = await import('node:sqlite')

export type DB = InstanceType<typeof DatabaseSync>
export type Row = Record<string, unknown>
export type SqlValue = string | number | bigint | null | Uint8Array

const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  url TEXT,
  search_url TEXT,
  sale_fee_percent REAL NOT NULL DEFAULT 0,
  sale_fee_fixed REAL NOT NULL DEFAULT 0,
  buyer_fee_percent REAL NOT NULL DEFAULT 0,
  buyer_fee_fixed REAL NOT NULL DEFAULT 0,
  dac7 INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slot TEXT,
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  purchase_date TEXT,
  price REAL NOT NULL DEFAULT 0,
  shipping REAL NOT NULL DEFAULT 0,
  fees REAL NOT NULL DEFAULT 0,
  seller TEXT,
  url TEXT,
  notes TEXT,
  allocation TEXT NOT NULL DEFAULT 'value',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  usage TEXT,
  description TEXT,
  target_price REAL,
  listed_price REAL,
  listed_date TEXT,
  sale_platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  sale_price REAL,
  sale_date TEXT,
  sale_fees REAL NOT NULL DEFAULT 0,
  sale_shipping REAL NOT NULL DEFAULT 0,
  extra_costs REAL NOT NULL DEFAULT 0,
  labor_hours REAL NOT NULL DEFAULT 0,
  buyer TEXT,
  warranty_months INTEGER NOT NULL DEFAULT 0,
  benchmarks TEXT NOT NULL DEFAULT '[]',
  checklist TEXT NOT NULL DEFAULT '[]',
  photos TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  title TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT,
  model TEXT,
  condition TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock',
  purchase_platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  purchase_date TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  purchase_shipping REAL NOT NULL DEFAULT 0,
  purchase_fees REAL NOT NULL DEFAULT 0,
  extra_costs REAL NOT NULL DEFAULT 0,
  seller TEXT,
  purchase_url TEXT,
  order_ref TEXT,
  received_date TEXT,
  lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
  build_id INTEGER REFERENCES builds(id) ON DELETE SET NULL,
  target_price REAL,
  listed_price REAL,
  listed_date TEXT,
  sale_platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  sale_price REAL,
  sale_date TEXT,
  sale_fees REAL NOT NULL DEFAULT 0,
  sale_shipping REAL NOT NULL DEFAULT 0,
  buyer TEXT,
  sale_url TEXT,
  tracking_number TEXT,
  shipped_date TEXT,
  location TEXT,
  serial_number TEXT,
  warranty_until TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  specs TEXT NOT NULL DEFAULT '{}',
  photos TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_build ON items(build_id);
CREATE INDEX IF NOT EXISTS idx_items_lot ON items(lot_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
  amount REAL NOT NULL DEFAULT 0,
  platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity, entity_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

interface PlatformSeed {
  name: string
  color: string
  url: string
  search_url: string | null
  sale_fee_percent: number
  sale_fee_fixed: number
  buyer_fee_percent: number
  buyer_fee_fixed: number
  dac7: number
}

// Grilles 2026 pour un vendeur particulier : Vinted et Leboncoin facturent la protection à l'acheteur,
// eBay.fr est gratuit pour les particuliers depuis le 1er septembre 2026. Tout est modifiable dans Paramètres.
export const PLATFORM_SEEDS: PlatformSeed[] = [
  {
    name: 'Vinted',
    color: '#09b1ba',
    url: 'https://www.vinted.fr',
    search_url: 'https://www.vinted.fr/catalog?search_text={q}',
    sale_fee_percent: 0,
    sale_fee_fixed: 0,
    buyer_fee_percent: 5,
    buyer_fee_fixed: 0.7,
    dac7: 1,
  },
  {
    name: 'Leboncoin',
    color: '#ec5a13',
    url: 'https://www.leboncoin.fr',
    search_url: 'https://www.leboncoin.fr/recherche?text={q}',
    sale_fee_percent: 0,
    sale_fee_fixed: 0,
    buyer_fee_percent: 5,
    buyer_fee_fixed: 0.7,
    dac7: 1,
  },
  {
    name: 'eBay',
    color: '#0064d2',
    url: 'https://www.ebay.fr',
    search_url: 'https://www.ebay.fr/sch/i.html?_nkw={q}&LH_Sold=1&LH_Complete=1',
    sale_fee_percent: 0,
    sale_fee_fixed: 0,
    buyer_fee_percent: 0,
    buyer_fee_fixed: 0,
    dac7: 1,
  },
  {
    name: 'Facebook Marketplace',
    color: '#1877f2',
    url: 'https://www.facebook.com/marketplace',
    search_url: 'https://www.facebook.com/marketplace/search?query={q}',
    sale_fee_percent: 0,
    sale_fee_fixed: 0,
    buyer_fee_percent: 0,
    buyer_fee_fixed: 0,
    dac7: 1,
  },
  {
    name: 'Amazon',
    color: '#ff9900',
    url: 'https://www.amazon.fr',
    search_url: 'https://www.amazon.fr/s?k={q}',
    sale_fee_percent: 0,
    sale_fee_fixed: 0,
    buyer_fee_percent: 0,
    buyer_fee_fixed: 0,
    dac7: 0,
  },
  { name: 'Main propre', color: '#64748b', url: '', search_url: null, sale_fee_percent: 0, sale_fee_fixed: 0, buyer_fee_percent: 0, buyer_fee_fixed: 0, dac7: 0 },
]

export const CATEGORY_SEEDS: { name: string; slot: string | null; color: string }[] = [
  { name: 'Processeur', slot: 'cpu', color: '#3b82f6' },
  { name: 'Carte graphique', slot: 'gpu', color: '#22c55e' },
  { name: 'Mémoire RAM', slot: 'ram', color: '#a855f7' },
  { name: 'Carte mère', slot: 'motherboard', color: '#0ea5e9' },
  { name: 'Stockage', slot: 'storage', color: '#f59e0b' },
  { name: 'Alimentation', slot: 'psu', color: '#ef4444' },
  { name: 'Boîtier', slot: 'case', color: '#64748b' },
  { name: 'Refroidissement', slot: 'cooler', color: '#06b6d4' },
  { name: 'Ventilateurs', slot: 'fans', color: '#14b8a6' },
  { name: 'Licence / OS', slot: 'os', color: '#8b5cf6' },
  { name: 'PC complet', slot: null, color: '#6366f1' },
  { name: 'PC portable', slot: null, color: '#ec4899' },
  { name: 'Écran', slot: null, color: '#f97316' },
  { name: 'Périphérique', slot: null, color: '#84cc16' },
  { name: 'Console', slot: null, color: '#e11d48' },
  { name: 'Autre', slot: null, color: '#94a3b8' },
]

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON;')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  seed(db)
  return db
}

function seed(db: DB) {
  const hasPlatforms = (db.prepare('SELECT COUNT(*) AS n FROM platforms').get() as { n: number }).n > 0
  if (!hasPlatforms) {
    const stmt = db.prepare(
      `INSERT INTO platforms (name, color, url, search_url, sale_fee_percent, sale_fee_fixed, buyer_fee_percent, buyer_fee_fixed, dac7, sort_order)
       VALUES (:name, :color, :url, :search_url, :sale_fee_percent, :sale_fee_fixed, :buyer_fee_percent, :buyer_fee_fixed, :dac7, :sort_order)`,
    )
    PLATFORM_SEEDS.forEach((p, i) => stmt.run({ ...p, sort_order: i }))
  }
  const hasCategories = (db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n > 0
  if (!hasCategories) {
    const stmt = db.prepare('INSERT INTO categories (name, slot, color, sort_order) VALUES (:name, :slot, :color, :sort_order)')
    CATEGORY_SEEDS.forEach((c, i) => stmt.run({ ...c, sort_order: i }))
  }
}

const txDepth = new WeakMap<DB, number>()

/** Transaction imbriquable (les niveaux internes utilisent des SAVEPOINT). */
export function transaction<T>(db: DB, fn: () => T): T {
  const depth = txDepth.get(db) ?? 0
  const sp = `sp_${depth}`
  db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`)
  txDepth.set(db, depth + 1)
  try {
    const result = fn()
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`)
    return result
  } catch (err) {
    db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`)
    throw err
  } finally {
    txDepth.set(db, depth)
  }
}

export function getSettings(db: DB): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const { key, value } of rows) {
    if (key.startsWith('_') || !(key in DEFAULT_SETTINGS)) continue
    try {
      out[key] = JSON.parse(value)
    } catch {
      out[key] = value
    }
  }
  return out as unknown as Settings
}

export function saveSettings(db: DB, patch: Partial<Settings>) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue
    stmt.run(key, JSON.stringify(value))
  }
}

export function getSecret(db: DB, key: string, create: () => string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (row) return row.value
  const value = create()
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value)
  return value
}
