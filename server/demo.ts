import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { platformFee, round2, todayISO } from '../shared/calc.ts'
import type { Item, Specs } from '../shared/types.ts'
import { transaction } from './db.ts'
import type { Store } from './store.ts'

/** Jeu de données de démonstration réaliste (revente de matériel PC sur ~10 mois). */
export function seedDemo(store: Store) {
  const now = Date.now()
  const ago = (days: number) => todayISO(new Date(now - days * 86_400_000))
  const platforms = store.listPlatforms()
  const categories = store.listCategories()
  const P = (name: string) => platforms.find((p) => p.name === name)?.id ?? null
  const C = (name: string) => categories.find((c) => c.name === name)?.id ?? null
  const platformById = (id: number | null) => platforms.find((p) => p.id === id)

  interface Demo {
    title: string
    cat: string
    brand?: string
    model?: string
    cond?: Item['condition']
    from: string
    bought: number
    price: number
    ship?: number
    target?: number
    status?: Item['status']
    listedOn?: string
    listed?: number
    listedPrice?: number
    soldOn?: string
    sold?: number
    salePrice?: number
    saleShip?: number
    specs?: Specs
    location?: string
    tags?: string[]
    notes?: string
  }

  const make = (d: Demo, extra: Partial<Item> = {}) => {
    const buyPlatform = platformById(P(d.from))
    const ship = d.ship ?? 0
    const buyerFee = buyPlatform && (buyPlatform.name === 'Vinted' || ship > 0) ? platformFee(buyPlatform, d.price, 'buyer') : 0
    const saleDate = d.sold != null ? ago(d.sold) : null
    let saleFees = 0
    if (d.soldOn === 'eBay' && d.salePrice && saleDate && saleDate < '2026-09-01') saleFees = round2(d.salePrice * 0.1042 + 0.35)
    const status: Item['status'] = d.status ?? (d.sold != null ? 'sold' : d.listed != null ? 'listed' : 'in_stock')
    return store.createItem({
      title: d.title,
      category_id: C(d.cat),
      brand: d.brand ?? null,
      model: d.model ?? null,
      condition: d.cond ?? 'tres_bon',
      status,
      purchase_platform_id: P(d.from),
      purchase_date: ago(d.bought),
      purchase_price: d.price,
      purchase_shipping: ship,
      purchase_fees: buyerFee,
      received_date: status === 'ordered' ? null : ago(Math.max(0, d.bought - 2)),
      target_price: d.target ?? d.salePrice ?? null,
      listed_price: d.listedPrice ?? (d.sold != null ? d.salePrice : null) ?? null,
      listed_date: d.listed != null ? ago(d.listed) : d.sold != null ? ago(d.sold + 5) : null,
      sale_platform_id: d.soldOn ? P(d.soldOn) : d.listedOn ? P(d.listedOn) : null,
      sale_price: d.salePrice ?? null,
      sale_date: saleDate,
      sale_fees: saleFees,
      sale_shipping: d.saleShip ?? 0,
      shipped_date: saleDate && d.soldOn !== 'Main propre' ? saleDate : null,
      specs: d.specs ?? {},
      location: d.location ?? null,
      tags: d.tags ?? [],
      notes: d.notes ?? null,
      ...extra,
    })
  }

  transaction(store.db, () => {
    // Ventes unitaires
    const sold: Demo[] = [
      {
        title: 'NVIDIA RTX 3070 Founders Edition',
        cat: 'Carte graphique',
        brand: 'NVIDIA',
        model: 'RTX 3070 FE',
        from: 'Leboncoin',
        bought: 280,
        price: 260,
        soldOn: 'eBay',
        sold: 250,
        salePrice: 340,
        saleShip: 12,
        specs: { vram: 8, tdp: 220, length: 242 },
      },
      {
        title: 'AMD Ryzen 7 5800X',
        cat: 'Processeur',
        brand: 'AMD',
        model: 'Ryzen 7 5800X',
        from: 'Vinted',
        bought: 240,
        price: 150,
        soldOn: 'Leboncoin',
        sold: 225,
        salePrice: 195,
        specs: { socket: 'AM4', cores: '8C/16T', tdp: 105, igpu: false },
      },
      {
        title: 'Kit 32 Go DDR4 3600 Corsair Vengeance',
        cat: 'Mémoire RAM',
        brand: 'Corsair',
        from: 'eBay',
        bought: 205,
        price: 55,
        ship: 5,
        soldOn: 'Vinted',
        sold: 190,
        salePrice: 85,
        specs: { ram_type: 'DDR4', capacity: 32, kit: '2x16 Go', speed: 3600 },
      },
      {
        title: 'SSD Samsung 980 Pro 1 To',
        cat: 'Stockage',
        brand: 'Samsung',
        model: '980 Pro',
        from: 'Leboncoin',
        bought: 170,
        price: 50,
        soldOn: 'Vinted',
        sold: 158,
        salePrice: 75,
        specs: { storage_type: 'SSD NVMe', capacity: 1000, health: 98 },
      },
      {
        title: 'Sapphire Pulse RX 6700 XT 12 Go',
        cat: 'Carte graphique',
        brand: 'Sapphire',
        model: 'RX 6700 XT',
        from: 'Vinted',
        bought: 150,
        price: 230,
        soldOn: 'Leboncoin',
        sold: 121,
        salePrice: 290,
        specs: { vram: 12, tdp: 230 },
      },
      {
        title: 'Intel Core i5-12400F',
        cat: 'Processeur',
        brand: 'Intel',
        model: 'i5-12400F',
        from: 'Leboncoin',
        bought: 132,
        price: 85,
        soldOn: 'eBay',
        sold: 110,
        salePrice: 115,
        saleShip: 6,
        specs: { socket: 'LGA1700', cores: '6C/12T', tdp: 65, igpu: false },
      },
      {
        title: 'GTX 1080 Ti (artefacts) — vendue pour pièces',
        cat: 'Carte graphique',
        brand: 'NVIDIA',
        cond: 'pieces',
        from: 'Leboncoin',
        bought: 112,
        price: 150,
        soldOn: 'eBay',
        sold: 82,
        salePrice: 60,
        saleShip: 9,
        notes: 'Artefacts après 10 min de charge : mémoire HS. Leçon : toujours tester sur place.',
      },
      {
        title: 'MSI MAG B550 Tomahawk',
        cat: 'Carte mère',
        brand: 'MSI',
        model: 'B550 Tomahawk',
        from: 'Vinted',
        bought: 100,
        price: 70,
        soldOn: 'Leboncoin',
        sold: 86,
        salePrice: 100,
        specs: { socket: 'AM4', chipset: 'B550', ram_type: 'DDR4', form_factor: 'ATX' },
      },
      {
        title: 'Corsair RM750x',
        cat: 'Alimentation',
        brand: 'Corsair',
        model: 'RM750x',
        from: 'eBay',
        bought: 92,
        price: 60,
        ship: 7,
        soldOn: 'Vinted',
        sold: 70,
        salePrice: 85,
        specs: { wattage: 750, certification: '80+ Gold', modular: 'Full' },
      },
      { title: 'Écran Dell S2721DGF 27" 165 Hz', cat: 'Écran', brand: 'Dell', from: 'Leboncoin', bought: 76, price: 180, soldOn: 'Main propre', sold: 61, salePrice: 240 },
      {
        title: 'MSI RTX 3060 Ti Gaming X',
        cat: 'Carte graphique',
        brand: 'MSI',
        model: 'RTX 3060 Ti',
        from: 'Leboncoin',
        bought: 62,
        price: 200,
        soldOn: 'eBay',
        sold: 41,
        salePrice: 255,
        saleShip: 11,
        specs: { vram: 8, tdp: 200 },
      },
      { title: 'PS5 Digital + 2 manettes', cat: 'Console', brand: 'Sony', from: 'Leboncoin', bought: 47, price: 280, soldOn: 'Vinted', sold: 35, salePrice: 340 },
      {
        title: 'AMD Ryzen 5 5600X',
        cat: 'Processeur',
        brand: 'AMD',
        model: 'Ryzen 5 5600X',
        from: 'Vinted',
        bought: 31,
        price: 90,
        soldOn: 'Leboncoin',
        sold: 16,
        salePrice: 115,
        specs: { socket: 'AM4', cores: '6C/12T', tdp: 65, igpu: false },
      },
      { title: 'Clavier Logitech G915 TKL', cat: 'Périphérique', brand: 'Logitech', from: 'Vinted', bought: 26, price: 70, soldOn: 'Vinted', sold: 11, salePrice: 105 },
      {
        title: 'Gigabyte RTX 4070 Windforce OC',
        cat: 'Carte graphique',
        brand: 'Gigabyte',
        model: 'RTX 4070',
        from: 'Leboncoin',
        bought: 21,
        price: 430,
        soldOn: 'eBay',
        sold: 6,
        salePrice: 520,
        saleShip: 14,
        specs: { vram: 12, tdp: 200, length: 261 },
      },
      {
        title: 'Kit 32 Go DDR5 6000 G.Skill Trident Z5',
        cat: 'Mémoire RAM',
        brand: 'G.Skill',
        from: 'eBay',
        bought: 18,
        price: 70,
        ship: 6,
        soldOn: 'Vinted',
        sold: 3,
        salePrice: 98,
        specs: { ram_type: 'DDR5', capacity: 32, kit: '2x16 Go', speed: 6000 },
      },
    ]
    for (const d of sold) make(d)

    // Stock actuel
    const stock: Demo[] = [
      {
        title: 'ASUS TUF RTX 3080 10 Go',
        cat: 'Carte graphique',
        brand: 'ASUS',
        model: 'RTX 3080',
        from: 'Vinted',
        bought: 13,
        price: 390,
        target: 470,
        listedOn: 'Leboncoin',
        listed: 9,
        listedPrice: 479,
        specs: { vram: 10, tdp: 320, length: 300 },
        location: 'Étagère A2',
        tags: ['à négocier'],
      },
      {
        title: 'AMD Ryzen 9 5900X',
        cat: 'Processeur',
        brand: 'AMD',
        model: 'Ryzen 9 5900X',
        from: 'Leboncoin',
        bought: 8,
        price: 170,
        target: 230,
        specs: { socket: 'AM4', cores: '12C/24T', tdp: 105, igpu: false },
        location: 'Tiroir 1',
      },
      {
        title: 'SSD Crucial P5 Plus 2 To',
        cat: 'Stockage',
        brand: 'Crucial',
        from: 'eBay',
        bought: 6,
        price: 85,
        ship: 4,
        target: 120,
        status: 'testing',
        specs: { storage_type: 'SSD NVMe', capacity: 2000 },
        location: 'Tiroir 2',
      },
      {
        title: 'ASUS TUF Gaming B650-Plus',
        cat: 'Carte mère',
        brand: 'ASUS',
        from: 'Vinted',
        bought: 3,
        price: 110,
        target: 150,
        status: 'ordered',
        specs: { socket: 'AM5', chipset: 'B650', ram_type: 'DDR5', form_factor: 'ATX' },
      },
      {
        title: 'MacBook Air M1 8 Go / 256 Go',
        cat: 'PC portable',
        brand: 'Apple',
        from: 'Leboncoin',
        bought: 96,
        price: 450,
        target: 560,
        listedOn: 'Vinted',
        listed: 72,
        listedPrice: 549,
        location: 'Bureau',
        tags: ['baisser le prix'],
      },
      {
        title: 'Écran LG 27GL850 27" 144 Hz',
        cat: 'Écran',
        brand: 'LG',
        from: 'Leboncoin',
        bought: 80,
        price: 170,
        target: 230,
        listedOn: 'Leboncoin',
        listed: 77,
        listedPrice: 239,
        location: 'Garage',
      },
      {
        title: 'Manette Xbox Elite Series 2',
        cat: 'Périphérique',
        brand: 'Microsoft',
        from: 'Vinted',
        bought: 66,
        price: 60,
        target: 95,
        listedOn: 'Vinted',
        listed: 60,
        listedPrice: 95,
      },
    ]
    for (const d of stock) make(d)

    // PC 1 — vendu
    const b1 = store.createBuild({
      name: 'Budget Gamer 1080p',
      usage: 'Gaming 1080p',
      target_price: 650,
      extra_costs: 12,
      labor_hours: 4,
      warranty_months: 3,
      description: 'PC idéal pour Fortnite, Valorant, Warzone en 1080p. Entièrement nettoyé et testé.',
    })
    const b1Parts: Demo[] = [
      {
        title: 'AMD Ryzen 5 5600',
        cat: 'Processeur',
        brand: 'AMD',
        model: 'Ryzen 5 5600',
        from: 'Vinted',
        bought: 122,
        price: 80,
        target: 95,
        specs: { socket: 'AM4', cores: '6C/12T', tdp: 65, igpu: false },
      },
      {
        title: 'Gigabyte B550M DS3H',
        cat: 'Carte mère',
        brand: 'Gigabyte',
        model: 'B550M DS3H',
        from: 'Leboncoin',
        bought: 120,
        price: 55,
        target: 65,
        specs: { socket: 'AM4', chipset: 'B550', ram_type: 'DDR4', form_factor: 'Micro-ATX' },
      },
      {
        title: 'Kit 16 Go DDR4 3200 Crucial Ballistix',
        cat: 'Mémoire RAM',
        brand: 'Crucial',
        from: 'Vinted',
        bought: 119,
        price: 25,
        target: 35,
        specs: { ram_type: 'DDR4', capacity: 16, kit: '2x8 Go', speed: 3200 },
      },
      {
        title: 'MSI RTX 3060 Ventus 2X 12 Go',
        cat: 'Carte graphique',
        brand: 'MSI',
        model: 'RTX 3060',
        from: 'Leboncoin',
        bought: 117,
        price: 190,
        target: 220,
        specs: { vram: 12, tdp: 170, length: 235 },
      },
      {
        title: 'SSD Kingston NV2 1 To',
        cat: 'Stockage',
        brand: 'Kingston',
        from: 'Amazon',
        bought: 115,
        price: 52,
        cond: 'neuf',
        target: 55,
        specs: { storage_type: 'SSD NVMe', capacity: 1000, health: 100 },
      },
      {
        title: 'be quiet! System Power 10 650 W',
        cat: 'Alimentation',
        brand: 'be quiet!',
        from: 'Leboncoin',
        bought: 116,
        price: 35,
        target: 45,
        specs: { wattage: 650, certification: '80+ Bronze', modular: 'Non' },
      },
      {
        title: 'Boîtier Aerocool Cylon',
        cat: 'Boîtier',
        brand: 'Aerocool',
        from: 'Vinted',
        bought: 116,
        price: 30,
        target: 35,
        specs: { form_factor: 'ATX', gpu_max_length: 371, color: 'Noir RGB' },
      },
    ]
    for (const d of b1Parts) {
      const it = make({ ...d, status: 'in_stock' })
      store.updateItem(it.id, { build_id: b1.id })
    }
    store.updateBuild(b1.id, {
      status: 'sold',
      listed_price: 669,
      listed_date: ago(108),
      sale_platform_id: P('Leboncoin'),
      sale_price: 650,
      sale_date: ago(96),
      buyer: 'Thomas (Lyon)',
      benchmarks: [
        { id: 'b1', label: 'Cinebench R23 multi', value: '10 850', unit: 'pts' },
        { id: 'b2', label: 'Fortnite 1080p (épique)', value: '120', unit: 'FPS' },
        { id: 'b3', label: 'Temp. CPU en charge', value: '72', unit: '°C' },
      ],
      checklist: store.getBuild(b1.id).checklist.map((c) => ({ ...c, done: true })),
    })

    // PC 2 — en vente
    const b2 = store.createBuild({
      name: 'Gamer 1440p RTX 3070',
      usage: 'Gaming 1440p',
      target_price: 850,
      extra_costs: 15,
      labor_hours: 5,
      warranty_months: 3,
      description: 'Config équilibrée pour jouer en 1440p, silencieuse et bien ventilée.',
    })
    const b2Parts: Demo[] = [
      {
        title: 'Intel Core i5-12600KF',
        cat: 'Processeur',
        brand: 'Intel',
        model: 'i5-12600KF',
        from: 'Leboncoin',
        bought: 42,
        price: 130,
        target: 150,
        specs: { socket: 'LGA1700', cores: '10C/16T', tdp: 125, igpu: false },
      },
      {
        title: 'MSI PRO B660M-A DDR4',
        cat: 'Carte mère',
        brand: 'MSI',
        model: 'B660M-A',
        from: 'Vinted',
        bought: 40,
        price: 75,
        target: 90,
        specs: { socket: 'LGA1700', chipset: 'B660', ram_type: 'DDR4', form_factor: 'Micro-ATX' },
      },
      {
        title: 'Kit 32 Go DDR4 3600 Kingston Fury',
        cat: 'Mémoire RAM',
        brand: 'Kingston',
        from: 'eBay',
        bought: 38,
        price: 50,
        ship: 5,
        target: 65,
        specs: { ram_type: 'DDR4', capacity: 32, kit: '2x16 Go', speed: 3600 },
      },
      {
        title: 'NVIDIA RTX 3070 Gaming OC',
        cat: 'Carte graphique',
        brand: 'Gigabyte',
        model: 'RTX 3070',
        from: 'Leboncoin',
        bought: 37,
        price: 250,
        target: 290,
        specs: { vram: 8, tdp: 220, length: 286 },
      },
      {
        title: 'SSD WD Black SN770 1 To',
        cat: 'Stockage',
        brand: 'WD',
        from: 'Vinted',
        bought: 36,
        price: 45,
        target: 55,
        specs: { storage_type: 'SSD NVMe', capacity: 1000, health: 100 },
      },
      {
        title: 'Corsair RM650 (2021)',
        cat: 'Alimentation',
        brand: 'Corsair',
        model: 'RM650',
        from: 'Leboncoin',
        bought: 35,
        price: 55,
        target: 65,
        specs: { wattage: 650, certification: '80+ Gold', modular: 'Full' },
      },
      {
        title: 'NZXT H510 Blanc',
        cat: 'Boîtier',
        brand: 'NZXT',
        from: 'Vinted',
        bought: 35,
        price: 35,
        target: 45,
        specs: { form_factor: 'ATX', gpu_max_length: 325, color: 'Blanc' },
      },
      {
        title: 'Thermalright Peerless Assassin 120',
        cat: 'Refroidissement',
        brand: 'Thermalright',
        from: 'Amazon',
        bought: 33,
        price: 38,
        cond: 'neuf',
        target: 35,
        specs: { cooler_type: 'Ventirad', size: '2 × 120 mm' },
      },
    ]
    for (const d of b2Parts) {
      const it = make({ ...d, status: 'in_stock' })
      store.updateItem(it.id, { build_id: b2.id })
    }
    const checklist2 = store.getBuild(b2.id).checklist.map((c, i) => ({ ...c, done: i < 10 }))
    store.updateBuild(b2.id, {
      status: 'listed',
      listed_price: 849,
      listed_date: ago(20),
      sale_platform_id: P('Leboncoin'),
      checklist: checklist2,
      benchmarks: [
        { id: 'b1', label: 'Cinebench 2024 multi', value: '1 050', unit: 'pts' },
        { id: 'b2', label: '3DMark Time Spy', value: '13 400', unit: 'pts' },
        { id: 'b3', label: 'Cyberpunk 2077 1440p (élevé)', value: '68', unit: 'FPS' },
      ],
    })

    // PC 3 — en test, alimentation manquante (montre les contrôles de compatibilité)
    const b3 = store.createBuild({ name: 'Mini PC bureautique ITX', usage: 'Mini PC / HTPC', target_price: 420, labor_hours: 2 })
    const b3Parts: Demo[] = [
      {
        title: 'AMD Ryzen 5 5600G',
        cat: 'Processeur',
        brand: 'AMD',
        model: 'Ryzen 5 5600G',
        from: 'Vinted',
        bought: 11,
        price: 70,
        target: 85,
        specs: { socket: 'AM4', cores: '6C/12T', tdp: 65, igpu: true },
      },
      {
        title: 'ASRock A520M-ITX/ac',
        cat: 'Carte mère',
        brand: 'ASRock',
        from: 'Leboncoin',
        bought: 10,
        price: 60,
        target: 70,
        specs: { socket: 'AM4', chipset: 'A520', ram_type: 'DDR4', form_factor: 'Mini-ITX', wifi: true },
      },
      {
        title: 'Kit 16 Go DDR4 3200 Corsair LPX',
        cat: 'Mémoire RAM',
        brand: 'Corsair',
        from: 'Vinted',
        bought: 10,
        price: 22,
        target: 30,
        specs: { ram_type: 'DDR4', capacity: 16, kit: '2x8 Go', speed: 3200 },
      },
      {
        title: 'SSD Samsung 870 EVO 500 Go',
        cat: 'Stockage',
        brand: 'Samsung',
        from: 'eBay',
        bought: 9,
        price: 25,
        ship: 4,
        target: 35,
        specs: { storage_type: 'SSD SATA', capacity: 500, health: 96 },
      },
      {
        title: 'Cooler Master NR200',
        cat: 'Boîtier',
        brand: 'Cooler Master',
        from: 'Leboncoin',
        bought: 7,
        price: 55,
        target: 65,
        specs: { form_factor: 'Mini-ITX', gpu_max_length: 330, color: 'Noir' },
      },
    ]
    for (const d of b3Parts) {
      const it = make({ ...d, status: 'in_stock' })
      store.updateItem(it.id, { build_id: b3.id })
    }
    store.updateBuild(b3.id, { status: 'testing' })

    // Lot : PC complet acheté pour être revendu en pièces
    const lot = store.createLot({
      name: 'PC gamer i7-8700K complet (à démonter)',
      platform_id: P('Leboncoin'),
      purchase_date: ago(56),
      price: 380,
      seller: 'Julien — Villeurbanne',
      notes: 'Acheté en main propre, testé sur place. Rentable uniquement en pièces détachées.',
      allocation: 'value',
      items: [
        {
          title: 'Intel Core i7-8700K',
          category_id: C('Processeur'),
          brand: 'Intel',
          status: 'in_stock',
          target_price: 90,
          condition: 'bon',
          specs: { socket: 'LGA1151', cores: '6C/12T', tdp: 95, igpu: true },
        },
        {
          title: 'ASUS Prime Z370-P',
          category_id: C('Carte mère'),
          brand: 'ASUS',
          status: 'in_stock',
          target_price: 60,
          condition: 'bon',
          specs: { socket: 'LGA1151', chipset: 'Z370', ram_type: 'DDR4', form_factor: 'ATX' },
        },
        {
          title: 'Kit 16 Go DDR4 3000 HyperX',
          category_id: C('Mémoire RAM'),
          brand: 'HyperX',
          status: 'in_stock',
          target_price: 30,
          condition: 'bon',
          specs: { ram_type: 'DDR4', capacity: 16, kit: '2x8 Go', speed: 3000 },
        },
        { title: 'EVGA GTX 1080 SC 8 Go', category_id: C('Carte graphique'), brand: 'EVGA', status: 'in_stock', target_price: 150, condition: 'bon', specs: { vram: 8, tdp: 180 } },
        {
          title: 'Seasonic Focus GX-650',
          category_id: C('Alimentation'),
          brand: 'Seasonic',
          status: 'in_stock',
          target_price: 45,
          condition: 'bon',
          specs: { wattage: 650, certification: '80+ Gold', modular: 'Full' },
        },
        {
          title: 'Fractal Design Meshify C',
          category_id: C('Boîtier'),
          brand: 'Fractal Design',
          status: 'in_stock',
          target_price: 50,
          condition: 'bon',
          specs: { form_factor: 'ATX', gpu_max_length: 315 },
        },
      ],
    })
    const lotItems = store.getLotDetail(lot.id).items
    const sellLot = (title: string, patch: Partial<Item>) => {
      const it = lotItems.find((i) => i.title === title)
      if (it) store.updateItem(it.id, patch)
    }
    sellLot('Intel Core i7-8700K', {
      status: 'sold',
      sale_platform_id: P('eBay'),
      sale_price: 95,
      sale_date: ago(41),
      sale_fees: round2(95 * 0.1042 + 0.35),
      sale_shipping: 7,
      shipped_date: ago(40),
    })
    sellLot('EVGA GTX 1080 SC 8 Go', { status: 'sold', sale_platform_id: P('Leboncoin'), sale_price: 160, sale_date: ago(36) })
    sellLot('Kit 16 Go DDR4 3000 HyperX', { status: 'sold', sale_platform_id: P('Vinted'), sale_price: 32, sale_date: ago(29), shipped_date: ago(28) })
    sellLot('ASUS Prime Z370-P', { status: 'listed', sale_platform_id: P('Leboncoin'), listed_price: 59 })
    sellLot('Fractal Design Meshify C', { status: 'listed', sale_platform_id: P('Leboncoin'), listed_price: 55 })

    // Vente récente à expédier
    make(
      {
        title: 'Ventirad Noctua NH-U12S',
        cat: 'Refroidissement',
        brand: 'Noctua',
        from: 'Leboncoin',
        bought: 14,
        price: 25,
        soldOn: 'Vinted',
        sold: 1,
        salePrice: 45,
        specs: { cooler_type: 'Ventirad', size: '120 mm' },
      },
      { shipped_date: null },
    )

    // Dépenses
    const expenses: [number, 'emballage' | 'transport' | 'outillage' | 'abonnement' | 'boost' | 'autre', number, string, string | null][] = [
      [270, 'emballage', 18.5, 'Cartons + papier bulle', null],
      [230, 'transport', 24, 'Essence — récupération Leboncoin', 'Leboncoin'],
      [200, 'outillage', 9.9, 'Pâte thermique Arctic MX-6', null],
      [160, 'emballage', 14, 'Rouleau de papier bulle', null],
      [120, 'transport', 31, 'Essence — tournée Lyon', 'Leboncoin'],
      [118, 'outillage', 17.9, 'Kit tournevis iFixit', null],
      [90, 'boost', 3.5, 'Mise en avant annonce', 'Vinted'],
      [60, 'emballage', 12, 'Cartons GPU', null],
      [56, 'transport', 18, 'Essence — lot i7-8700K', 'Leboncoin'],
      [34, 'outillage', 12.99, 'Clé USB Windows + câbles SATA', null],
      [20, 'boost', 2.95, 'Remontée annonce', 'Vinted'],
      [5, 'emballage', 9.5, 'Scotch + étiquettes', null],
    ]
    for (const [days, category, amount, description, platform] of expenses) {
      store.createExpense({ date: ago(days), category, amount, description, platform_id: platform ? P(platform) : null })
    }
  })
}

// Exécution directe : `npm run seed:demo`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { Store } = await import('./store.ts')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(root, 'data'))
  const store = new Store({ dbFile: path.join(dataDir, 'sellpanel.db'), uploadsDir: path.join(dataDir, 'uploads') })
  const counts = store.counts()
  if (counts.items + counts.builds + counts.lots > 0) {
    console.error('La base contient déjà des données : démo non chargée.')
    process.exit(1)
  }
  seedDemo(store)
  console.log('Données de démonstration chargées.')
}
