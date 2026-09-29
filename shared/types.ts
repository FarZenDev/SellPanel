// Types partagés entre le serveur (API) et le client (panel web).

export type ItemStatus = 'ordered' | 'in_stock' | 'testing' | 'listed' | 'reserved' | 'in_build' | 'sold' | 'returned' | 'kept' | 'broken'

export type BuildStatus = 'planning' | 'building' | 'testing' | 'listed' | 'reserved' | 'sold' | 'kept' | 'dismantled'

export type PcSlot = 'cpu' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case' | 'cooler' | 'fans' | 'os' | 'other'

export type Condition = 'neuf' | 'neuf_ouvert' | 'tres_bon' | 'bon' | 'correct' | 'pieces'

export type SpecValue = string | number | boolean
export type Specs = Record<string, SpecValue>

export interface Platform {
  id: number
  name: string
  color: string
  url: string | null
  search_url: string | null
  sale_fee_percent: number
  sale_fee_fixed: number
  buyer_fee_percent: number
  buyer_fee_fixed: number
  dac7: boolean
  archived: boolean
  sort_order: number
}

export interface Category {
  id: number
  name: string
  slot: PcSlot | null
  color: string
  sort_order: number
}

export interface Item {
  id: number
  sku: string
  title: string
  category_id: number | null
  brand: string | null
  model: string | null
  condition: Condition | null
  status: ItemStatus

  purchase_platform_id: number | null
  purchase_date: string | null
  purchase_price: number
  purchase_shipping: number
  purchase_fees: number
  extra_costs: number
  seller: string | null
  purchase_url: string | null
  order_ref: string | null
  received_date: string | null
  lot_id: number | null
  build_id: number | null

  target_price: number | null
  listed_price: number | null
  listed_date: string | null
  sale_platform_id: number | null
  sale_price: number | null
  sale_date: string | null
  sale_fees: number
  sale_shipping: number
  buyer: string | null
  sale_url: string | null
  tracking_number: string | null
  shipped_date: string | null

  location: string | null
  serial_number: string | null
  warranty_until: string | null
  tags: string[]
  specs: Specs
  photos: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Benchmark {
  id: string
  label: string
  value: string
  unit: string
}

export interface ChecklistEntry {
  id: string
  label: string
  done: boolean
}

export interface Build {
  id: number
  ref: string
  name: string
  status: BuildStatus
  usage: string | null
  description: string | null
  target_price: number | null
  listed_price: number | null
  listed_date: string | null
  sale_platform_id: number | null
  sale_price: number | null
  sale_date: string | null
  sale_fees: number
  sale_shipping: number
  extra_costs: number
  labor_hours: number
  buyer: string | null
  warranty_months: number
  benchmarks: Benchmark[]
  checklist: ChecklistEntry[]
  photos: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type AllocationMethod = 'value' | 'equal' | 'manual'

export interface Lot {
  id: number
  name: string
  platform_id: number | null
  purchase_date: string | null
  price: number
  shipping: number
  fees: number
  seller: string | null
  url: string | null
  notes: string | null
  allocation: AllocationMethod
  created_at: string
  updated_at: string
}

export type ExpenseCategory = 'emballage' | 'transport' | 'outillage' | 'abonnement' | 'boost' | 'banque' | 'autre'

export interface Expense {
  id: number
  date: string
  category: ExpenseCategory
  amount: number
  platform_id: number | null
  description: string | null
  created_at: string
}

export interface AppEvent {
  id: number
  entity: 'item' | 'build' | 'lot'
  entity_id: number
  type: string
  message: string
  created_at: string
  /** Libellé de l'entité (titre de l'article, nom du PC…), renseigné sur le fil d'activité. */
  label?: string | null
}

export interface Settings {
  shop_name: string
  sku_prefix: string
  build_prefix: string
  monthly_goal: number
  hourly_rate: number
  stale_days: number
  micro_enabled: boolean
  micro_rate: number
  dac7_sales: number
  dac7_amount: number
  default_warranty_months: number
}

export interface Meta {
  platforms: Platform[]
  categories: Category[]
  settings: Settings
  auth: boolean
}

export interface ItemDetail extends Item {
  events: AppEvent[]
}

export interface BuildDetail extends Build {
  components: Item[]
  events: AppEvent[]
}

export interface LotDetail extends Lot {
  items: Item[]
  events: AppEvent[]
}

export interface Backup {
  version: number
  exported_at: string
  platforms: Platform[]
  categories: Category[]
  items: Item[]
  builds: Build[]
  lots: Lot[]
  expenses: Expense[]
  events: AppEvent[]
  settings: Settings
}
