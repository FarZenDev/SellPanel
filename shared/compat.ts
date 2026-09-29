import { FORM_FACTORS, PC_SLOTS } from './constants.ts'
import type { Category, Item, PcSlot } from './types.ts'

export type CheckLevel = 'ok' | 'warn' | 'error' | 'info'

export interface CompatCheck {
  level: CheckLevel
  title: string
  detail?: string
}

export interface CompatResult {
  checks: CompatCheck[]
  estimatedWattage: number | null
  recommendedWattage: number | null
  psuWattage: number | null
}

export function slotOf(item: Item, categories: Category[]): PcSlot {
  return categories.find((c) => c.id === item.category_id)?.slot ?? 'other'
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Contrôles de compatibilité façon PCPartPicker, à partir des caractéristiques saisies. */
export function checkBuild(components: Item[], categories: Category[]): CompatResult {
  const bySlot = new Map<PcSlot, Item[]>()
  for (const c of components) {
    const slot = slotOf(c, categories)
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), c])
  }
  const one = (slot: PcSlot) => bySlot.get(slot)?.[0]
  const checks: CompatCheck[] = []

  const missing = PC_SLOTS.filter((s) => s.required && !bySlot.has(s.value)).map((s) => s.label)
  if (missing.length) {
    checks.push({ level: 'warn', title: `Pièces manquantes : ${missing.join(', ')}`, detail: 'Ajoutez-les depuis votre stock ou créez-les directement.' })
  }

  for (const s of PC_SLOTS) {
    const list = bySlot.get(s.value) ?? []
    if (!s.multiple && list.length > 1) {
      checks.push({ level: 'warn', title: `${list.length} × ${s.label.toLowerCase()} dans la configuration`, detail: 'Vérifiez qu’il ne s’agit pas d’un doublon.' })
    }
  }

  const cpu = one('cpu')
  const mb = one('motherboard')
  const gpu = one('gpu')
  const psu = one('psu')
  const pcCase = one('case')

  if (!gpu && cpu) {
    if (cpu.specs.igpu === true) {
      checks.push({ level: 'ok', title: 'Affichage via la partie graphique du processeur' })
    } else {
      checks.push({
        level: cpu.specs.igpu === false ? 'error' : 'warn',
        title: 'Aucune carte graphique',
        detail:
          cpu.specs.igpu === false
            ? 'Ce processeur n’a pas de partie graphique intégrée : pas d’affichage possible.'
            : 'Vérifiez que le processeur possède une partie graphique intégrée (ex. pas de Ryzen sans « G », Intel « F »).',
      })
    }
  }

  const cpuSocket = str(cpu?.specs.socket)
  const mbSocket = str(mb?.specs.socket)
  if (cpuSocket && mbSocket) {
    checks.push(
      cpuSocket === mbSocket
        ? { level: 'ok', title: `Socket compatible (${cpuSocket})` }
        : { level: 'error', title: 'Socket incompatible', detail: `Processeur ${cpuSocket} ≠ carte mère ${mbSocket}.` },
    )
  }

  const mbRam = str(mb?.specs.ram_type)
  const rams = bySlot.get('ram') ?? []
  const ramTypes = [...new Set(rams.map((r) => str(r.specs.ram_type)).filter((x): x is string => !!x))]
  if (mbRam && ramTypes.length) {
    const bad = ramTypes.filter((t) => t !== mbRam)
    checks.push(
      bad.length === 0
        ? { level: 'ok', title: `Mémoire compatible (${mbRam})` }
        : { level: 'error', title: 'Type de mémoire incompatible', detail: `La carte mère accepte la ${mbRam}, pas la ${bad.join(' / ')}.` },
    )
  }
  if (ramTypes.length > 1) {
    checks.push({ level: 'warn', title: 'Barrettes de types différents', detail: ramTypes.join(' + ') })
  }
  const ramTotal = rams.reduce((s, r) => s + (num(r.specs.capacity) ?? 0), 0)
  if (ramTotal > 0 && ramTotal < 16) {
    checks.push({ level: 'info', title: `${ramTotal} Go de mémoire`, detail: '16 Go est aujourd’hui le minimum attendu pour un PC gamer.' })
  }

  const mbForm = str(mb?.specs.form_factor)
  const caseForm = str(pcCase?.specs.form_factor)
  if (mbForm && caseForm) {
    const ok = FORM_FACTORS.indexOf(mbForm) <= FORM_FACTORS.indexOf(caseForm)
    checks.push(
      ok
        ? { level: 'ok', title: `Carte mère ${mbForm} compatible avec le boîtier` }
        : { level: 'error', title: 'Carte mère trop grande pour le boîtier', detail: `${mbForm} dans un boîtier ${caseForm}.` },
    )
  }

  const gpuLen = num(gpu?.specs.length)
  const caseMax = num(pcCase?.specs.gpu_max_length)
  if (gpuLen && caseMax) {
    checks.push(
      gpuLen <= caseMax
        ? { level: 'ok', title: `Carte graphique rentre dans le boîtier (${gpuLen} / ${caseMax} mm)` }
        : { level: 'error', title: 'Carte graphique trop longue', detail: `${gpuLen} mm pour ${caseMax} mm disponibles.` },
    )
  }

  // Estimation de consommation : CPU + GPU + carte mère/RAM/stockage/ventilation.
  let estimatedWattage: number | null = null
  let recommendedWattage: number | null = null
  const cpuTdp = num(cpu?.specs.tdp)
  const gpuTdp = num(gpu?.specs.tdp)
  if (cpu || gpu) {
    const storage = bySlot.get('storage')?.length ?? 0
    const fans = (bySlot.get('fans') ?? []).reduce((s, f) => s + (num(f.specs.count) ?? 1), 0)
    estimatedWattage = Math.round((cpuTdp ?? 65) * 1.2 + (gpuTdp ?? (gpu ? 150 : 0)) + 50 + rams.length * 5 + storage * 7 + fans * 3)
    recommendedWattage = Math.ceil((estimatedWattage * 1.35) / 50) * 50
  }
  const psuWattage = num(psu?.specs.wattage)
  if (psuWattage && estimatedWattage && recommendedWattage) {
    if (psuWattage < estimatedWattage) {
      checks.push({ level: 'error', title: 'Alimentation insuffisante', detail: `${psuWattage} W pour ~${estimatedWattage} W estimés en charge.` })
    } else if (psuWattage < recommendedWattage) {
      checks.push({ level: 'warn', title: 'Alimentation un peu juste', detail: `${psuWattage} W — ${recommendedWattage} W recommandés pour garder de la marge.` })
    } else {
      checks.push({ level: 'ok', title: `Alimentation suffisante (${psuWattage} W pour ~${estimatedWattage} W)` })
    }
  }
  if (psu && /aucune/i.test(String(psu.specs.certification ?? ''))) {
    checks.push({ level: 'warn', title: 'Alimentation non certifiée', detail: 'Un argument négatif pour les acheteurs avertis.' })
  }

  if (components.length > 0 && !checks.some((c) => c.level === 'ok' || c.level === 'error')) {
    checks.push({ level: 'info', title: 'Renseignez les caractéristiques des pièces', detail: 'Socket, type de RAM, format, puissance… pour activer les contrôles automatiques.' })
  }

  const order: Record<CheckLevel, number> = { error: 0, warn: 1, info: 2, ok: 3 }
  checks.sort((a, b) => order[a.level] - order[b.level])
  return { checks, estimatedWattage, recommendedWattage, psuWattage }
}
