import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  Cpu,
  Download,
  Eye,
  KanbanSquare,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Table2,
  Tag,
  Trash2,
  X,
  Boxes,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { itemMetrics, todayISO, type ItemMetrics } from '@shared/calc'
import { ACTIVE_ITEM_STATUSES, ITEM_STATUSES } from '@shared/constants'
import type { Item, ItemStatus } from '@shared/types'
import { ItemStatusBadge, PlatformTag } from '@/components/badges'
import { useEditors } from '@/components/editors'
import { PageHeader } from '@/components/layout/app-shell'
import { Percent, Profit } from '@/components/money'
import { Thumb } from '@/components/photos'
import { toneClasses } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, PageLoader, Segmented } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { exportItemsCsv } from '@/lib/csv'
import { eur, eur0, fmtDateShort, fmtDays } from '@/lib/format'
import { useAction, useBuilds, useItems, useLookups } from '@/lib/queries'
import { cn, isTypingTarget, normalize } from '@/lib/utils'

type Tab = 'stock' | 'all' | 'ordered' | 'testing' | 'listed' | 'in_build' | 'sold' | 'other'
type SortKey = 'title' | 'status' | 'purchase_date' | 'cost' | 'price' | 'profit' | 'roi' | 'days'
type View = 'table' | 'board'

interface Row {
  item: Item
  m: ItemMetrics
  price: number | null
  profit: number | null
  roi: number | null
  days: number | null
}

const TAB_FILTERS: Record<Tab, (s: ItemStatus) => boolean> = {
  stock: (s) => ACTIVE_ITEM_STATUSES.includes(s),
  all: () => true,
  ordered: (s) => s === 'ordered',
  testing: (s) => s === 'testing',
  listed: (s) => s === 'listed' || s === 'reserved',
  in_build: (s) => s === 'in_build',
  sold: (s) => s === 'sold',
  other: (s) => s === 'returned' || s === 'kept' || s === 'broken',
}

const BOARD_COLUMNS: ItemStatus[] = ['ordered', 'in_stock', 'testing', 'listed', 'reserved', 'sold']

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === k
  return (
    <th className={cn('px-3 py-2.5 font-medium', className)}>
      <button type="button" onClick={() => onSort(k)} className={cn('inline-flex items-center gap-1 hover:text-fg', active && 'text-fg')}>
        {label}
        {active ? sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-40" />}
      </button>
    </th>
  )
}

function useItemActions() {
  const editors = useEditors()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const duplicate = useAction((id: number) => api.post<Item>(`/api/items/${id}/duplicate`), { success: 'Article dupliqué' })
  const remove = useAction((id: number) => api.del(`/api/items/${id}`), { success: 'Article supprimé' })
  return (item: Item, m: ItemMetrics): ReactNode => (
    <>
      <MenuItem icon={<Eye />} onSelect={() => navigate(`/items/${item.id}`)}>
        Voir la fiche
      </MenuItem>
      <MenuItem icon={<Pencil />} onSelect={() => editors.openItem(item)}>
        Modifier
      </MenuItem>
      {item.build_id != null && (
        <MenuItem icon={<Cpu />} onSelect={() => navigate(`/builds/${item.build_id}`)}>
          Voir le PC
        </MenuItem>
      )}
      {item.status !== 'sold' && item.build_id == null && (
        <>
          <MenuItem icon={<Tag />} onSelect={() => editors.openList({ kind: 'item', item, cost: m.cost })}>
            Mettre en vente
          </MenuItem>
          <MenuItem icon={<ShoppingCart />} onSelect={() => editors.openSell({ kind: 'item', item, cost: m.cost })}>
            Marquer vendu
          </MenuItem>
        </>
      )}
      <MenuItem icon={<Copy />} onSelect={() => duplicate.mutate(item.id)}>
        Dupliquer
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<Trash2 />}
        danger
        onSelect={async () => {
          if (
            await confirm({
              title: 'Supprimer cet article ?',
              description: `« ${item.title} » et son historique seront définitivement supprimés.`,
              confirmLabel: 'Supprimer',
              danger: true,
            })
          )
            remove.mutate(item.id)
        }}
      >
        Supprimer
      </MenuItem>
    </>
  )
}

function BulkBar({ ids, onClear }: { ids: number[]; onClear: () => void }) {
  const confirm = useConfirm()
  const lk = useLookups()
  const { data: items = [] } = useItems()
  const [location, setLocation] = useState('')
  const [tag, setTag] = useState('')
  const bulk = useAction((body: { action: string; value?: string | number | null }) => api.post<{ count: number }>('/api/items/bulk', { ids, ...body }), {
    success: (r) => `${r.count} article(s) mis à jour`,
  })
  const run = (action: string, value?: string | number | null) => bulk.mutate({ action, value }, { onSuccess: () => action === 'delete' && onClear() })
  return (
    <div className="animate-fade-in sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-2xl">
      <span className="px-1 text-sm font-medium">{ids.length} sélectionné(s)</span>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="outline">
            Statut
          </Button>
        </MenuTrigger>
        <MenuContent align="center">
          {ITEM_STATUSES.filter((s) => s.value !== 'in_build' && s.value !== 'sold').map((s) => (
            <MenuItem key={s.value} onSelect={() => run('status', s.value)} icon={<span className={cn('block size-2 rounded-full', toneClasses[s.tone].dot)} />}>
              {s.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="outline">
            Catégorie
          </Button>
        </MenuTrigger>
        <MenuContent align="center" className="max-h-80 overflow-y-auto">
          {lk.categories.map((c) => (
            <MenuItem key={c.id} onSelect={() => run('category', c.id)}>
              {c.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          run('location', location)
          setLocation('')
        }}
      >
        <Input className="h-8 w-32" placeholder="Emplacement" value={location} onChange={(e) => setLocation(e.target.value)} />
      </form>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (tag.trim()) run('add_tag', tag.trim())
          setTag('')
        }}
      >
        <Input className="h-8 w-28" placeholder="+ Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </form>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          exportItemsCsv(
            items.filter((i) => ids.includes(i.id)),
            lk,
            'selection',
          )
        }
      >
        <Download /> CSV
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={async () => {
          if (await confirm({ title: `Supprimer ${ids.length} article(s) ?`, description: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true })) run('delete')
        }}
      >
        <Trash2 />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Désélectionner">
        <X />
      </Button>
    </div>
  )
}

function Board({ rows }: { rows: Row[] }) {
  const editors = useEditors()
  const navigate = useNavigate()
  const [over, setOver] = useState<ItemStatus | null>(null)
  const move = useAction(({ id, status }: { id: number; status: ItemStatus }) => api.patch(`/api/items/${id}`, { status }), { success: 'Statut mis à jour' })
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="grid min-w-[1100px] grid-cols-6 gap-3">
        {BOARD_COLUMNS.map((status) => {
          const def = ITEM_STATUSES.find((s) => s.value === status)!
          const list = rows.filter((r) => r.item.status === status && r.item.build_id == null && (status !== 'sold' || (r.item.sale_date ?? '') >= monthAgo))
          const total = list.reduce((s, r) => s + (status === 'sold' ? (r.profit ?? 0) : r.m.cost), 0)
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(status)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                const id = Number(e.dataTransfer.getData('text/item'))
                const row = rows.find((r) => r.item.id === id)
                if (!row || row.item.status === status) return
                if (status === 'sold') editors.openSell({ kind: 'item', item: row.item, cost: row.m.cost })
                else if (status === 'listed' && row.item.listed_price == null) editors.openList({ kind: 'item', item: row.item, cost: row.m.cost })
                else move.mutate({ id, status })
              }}
              className={cn('flex min-h-96 flex-col rounded-xl border border-border bg-surface-2/50 transition-colors', over === status && 'border-accent bg-accent-soft/60')}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className={cn('size-2 rounded-full', toneClasses[def.tone].dot)} />
                  {def.label}
                  <span className="tabular font-normal text-muted">{list.length}</span>
                </span>
                <span className="tabular text-xs text-muted" title={status === 'sold' ? 'Bénéfice (30 j)' : 'Valeur au coût'}>
                  {eur0(total)}
                </span>
              </div>
              <div className="flex-1 space-y-2 px-2 pb-2">
                {list.map((r) => (
                  <div
                    key={r.item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/item', String(r.item.id))}
                    onClick={() => navigate(`/items/${r.item.id}`)}
                    className="cursor-grab rounded-lg border border-border bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex gap-2">
                      <Thumb photo={r.item.photos[0]} className="size-8" fallback={<Package />} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-snug font-medium">{r.item.title}</p>
                        <p className="text-[11px] text-muted">{r.item.sku}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs whitespace-nowrap">
                      <span className="tabular text-muted" title={`Coût ${eur(r.m.cost)} → prix ${eur(r.price)}`}>
                        {eur0(r.m.cost)} → <span className="text-fg-2">{eur0(r.price)}</span>
                      </span>
                      <Profit value={r.profit} estimated={!r.m.sold} className="text-xs" />
                    </div>
                  </div>
                ))}
                {list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Glissez un article ici</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ItemsPage() {
  const { data: items = [], isLoading } = useItems()
  const { data: builds = [] } = useBuilds()
  const lk = useLookups()
  const editors = useEditors()
  const navigate = useNavigate()
  const actions = useItemActions()
  const [params, setParams] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const tab = (params.get('status') as Tab) ?? 'stock'
  const stale = params.get('stale') === '1'
  const view = (params.get('view') as View) ?? 'table'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [buyPlatform, setBuyPlatform] = useState('')
  const [salePlatform, setSalePlatform] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'purchase_date', dir: -1 })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [limit, setLimit] = useState(100)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const today = todayISO()
  const allRows: Row[] = useMemo(
    () =>
      items.map((item) => {
        const m = itemMetrics(item, lk.platforms, today)
        return {
          item,
          m,
          price: m.sold ? m.revenue : m.expectedPrice,
          profit: m.sold ? m.profit : m.expectedProfit,
          roi: m.sold ? m.roi : m.expectedRoi,
          days: m.sold ? m.daysToSell : m.daysHeld,
        }
      }),
    [items, lk.platforms, today],
  )

  const counts = useMemo(() => {
    const c = {} as Record<Tab, number>
    for (const t of Object.keys(TAB_FILTERS) as Tab[]) c[t] = items.filter((i) => TAB_FILTERS[t](i.status)).length
    return c
  }, [items])

  const filtered = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    const staleDays = lk.meta?.settings.stale_days ?? 60
    const rows = allRows.filter(({ item, m }) => {
      if (view === 'table' && !TAB_FILTERS[tab](item.status)) return false
      if (stale && (item.status === 'ordered' || !ACTIVE_ITEM_STATUSES.includes(item.status) || (m.daysHeld ?? 0) < staleDays)) return false
      if (buyPlatform && String(item.purchase_platform_id) !== buyPlatform) return false
      if (salePlatform && String(item.sale_platform_id) !== salePlatform) return false
      if (category && String(item.category_id) !== category) return false
      if (terms.length) {
        const hay = normalize([item.title, item.sku, item.brand, item.model, item.location, item.serial_number, item.seller, item.buyer, ...item.tags].filter(Boolean).join(' '))
        if (!terms.every((t) => hay.includes(t))) return false
      }
      return true
    })
    const val = (r: Row): string | number => {
      switch (sort.key) {
        case 'title':
          return normalize(r.item.title)
        case 'status':
          return ITEM_STATUSES.findIndex((s) => s.value === r.item.status)
        case 'purchase_date':
          return r.item.purchase_date ?? r.item.created_at
        case 'cost':
          return r.m.cost
        case 'price':
          return r.price ?? -Infinity
        case 'profit':
          return r.profit ?? -Infinity
        case 'roi':
          return r.roi ?? -Infinity
        case 'days':
          return r.days ?? -1
      }
    }
    return rows.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      return (va < vb ? -1 : va > vb ? 1 : b.item.id - a.item.id) * sort.dir
    })
  }, [allRows, tab, view, stale, buyPlatform, salePlatform, category, q, sort, lk.meta])

  useEffect(() => setSelected(new Set()), [tab, stale, buyPlatform, salePlatform, category])

  const totals = useMemo(
    () => ({
      cost: filtered.reduce((s, r) => s + r.m.cost, 0),
      price: filtered.reduce((s, r) => s + (r.price ?? 0), 0),
      profit: filtered.reduce((s, r) => s + (r.profit ?? 0), 0),
    }),
    [filtered],
  )

  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'title' ? 1 : -1 }))
  const visible = filtered.slice(0, limit)
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.item.id))
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (isLoading) return <PageLoader />
  const hasFilters = !!(q || buyPlatform || salePlatform || category || stale)

  return (
    <div>
      <PageHeader
        title="Inventaire"
        description="Tous vos articles, de l’achat à la revente."
        actions={
          <>
            <Segmented
              value={view}
              onChange={(v) => setParam('view', v === 'table' ? null : v)}
              options={[
                { value: 'table', label: <Table2 className="size-4" /> },
                { value: 'board', label: <KanbanSquare className="size-4" /> },
              ]}
            />
            <Button
              variant="outline"
              onClick={() =>
                exportItemsCsv(
                  filtered.map((r) => r.item),
                  lk,
                )
              }
            >
              <Download /> Exporter
            </Button>
            <Button variant="outline" onClick={() => editors.openLot()}>
              <Boxes /> Lot
            </Button>
            <Button variant="primary" onClick={() => editors.openItem()}>
              <Plus /> Nouvel achat
            </Button>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        {view === 'table' && (
          <Segmented
            value={tab}
            onChange={(v) => setParam('status', v === 'stock' ? null : v)}
            options={[
              { value: 'stock', label: 'En stock', count: counts.stock },
              { value: 'ordered', label: 'Commandés', count: counts.ordered },
              { value: 'testing', label: 'À tester', count: counts.testing },
              { value: 'listed', label: 'En vente', count: counts.listed },
              { value: 'in_build', label: 'Dans un PC', count: counts.in_build },
              { value: 'sold', label: 'Vendus', count: counts.sold },
              { value: 'other', label: 'Autres', count: counts.other },
              { value: 'all', label: 'Tous', count: counts.all },
            ]}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre, SKU, marque, tag, emplacement…  ( / )" className="pl-9" />
          </div>
          <Select className="w-40" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Catégorie</option>
            {lk.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select className="w-40" value={buyPlatform} onChange={(e) => setBuyPlatform(e.target.value)}>
            <option value="">Acheté sur</option>
            {lk.platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select className="w-40" value={salePlatform} onChange={(e) => setSalePlatform(e.target.value)}>
            <option value="">Vendu sur</option>
            {lk.platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {stale && (
            <Button size="sm" variant="secondary" onClick={() => setParam('stale', null)}>
              Stock dormant <X />
            </Button>
          )}
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ('')
                setBuyPlatform('')
                setSalePlatform('')
                setCategory('')
                setParam('stale', null)
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {view === 'board' ? (
        <Board rows={filtered} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package />}
            title={items.length === 0 ? 'Aucun article pour l’instant' : 'Aucun article ne correspond'}
            description={
              items.length === 0 ? 'Ajoutez votre premier achat : prix, plateforme, frais… SellPanel calcule votre marge.' : 'Modifiez les filtres ou l’onglet sélectionné.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" onClick={() => editors.openItem()}>
                  <Plus /> Nouvel achat
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* Mobile : liste compacte */}
          <Card className="divide-y divide-border md:hidden">
            {visible.map((r) => (
              <Link key={r.item.id} to={`/items/${r.item.id}`} className="flex gap-3 p-3 active:bg-surface-2">
                <Thumb photo={r.item.photos[0]} className="size-11" fallback={<Package />} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{r.item.title}</p>
                    <Profit value={r.profit} estimated={!r.m.sold} className="shrink-0 text-sm" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <ItemStatusBadge status={r.item.status} />
                    <span className="tabular">
                      {eur(r.m.cost)} → {eur(r.price)}
                    </span>
                    {r.days != null && <span>· {fmtDays(r.days)}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </Card>

          {/* Bureau : tableau complet */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-border bg-surface-2/60 text-left text-xs text-muted">
                  <tr>
                    <th className="w-10 py-2.5 pl-4">
                      <Checkbox
                        aria-label="Tout sélectionner"
                        checked={allSelected}
                        indeterminate={!allSelected && visible.some((r) => selected.has(r.item.id))}
                        onChange={(v) => setSelected(v ? new Set(visible.map((r) => r.item.id)) : new Set())}
                      />
                    </th>
                    <SortHeader label="Article" k="title" sort={sort} onSort={onSort} />
                    <SortHeader label="Statut" k="status" sort={sort} onSort={onSort} />
                    <SortHeader label="Achat" k="purchase_date" sort={sort} onSort={onSort} />
                    <SortHeader label="Coût" k="cost" sort={sort} onSort={onSort} className="text-right" />
                    <SortHeader label="Prix" k="price" sort={sort} onSort={onSort} className="text-right" />
                    <SortHeader label="Bénéfice" k="profit" sort={sort} onSort={onSort} className="text-right" />
                    <SortHeader label="ROI" k="roi" sort={sort} onSort={onSort} className="text-right" />
                    <SortHeader label="Durée" k="days" sort={sort} onSort={onSort} className="text-right" />
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((r) => {
                    const { item, m } = r
                    const build = item.build_id != null ? builds.find((b) => b.id === item.build_id) : undefined
                    const cat = lk.category(item.category_id)
                    return (
                      <tr
                        key={item.id}
                        onClick={() => navigate(`/items/${item.id}`)}
                        className={cn('group cursor-pointer transition-colors hover:bg-surface-2/60', selected.has(item.id) && 'bg-accent-soft/50')}
                      >
                        <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox aria-label="Sélectionner" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                        </td>
                        <td className="max-w-[340px] px-3 py-2">
                          <div className="flex items-center gap-3">
                            <Thumb photo={item.photos[0]} fallback={<Package />} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.title}</p>
                              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                                <span>{item.sku}</span>
                                {cat && <span>· {cat.name}</span>}
                                {item.location && (
                                  <span className="inline-flex items-center gap-0.5">
                                    · <MapPin className="size-3" />
                                    {item.location}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-1">
                            <ItemStatusBadge status={item.status} />
                            {build && (
                              <Link to={`/builds/${build.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                                <Cpu className="size-3" /> {build.ref}
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <PlatformTag platform={lk.platform(item.purchase_platform_id)} />
                          <p className="text-xs text-muted">{fmtDateShort(item.purchase_date)}</p>
                        </td>
                        <td className="tabular px-3 py-2 text-right text-fg-2">{eur(m.cost)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn('tabular', !m.sold && 'text-muted')}>{eur(r.price)}</span>
                          {m.sold && lk.platform(item.sale_platform_id) && <p className="text-xs text-muted">{lk.platform(item.sale_platform_id)?.name}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Profit value={item.build_id != null ? null : r.profit} estimated={!m.sold} />
                        </td>
                        <td className="px-3 py-2 text-right text-[13px]">
                          {item.build_id != null ? <span className="text-muted">—</span> : <Percent value={r.roi} className={cn(!m.sold && 'opacity-70')} />}
                        </td>
                        <td
                          className={cn(
                            'tabular px-3 py-2 text-right text-[13px]',
                            !m.sold && (r.days ?? 0) >= (lk.meta?.settings.stale_days ?? 60) && item.status !== 'ordered' && ACTIVE_ITEM_STATUSES.includes(item.status)
                              ? 'font-medium text-negative'
                              : 'text-muted',
                          )}
                        >
                          {fmtDays(r.days)}
                        </td>
                        <td className="pr-3" onClick={(e) => e.stopPropagation()}>
                          <Menu>
                            <MenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label="Actions" className="opacity-60 group-hover:opacity-100">
                                <MoreHorizontal />
                              </Button>
                            </MenuTrigger>
                            <MenuContent>
                              <MenuLabel>{item.sku}</MenuLabel>
                              {actions(item, m)}
                            </MenuContent>
                          </Menu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t border-border bg-surface-2/60 text-[13px]">
                  <tr>
                    <td />
                    <td className="px-3 py-2.5 font-medium" colSpan={3}>
                      {filtered.length} article{filtered.length > 1 ? 's' : ''}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">{eur(totals.cost)}</td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">{eur(totals.price)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Profit value={totals.profit} />
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          {filtered.length > limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + 200)}>
                Afficher plus ({filtered.length - limit} restants)
              </Button>
            </div>
          )}
        </>
      )}
      {selected.size > 0 && view === 'table' && <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} />}
      {selected.size === 0 && filtered.length > 0 && view === 'table' && (
        <p className="mt-3 hidden text-xs text-muted md:block">Astuce : « / » pour rechercher, « N » pour un nouvel achat, Ctrl + K pour tout trouver.</p>
      )}
    </div>
  )
}
