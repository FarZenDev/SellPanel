import type { BuildStatus, Condition, ExpenseCategory, ItemStatus, PcSlot, Settings } from './types.ts'

export type Tone = 'slate' | 'sky' | 'amber' | 'violet' | 'orange' | 'indigo' | 'emerald' | 'rose' | 'teal' | 'red' | 'zinc'

export interface StatusDef<T extends string> {
  value: T
  label: string
  short?: string
  tone: Tone
  hint: string
}

export const ITEM_STATUSES: StatusDef<ItemStatus>[] = [
  { value: 'ordered', label: 'Commandé', tone: 'sky', hint: 'Acheté, en cours de livraison' },
  { value: 'in_stock', label: 'En stock', tone: 'slate', hint: 'Reçu, prêt à être vendu ou monté' },
  { value: 'testing', label: 'À tester', tone: 'amber', hint: 'À tester, nettoyer ou réparer' },
  { value: 'listed', label: 'En vente', tone: 'violet', hint: 'Annonce en ligne' },
  { value: 'reserved', label: 'Réservé', tone: 'orange', hint: 'Acheteur trouvé, en attente de paiement / remise' },
  { value: 'in_build', label: 'Dans un PC', tone: 'indigo', hint: 'Intégré dans un PC monté' },
  { value: 'sold', label: 'Vendu', tone: 'emerald', hint: 'Vente conclue' },
  { value: 'returned', label: 'Retourné', tone: 'rose', hint: 'Vente annulée / retour client' },
  { value: 'kept', label: 'Gardé', tone: 'teal', hint: 'Conservé pour usage personnel' },
  { value: 'broken', label: 'HS / Perte', tone: 'red', hint: 'Défectueux, perdu ou irrécupérable' },
]

export const BUILD_STATUSES: StatusDef<BuildStatus>[] = [
  { value: 'planning', label: 'En préparation', tone: 'slate', hint: 'Recherche et achat des pièces' },
  { value: 'building', label: 'Montage', tone: 'sky', hint: 'Assemblage en cours' },
  { value: 'testing', label: 'Tests', tone: 'amber', hint: 'Stress tests, benchmarks, contrôle qualité' },
  { value: 'listed', label: 'En vente', tone: 'violet', hint: 'Annonce en ligne' },
  { value: 'reserved', label: 'Réservé', tone: 'orange', hint: 'Acheteur trouvé' },
  { value: 'sold', label: 'Vendu', tone: 'emerald', hint: 'PC vendu' },
  { value: 'kept', label: 'Gardé', tone: 'teal', hint: 'Conservé pour usage personnel' },
  { value: 'dismantled', label: 'Démonté', tone: 'zinc', hint: 'Pièces remises en stock' },
]

/** Statuts qui comptent comme du stock (capital immobilisé). */
export const ACTIVE_ITEM_STATUSES: ItemStatus[] = ['ordered', 'in_stock', 'testing', 'listed', 'reserved']
export const ACTIVE_BUILD_STATUSES: BuildStatus[] = ['planning', 'building', 'testing', 'listed', 'reserved']

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'neuf', label: 'Neuf (scellé)' },
  { value: 'neuf_ouvert', label: 'Neuf – déballé' },
  { value: 'tres_bon', label: 'Très bon état' },
  { value: 'bon', label: 'Bon état' },
  { value: 'correct', label: 'État correct' },
  { value: 'pieces', label: 'Pour pièces / HS' },
]

export interface SlotDef {
  value: PcSlot
  label: string
  required: boolean
  multiple: boolean
  emoji: string
}

export const PC_SLOTS: SlotDef[] = [
  { value: 'cpu', label: 'Processeur', required: true, multiple: false, emoji: '⚙️' },
  { value: 'cooler', label: 'Refroidissement', required: false, multiple: false, emoji: '❄️' },
  { value: 'motherboard', label: 'Carte mère', required: true, multiple: false, emoji: '🧩' },
  { value: 'ram', label: 'Mémoire vive', required: true, multiple: true, emoji: '🧠' },
  { value: 'gpu', label: 'Carte graphique', required: false, multiple: false, emoji: '🎮' },
  { value: 'storage', label: 'Stockage', required: true, multiple: true, emoji: '💾' },
  { value: 'psu', label: 'Alimentation', required: true, multiple: false, emoji: '🔌' },
  { value: 'case', label: 'Boîtier', required: true, multiple: false, emoji: '🖥️' },
  { value: 'fans', label: 'Ventilation', required: false, multiple: true, emoji: '🌀' },
  { value: 'os', label: 'Système / licence', required: false, multiple: false, emoji: '🪟' },
  { value: 'other', label: 'Autre', required: false, multiple: true, emoji: '🔧' },
]

export type SpecFieldType = 'text' | 'number' | 'select' | 'bool'

export interface SpecField {
  key: string
  label: string
  type: SpecFieldType
  unit?: string
  options?: string[]
  placeholder?: string
}

export const SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851', 'LGA1200', 'LGA1151', 'LGA1150', 'LGA1155', 'LGA2066', 'AM3+', 'sTRX4']
export const RAM_TYPES = ['DDR5', 'DDR4', 'DDR3']
export const FORM_FACTORS = ['Mini-ITX', 'Micro-ATX', 'ATX', 'E-ATX']

/** Caractéristiques techniques par emplacement — servent aux contrôles de compatibilité et aux fiches annonces. */
export const SLOT_SPECS: Record<PcSlot, SpecField[]> = {
  cpu: [
    { key: 'socket', label: 'Socket', type: 'select', options: SOCKETS },
    { key: 'cores', label: 'Cœurs / threads', type: 'text', placeholder: '6C/12T' },
    { key: 'tdp', label: 'TDP', type: 'number', unit: 'W' },
    { key: 'igpu', label: 'Partie graphique intégrée', type: 'bool' },
  ],
  motherboard: [
    { key: 'socket', label: 'Socket', type: 'select', options: SOCKETS },
    { key: 'chipset', label: 'Chipset', type: 'text', placeholder: 'B550' },
    { key: 'ram_type', label: 'Type de RAM', type: 'select', options: RAM_TYPES },
    { key: 'form_factor', label: 'Format', type: 'select', options: FORM_FACTORS },
    { key: 'wifi', label: 'Wi-Fi intégré', type: 'bool' },
  ],
  ram: [
    { key: 'ram_type', label: 'Type', type: 'select', options: RAM_TYPES },
    { key: 'capacity', label: 'Capacité totale', type: 'number', unit: 'Go' },
    { key: 'kit', label: 'Kit', type: 'text', placeholder: '2x8 Go' },
    { key: 'speed', label: 'Fréquence', type: 'number', unit: 'MHz' },
  ],
  gpu: [
    { key: 'vram', label: 'VRAM', type: 'number', unit: 'Go' },
    { key: 'tdp', label: 'Consommation', type: 'number', unit: 'W' },
    { key: 'length', label: 'Longueur', type: 'number', unit: 'mm' },
  ],
  storage: [
    { key: 'storage_type', label: 'Type', type: 'select', options: ['SSD NVMe', 'SSD SATA', 'HDD'] },
    { key: 'capacity', label: 'Capacité', type: 'number', unit: 'Go' },
    { key: 'health', label: 'Santé', type: 'number', unit: '%' },
  ],
  psu: [
    { key: 'wattage', label: 'Puissance', type: 'number', unit: 'W' },
    {
      key: 'certification',
      label: 'Certification',
      type: 'select',
      options: ['80+', '80+ Bronze', '80+ Silver', '80+ Gold', '80+ Platinum', '80+ Titanium', 'Aucune'],
    },
    { key: 'modular', label: 'Modulaire', type: 'select', options: ['Non', 'Semi', 'Full'] },
  ],
  case: [
    { key: 'form_factor', label: 'Format max. carte mère', type: 'select', options: FORM_FACTORS },
    { key: 'gpu_max_length', label: 'Longueur GPU max.', type: 'number', unit: 'mm' },
    { key: 'color', label: 'Couleur', type: 'text' },
  ],
  cooler: [
    { key: 'cooler_type', label: 'Type', type: 'select', options: ['Ventirad', 'Watercooling AIO', 'Stock'] },
    { key: 'size', label: 'Taille', type: 'text', placeholder: '120 mm / 240 mm' },
  ],
  fans: [{ key: 'count', label: 'Nombre', type: 'number' }],
  os: [{ key: 'license', label: 'Licence', type: 'text', placeholder: 'Windows 11 Pro' }],
  other: [],
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; tone: Tone }[] = [
  { value: 'emballage', label: 'Emballages & envois', tone: 'amber' },
  { value: 'transport', label: 'Déplacements / carburant', tone: 'sky' },
  { value: 'outillage', label: 'Outillage & consommables', tone: 'slate' },
  { value: 'abonnement', label: 'Abonnements & logiciels', tone: 'violet' },
  { value: 'boost', label: 'Boosts / mises en avant', tone: 'orange' },
  { value: 'banque', label: 'Frais bancaires', tone: 'zinc' },
  { value: 'autre', label: 'Autre', tone: 'teal' },
]

export const DEFAULT_SETTINGS: Settings = {
  shop_name: 'SellPanel',
  sku_prefix: 'SP',
  build_prefix: 'PC',
  monthly_goal: 500,
  hourly_rate: 0,
  stale_days: 60,
  micro_enabled: false,
  micro_rate: 12.3,
  dac7_sales: 30,
  dac7_amount: 2000,
  default_warranty_months: 3,
}

export const DEFAULT_CHECKLIST: string[] = [
  'Nettoyage / dépoussiérage complet',
  'Pâte thermique renouvelée',
  'BIOS à jour, XMP / EXPO activé',
  'Système installé, activé et pilotes à jour',
  'Stress test CPU (OCCT / Cinebench 30 min)',
  'Stress test GPU (3DMark / FurMark)',
  'Test mémoire (MemTest86 / TestMem5)',
  'Santé des disques vérifiée (CrystalDiskInfo)',
  'Températures relevées en charge',
  'Ports USB, audio, réseau et Wi-Fi testés',
  'Cable management soigné',
  'Photos de l’annonce réalisées',
]

export const BENCHMARK_PRESETS: { label: string; unit: string }[] = [
  { label: 'Cinebench 2024 multi', unit: 'pts' },
  { label: 'Cinebench R23 multi', unit: 'pts' },
  { label: '3DMark Time Spy', unit: 'pts' },
  { label: 'Fortnite 1080p', unit: 'FPS' },
  { label: 'Cyberpunk 2077 1080p', unit: 'FPS' },
  { label: 'Temp. CPU en charge', unit: '°C' },
  { label: 'Temp. GPU en charge', unit: '°C' },
]

export const BUILD_USAGES = ['Gaming 1080p', 'Gaming 1440p', 'Gaming 4K', 'Bureautique', 'Streaming', 'Montage vidéo / création', 'Mini PC / HTPC']
