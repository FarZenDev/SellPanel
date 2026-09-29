import { Check, Package, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { itemCost, platformFee, todayISO } from '@shared/calc'
import { CONDITIONS, PC_SLOTS } from '@shared/constants'
import { specSummary } from '@shared/listing'
import type { Condition, Item, PcSlot, Specs } from '@shared/types'
import { api } from '@/lib/api'
import { eur, fmtDateShort } from '@/lib/format'
import { useAction, useItems, useLookups } from '@/lib/queries'
import { cn, normalize } from '@/lib/utils'
import { ItemStatusBadge, PlatformTag } from './badges'
import { MarketLinks } from './market-links'
import { CategorySelect, PlatformSelect, SpecFields } from './selects'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, NumberInput, Select } from './ui/form'
import { Segmented } from './ui/misc'

const AVAILABLE = new Set(['ordered', 'in_stock', 'testing', 'listed', 'reserved'])

export function ComponentPicker({ buildId, open, onOpenChange, slot: initialSlot }: { buildId: number; open: boolean; onOpenChange: (o: boolean) => void; slot?: PcSlot | null }) {
  const { data: items = [] } = useItems()
  const lk = useLookups()
  const [mode, setMode] = useState<'stock' | 'new'>('stock')
  const [slot, setSlot] = useState<PcSlot | 'all'>('all')
  const [q, setQ] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())

  // Formulaire « nouvelle pièce »
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [platformId, setPlatformId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [price, setPrice] = useState<number | null>(null)
  const [shipping, setShipping] = useState<number | null>(0)
  const [fees, setFees] = useState<number | null>(0)
  const [target, setTarget] = useState<number | null>(null)
  const [condition, setCondition] = useState<Condition>('tres_bon')
  const [specs, setSpecs] = useState<Specs>({})

  useEffect(() => {
    if (!open) return
    setSlot(initialSlot ?? 'all')
    setMode('stock')
    setQ('')
    setAdded(new Set())
    setTitle('')
    setPrice(null)
    setShipping(0)
    setFees(0)
    setTarget(null)
    setSpecs({})
    setCategoryId(initialSlot ? (lk.categories.find((c) => c.slot === initialSlot)?.id ?? null) : null)
  }, [open, initialSlot, lk.categories])

  const newSlot = lk.category(categoryId)?.slot ?? null

  const candidates = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean)
    return items
      .filter((i) => i.build_id == null && AVAILABLE.has(i.status))
      .filter((i) => slot === 'all' || lk.category(i.category_id)?.slot === slot)
      .filter((i) => {
        if (!terms.length) return true
        const hay = normalize(`${i.title} ${i.sku} ${i.brand ?? ''} ${i.model ?? ''}`)
        return terms.every((t) => hay.includes(t))
      })
      .sort((a, b) => {
        const sa = lk.category(a.category_id)?.slot ? 0 : 1
        const sb = lk.category(b.category_id)?.slot ? 0 : 1
        return sa - sb || b.id - a.id
      })
  }, [items, slot, q, lk])

  const attach = useAction((itemId: number) => api.post(`/api/builds/${buildId}/components`, { item_id: itemId }), { success: 'Pièce ajoutée au PC' })
  const create = useAction(
    () =>
      api.post<Item>('/api/items', {
        title: title.trim(),
        category_id: categoryId,
        condition,
        purchase_platform_id: platformId,
        purchase_date: date || null,
        purchase_price: price ?? 0,
        purchase_shipping: shipping ?? 0,
        purchase_fees: fees ?? 0,
        target_price: target,
        specs,
        build_id: buildId,
      }),
    { success: 'Pièce créée et ajoutée au PC' },
  )

  const p = lk.platform(platformId)
  useEffect(() => {
    if (p && (shipping ?? 0) > 0) setFees(platformFee(p, price ?? 0, 'buyer'))
  }, [p, price, shipping])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Ajouter une pièce"
      description="Depuis votre stock (coût déjà connu) ou en saisissant directement une pièce achetée pour ce PC."
      footer={
        mode === 'new' ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim()}
              loading={create.isPending}
              onClick={() =>
                create.mutate(undefined, {
                  onSuccess: () => {
                    setTitle('')
                    setPrice(null)
                    setTarget(null)
                    setSpecs({})
                  },
                })
              }
            >
              <Plus /> Créer et ajouter
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Terminé {added.size > 0 && `(${added.size} ajoutée${added.size > 1 ? 's' : ''})`}
          </Button>
        )
      }
    >
      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'stock', label: 'Depuis le stock', count: items.filter((i) => i.build_id == null && AVAILABLE.has(i.status)).length },
          { value: 'new', label: 'Nouvelle pièce' },
        ]}
      />

      {mode === 'stock' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[{ value: 'all' as const, label: 'Tout' }, ...PC_SLOTS.map((s) => ({ value: s.value, label: s.label }))].map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSlot(s.value)}
                className={cn(
                  'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
                  slot === s.value ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans le stock…" className="pl-9" />
          </div>
          <div className="max-h-[46vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {candidates.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted">
                Aucune pièce disponible{slot !== 'all' ? ' dans cette catégorie' : ''}.{' '}
                <button type="button" className="text-accent hover:underline" onClick={() => setMode('new')}>
                  Saisir une nouvelle pièce
                </button>
              </div>
            )}
            {candidates.map((i) => {
              const cat = lk.category(i.category_id)
              const sum = cat?.slot ? specSummary(cat.slot, i.specs) : ''
              const isAdded = added.has(i.id)
              return (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span>{i.sku}</span>
                      {cat && <span>· {cat.name}</span>}
                      {sum && <span>· {sum}</span>}
                      <PlatformTag platform={lk.platform(i.purchase_platform_id)} muted className="text-xs" />
                      <span>{fmtDateShort(i.purchase_date)}</span>
                    </p>
                  </div>
                  <ItemStatusBadge status={i.status} className="hidden sm:inline-flex" />
                  <span className="tabular w-20 text-right text-sm">{eur(itemCost(i))}</span>
                  <Button
                    size="sm"
                    variant={isAdded ? 'secondary' : 'outline'}
                    disabled={isAdded}
                    loading={attach.isPending && attach.variables === i.id}
                    onClick={() => attach.mutate(i.id, { onSuccess: () => setAdded((s) => new Set(s).add(i.id)) })}
                  >
                    {isAdded ? <Check /> : <Plus />}
                    {isAdded ? 'Ajoutée' : 'Ajouter'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Désignation *" className="col-span-2 sm:col-span-4">
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Corsair RM650x 650 W" />
            </Field>
            {title.length > 3 && (
              <div className="col-span-2 sm:col-span-4">
                <MarketLinks query={title} platforms={lk.platforms} />
              </div>
            )}
            <Field label="Catégorie" className="col-span-2">
              <CategorySelect value={categoryId} onChange={setCategoryId} />
            </Field>
            <Field label="État" className="col-span-2">
              <Select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Acheté sur" className="col-span-2">
              <PlatformSelect value={platformId} onChange={setPlatformId} />
            </Field>
            <Field label="Date" className="col-span-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Prix payé">
              <NumberInput value={price} onValueChange={setPrice} />
            </Field>
            <Field label="Port">
              <NumberInput value={shipping} onValueChange={setShipping} />
            </Field>
            <Field label="Protection">
              <NumberInput value={fees} onValueChange={setFees} />
            </Field>
            <Field label="Valeur en pièce" hint="Revente seule">
              <NumberInput value={target} onValueChange={setTarget} />
            </Field>
          </div>
          {newSlot && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-3 text-xs font-medium text-muted">Caractéristiques (pour les contrôles de compatibilité)</p>
              <SpecFields slot={newSlot} value={specs} onChange={setSpecs} />
            </div>
          )}
          {!newSlot && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Package className="size-4" /> Choisissez une catégorie « composant PC » pour renseigner ses caractéristiques.
            </p>
          )}
        </form>
      )}
    </Dialog>
  )
}
