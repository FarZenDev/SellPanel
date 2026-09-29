import { z } from 'zod'
import { BUILD_STATUSES, CONDITIONS, EXPENSE_CATEGORIES, ITEM_STATUSES, PC_SLOTS } from '../shared/constants.ts'

const values = <T extends string>(defs: { value: T }[]) => defs.map((d) => d.value) as [T, ...T[]]

/** Chaîne libre : vide → null. */
const text = (max = 5000) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((s) => (s == null || s.trim() === '' ? null : s.trim()))

const date = z
  .string()
  .nullable()
  .transform((s) => (s == null || s.trim() === '' ? null : s.trim()))
  .refine((s) => s == null || /^\d{4}-\d{2}-\d{2}$/.test(s), 'Date invalide (AAAA-MM-JJ)')

const money = z.number().finite().min(-1_000_000).max(10_000_000)
const optionalMoney = money.nullable()
const fk = z.number().int().positive().nullable()
const specs = z.record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean()]))
const photos = z.array(z.string().regex(/^[\w.-]+$/)).max(40)

export const itemSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300),
  category_id: fk,
  brand: text(120),
  model: text(200),
  condition: z.enum(values(CONDITIONS)).nullable(),
  status: z.enum(values(ITEM_STATUSES)),
  purchase_platform_id: fk,
  purchase_date: date,
  purchase_price: money,
  purchase_shipping: money,
  purchase_fees: money,
  extra_costs: money,
  seller: text(200),
  purchase_url: text(2000),
  order_ref: text(200),
  received_date: date,
  lot_id: fk,
  build_id: fk,
  target_price: optionalMoney,
  listed_price: optionalMoney,
  listed_date: date,
  sale_platform_id: fk,
  sale_price: optionalMoney,
  sale_date: date,
  sale_fees: money,
  sale_shipping: money,
  buyer: text(200),
  sale_url: text(2000),
  tracking_number: text(200),
  shipped_date: date,
  location: text(200),
  serial_number: text(200),
  warranty_until: date,
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  specs,
  photos,
  notes: text(20000),
})

export const itemCreateSchema = itemSchema.partial().required({ title: true })
export const itemPatchSchema = itemSchema.partial()

const benchmark = z.object({ id: z.string().max(40), label: z.string().max(200), value: z.string().max(100), unit: z.string().max(20) })
const checklistEntry = z.object({ id: z.string().max(40), label: z.string().max(300), done: z.boolean() })

export const buildSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(200),
  status: z.enum(values(BUILD_STATUSES)),
  usage: text(200),
  description: text(20000),
  target_price: optionalMoney,
  listed_price: optionalMoney,
  listed_date: date,
  sale_platform_id: fk,
  sale_price: optionalMoney,
  sale_date: date,
  sale_fees: money,
  sale_shipping: money,
  extra_costs: money,
  labor_hours: z.number().min(0).max(10000),
  buyer: text(200),
  warranty_months: z.number().int().min(0).max(120),
  benchmarks: z.array(benchmark).max(50),
  checklist: z.array(checklistEntry).max(100),
  photos,
  notes: text(20000),
})
export const buildCreateSchema = buildSchema.partial().required({ name: true })
export const buildPatchSchema = buildSchema.partial()

export const lotSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(200),
  platform_id: fk,
  purchase_date: date,
  price: money,
  shipping: money,
  fees: money,
  seller: text(200),
  url: text(2000),
  notes: text(20000),
  allocation: z.enum(['value', 'equal', 'manual']),
})
export const lotCreateSchema = lotSchema
  .partial()
  .required({ name: true })
  .extend({
    items: z.array(itemCreateSchema).max(200).optional(),
  })
export const lotPatchSchema = lotSchema.partial()

export const expenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  category: z.enum(values(EXPENSE_CATEGORIES)),
  amount: money,
  platform_id: fk,
  description: text(1000),
})
export const expenseCreateSchema = expenseSchema.partial().required({ date: true, amount: true })
export const expensePatchSchema = expenseSchema.partial()

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide')

export const platformSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(80),
  color: hexColor,
  url: text(500),
  search_url: text(1000),
  sale_fee_percent: z.number().min(0).max(100),
  sale_fee_fixed: z.number().min(0).max(1000),
  buyer_fee_percent: z.number().min(0).max(100),
  buyer_fee_fixed: z.number().min(0).max(1000),
  dac7: z.boolean(),
  archived: z.boolean(),
  sort_order: z.number().int(),
})
export const platformCreateSchema = platformSchema.partial().required({ name: true })
export const platformPatchSchema = platformSchema.partial()

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(80),
  slot: z.enum(values(PC_SLOTS)).nullable(),
  color: hexColor,
  sort_order: z.number().int(),
})
export const categoryCreateSchema = categorySchema.partial().required({ name: true })
export const categoryPatchSchema = categorySchema.partial()

export const settingsSchema = z
  .object({
    shop_name: z.string().trim().min(1).max(80),
    sku_prefix: z
      .string()
      .trim()
      .min(1)
      .max(8)
      .regex(/^[A-Za-z0-9]+$/, 'Lettres et chiffres uniquement'),
    build_prefix: z
      .string()
      .trim()
      .min(1)
      .max(8)
      .regex(/^[A-Za-z0-9]+$/, 'Lettres et chiffres uniquement'),
    monthly_goal: z.number().min(0).max(10_000_000),
    hourly_rate: z.number().min(0).max(10_000),
    stale_days: z.number().int().min(1).max(3650),
    micro_enabled: z.boolean(),
    micro_rate: z.number().min(0).max(100),
    dac7_sales: z.number().int().min(0).max(100_000),
    dac7_amount: z.number().min(0).max(10_000_000),
    default_warranty_months: z.number().int().min(0).max(120),
  })
  .partial()

export const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(5000),
  action: z.enum(['status', 'delete', 'location', 'add_tag', 'category']),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
})
