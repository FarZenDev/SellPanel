import { CONDITIONS, PC_SLOTS } from './constants.ts'
import { slotOf } from './compat.ts'
import type { Build, Category, Item, PcSlot, Specs } from './types.ts'

export function formatCapacity(go: number): string {
  if (go >= 1000) {
    const to = go / 1000
    return `${Number.isInteger(to) ? to : to.toFixed(1).replace('.', ',')} To`
  }
  return `${go} Go`
}

const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN)

/** Résumé court des caractéristiques d'une pièce, pour les annonces. */
export function specSummary(slot: PcSlot, specs: Specs): string {
  const parts: string[] = []
  const add = (v: unknown) => {
    if (v != null && v !== '' && v !== false) parts.push(String(v))
  }
  switch (slot) {
    case 'cpu':
      add(specs.cores)
      break
    case 'motherboard':
      add(specs.chipset)
      add(specs.form_factor)
      if (specs.wifi === true) add('Wi-Fi')
      break
    case 'ram':
      if (Number.isFinite(n(specs.capacity))) add(formatCapacity(n(specs.capacity)))
      add(specs.ram_type)
      if (Number.isFinite(n(specs.speed))) add(`${n(specs.speed)} MHz`)
      if (specs.kit) add(`(${specs.kit})`)
      break
    case 'gpu':
      if (Number.isFinite(n(specs.vram))) add(`${n(specs.vram)} Go`)
      break
    case 'storage':
      add(specs.storage_type)
      if (Number.isFinite(n(specs.capacity))) add(formatCapacity(n(specs.capacity)))
      if (Number.isFinite(n(specs.health))) add(`santé ${n(specs.health)} %`)
      break
    case 'psu':
      if (Number.isFinite(n(specs.wattage))) add(`${n(specs.wattage)} W`)
      if (specs.certification && specs.certification !== 'Aucune') add(specs.certification)
      if (specs.modular && specs.modular !== 'Non') add(specs.modular === 'Full' ? 'modulaire' : 'semi-modulaire')
      break
    case 'case':
      add(specs.color)
      break
    case 'cooler':
      add(specs.cooler_type)
      add(specs.size)
      break
    case 'fans':
      if (Number.isFinite(n(specs.count))) add(`× ${n(specs.count)}`)
      break
    case 'os':
      add(specs.license)
      break
  }
  return parts.join(' · ')
}

export interface ListingOptions {
  emojis: boolean
  price: boolean
  benchmarks: boolean
  tests: boolean
  warranty: boolean
}

export const DEFAULT_LISTING_OPTIONS: ListingOptions = { emojis: true, price: true, benchmarks: true, tests: true, warranty: true }

function shortName(item: Item | undefined): string | null {
  if (!item) return null
  return item.model?.trim() || item.title
}

export function buildListingTitle(build: Build, components: Item[], categories: Category[]): string {
  const find = (slot: PcSlot) => components.find((c) => slotOf(c, categories) === slot)
  const ramTotal = components.filter((c) => slotOf(c, categories) === 'ram').reduce((s, r) => s + (Number.isFinite(n(r.specs.capacity)) ? n(r.specs.capacity) : 0), 0)
  const storage = components.filter((c) => slotOf(c, categories) === 'storage').reduce((s, r) => s + (Number.isFinite(n(r.specs.capacity)) ? n(r.specs.capacity) : 0), 0)
  const parts = [shortName(find('cpu')), shortName(find('gpu')), ramTotal ? `${ramTotal} Go RAM` : null, storage ? `${formatCapacity(storage)} SSD` : null].filter(Boolean)
  const kind = build.usage && /gaming/i.test(build.usage) ? 'PC Gamer' : 'PC'
  return parts.length ? `${kind} ${parts.join(' / ')}` : `${kind} ${build.name}`
}

export function buildListing(build: Build, components: Item[], categories: Category[], opts: ListingOptions = DEFAULT_LISTING_OPTIONS): string {
  const e = (emoji: string) => (opts.emojis ? `${emoji} ` : '')
  const bullet = opts.emojis ? '•' : '-'
  const lines: string[] = []
  lines.push(`${e('🖥️')}${buildListingTitle(build, components, categories)}`)
  if (build.usage) lines.push(`Idéal pour : ${build.usage}`)
  if (build.description?.trim()) {
    lines.push('', build.description.trim())
  }
  lines.push('', `${e('🔩')}Configuration :`)
  for (const slot of PC_SLOTS) {
    const parts = components.filter((c) => slotOf(c, categories) === slot.value)
    if (!parts.length) continue
    const names = parts.map((p) => {
      const sum = specSummary(slot.value, p.specs)
      return sum ? `${p.title} (${sum})` : p.title
    })
    lines.push(`${opts.emojis ? `${slot.emoji} ` : `${bullet} `}${slot.label} : ${names.join(' + ')}`)
  }
  const benches = build.benchmarks.filter((b) => b.label.trim() && b.value.trim())
  if (opts.benchmarks && benches.length) {
    lines.push('', `${e('📊')}Performances mesurées :`)
    for (const b of benches) lines.push(`${bullet} ${b.label} : ${b.value}${b.unit ? ` ${b.unit}` : ''}`)
  }
  const done = build.checklist.filter((c) => c.done)
  if (opts.tests && done.length) {
    lines.push('', `${e('✅')}Contrôles effectués :`)
    for (const c of done) lines.push(`${bullet} ${c.label}`)
  }
  if (opts.warranty && build.warranty_months > 0) {
    lines.push('', `${e('🛡️')}Garantie ${build.warranty_months} mois (hors casse et mauvaise utilisation).`)
  }
  const price = build.listed_price ?? build.target_price
  if (opts.price && price) {
    lines.push('', `${e('💶')}Prix : ${Math.round(price)} €`)
  }
  lines.push('', `${e('📦')}Remise en main propre possible, envoi soigné sur demande.`)
  return lines.join('\n')
}

export function itemListing(item: Item, category: Category | undefined, opts: { emojis: boolean }): string {
  const e = (emoji: string) => (opts.emojis ? `${emoji} ` : '')
  const lines: string[] = [item.title]
  const cond = CONDITIONS.find((c) => c.value === item.condition)
  if (cond) lines.push(`${e('✨')}État : ${cond.label}`)
  if (item.brand || item.model) lines.push(`${e('🏷️')}${[item.brand, item.model].filter(Boolean).join(' ')}`)
  const slot = category?.slot
  if (slot) {
    const sum = specSummary(slot, item.specs)
    if (sum) lines.push(`${e('🔩')}${sum}`)
  }
  lines.push('', `${e('📦')}Envoi rapide et soigné. Remise en main propre possible.`)
  return lines.join('\n')
}
