import { Calculator, Info } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { itemMetrics, platformFee, todayISO } from '@shared/calc'
import { CONDITIONS, ITEM_STATUSES } from '@shared/constants'
import type { Item } from '@shared/types'
import { api } from '@/lib/api'
import { eur, pct } from '@/lib/format'
import { useAction, useItems, useLookups, useLots } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { MarketLinks } from './market-links'
import { Profit } from './money'
import { PhotoUploader } from './photos'
import { CategorySelect, PlatformSelect, SpecFields } from './selects'
import { TagInput } from './tag-input'
import { Button } from './ui/button'
import { Sheet } from './ui/dialog'
import { Field, Input, NumberInput, Select, Textarea } from './ui/form'

export type ItemDraft = Partial<Item>

const EMPTY: ItemDraft = {
  title: '',
  category_id: null,
  brand: null,
  model: null,
  condition: 'tres_bon',
  status: 'in_stock',
  purchase_platform_id: null,
  purchase_date: todayISO(),
  purchase_price: 0,
  purchase_shipping: 0,
  purchase_fees: 0,
  extra_costs: 0,
  seller: null,
  purchase_url: null,
  order_ref: null,
  received_date: null,
  target_price: null,
  listed_price: null,
  listed_date: null,
  sale_platform_id: null,
  sale_price: null,
  sale_date: null,
  sale_fees: 0,
  sale_shipping: 0,
  buyer: null,
  sale_url: null,
  tracking_number: null,
  shipped_date: null,
  location: null,
  serial_number: null,
  warranty_until: null,
  tags: [],
  specs: {},
  photos: [],
  notes: null,
}

function Section({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-border px-5 py-5 last:border-b-0">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function ItemForm({ open, onOpenChange, item, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; item?: Item | null; defaults?: ItemDraft }) {
  const navigate = useNavigate()
  const { platforms, platform, category } = useLookups()
  const { data: items = [] } = useItems()
  const { data: lots = [] } = useLots()
  const [draft, setDraft] = useState<ItemDraft>(EMPTY)
  const [touched, setTouched] = useState({ buyFees: false, saleFees: false })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(item ? { ...item } : { ...EMPTY, ...defaults })
    setTouched({ buyFees: !!item, saleFees: !!item })
    setError(null)
  }, [open, item, defaults])

  const set = <K extends keyof Item>(key: K, value: Item[K] | null) => setDraft((d) => ({ ...d, [key]: value }))

  // Frais de protection acheteur : proposés automatiquement pour un achat avec envoi.
  const buyPlatform = platform(draft.purchase_platform_id)
  useEffect(() => {
    if (touched.buyFees || !buyPlatform) return
    const fee = (draft.purchase_shipping ?? 0) > 0 ? platformFee(buyPlatform, draft.purchase_price ?? 0, 'buyer') : 0
    setDraft((d) => (d.purchase_fees === fee ? d : { ...d, purchase_fees: fee }))
  }, [buyPlatform, draft.purchase_price, draft.purchase_shipping, touched.buyFees])

  const salePlatform = platform(draft.sale_platform_id)
  useEffect(() => {
    if (touched.saleFees || !salePlatform || draft.sale_price == null) return
    const fee = platformFee(salePlatform, draft.sale_price, 'sale')
    setDraft((d) => (d.sale_fees === fee ? d : { ...d, sale_fees: fee }))
  }, [salePlatform, draft.sale_price, touched.saleFees])

  const cat = category(draft.category_id)
  const inBuild = draft.status === 'in_build' || draft.build_id != null
  const lot = lots.find((l) => l.id === draft.lot_id)
  const showSale = draft.status === 'sold' || draft.status === 'returned' || draft.sale_price != null

  const locations = useMemo(() => [...new Set(items.map((i) => i.location).filter((l): l is string => !!l))].sort(), [items])
  const tagSuggestions = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items])

  const metrics = useMemo(() => {
    const full = { ...EMPTY, ...draft, id: 0, sku: '', created_at: new Date().toISOString(), updated_at: '' } as Item
    return itemMetrics(full, platforms)
  }, [draft, platforms])

  const save = useAction(
    async (d: ItemDraft) => {
      if (item) {
        const patch: ItemDraft = {}
        for (const key of Object.keys(d) as (keyof Item)[]) {
          if (['id', 'sku', 'created_at', 'updated_at'].includes(key)) continue
          if (JSON.stringify(d[key]) !== JSON.stringify(item[key])) (patch as Record<string, unknown>)[key] = d[key]
        }
        return api.patch<Item>(`/api/items/${item.id}`, patch)
      }
      return api.post<Item>('/api/items', d)
    },
    { success: item ? 'Article enregistré' : 'Article ajouté', silent: true },
  )

  const submit = () => {
    if (!draft.title?.trim()) {
      setError('Le titre est obligatoire.')
      document.getElementById('item-title')?.focus()
      return
    }
    setError(null)
    const { id: _id, sku: _sku, created_at: _c, updated_at: _u, ...body } = draft as Item
    save.mutate(body, {
      onSuccess: (saved) => {
        onOpenChange(false)
        if (!item) navigate(`/items/${saved.id}`)
      },
      onError: (e) => setError(e.message),
    })
  }

  const statuses = ITEM_STATUSES.filter((s) => s.value !== 'in_build' || inBuild)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `Modifier ${item.sku}` : 'Nouvel achat'}
      description={item ? item.title : 'Enregistrez un article acheté : où, combien, et à combien vous comptez le revendre.'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="text-muted">
              Coût de revient <strong className="tabular ml-1 text-fg">{eur(metrics.cost)}</strong>
            </span>
            <span className="text-muted">
              {metrics.sold ? 'Bénéfice' : 'Bénéfice estimé'} <Profit className="ml-1" value={metrics.sold ? metrics.profit : metrics.expectedProfit} />
            </span>
            {(metrics.sold ? metrics.roi : metrics.expectedRoi) != null && (
              <span className="text-muted">
                ROI <strong className="tabular ml-1 text-fg">{pct(metrics.sold ? metrics.roi : metrics.expectedRoi)}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={submit} loading={save.isPending}>
              {item ? 'Enregistrer' : 'Ajouter l’article'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {error && <div className="mx-5 mt-4 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}

        <Section title="Article">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre *" className="col-span-2" htmlFor="item-title">
              <Input id="item-title" autoFocus={!item} value={draft.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="ex. MSI RTX 3070 Gaming X Trio" />
            </Field>
            {draft.title && draft.title.length > 3 && (
              <div className="col-span-2 -mt-1">
                <p className="mb-1.5 text-xs text-muted">Vérifier la cote :</p>
                <MarketLinks query={draft.title} platforms={platforms} />
              </div>
            )}
            <Field label="Catégorie" htmlFor="item-category">
              <CategorySelect id="item-category" value={draft.category_id} onChange={(v) => set('category_id', v)} />
            </Field>
            <Field label="État">
              <Select value={draft.condition ?? ''} onChange={(e) => set('condition', (e.target.value || null) as Item['condition'])}>
                <option value="">—</option>
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Marque">
              <Input value={draft.brand ?? ''} onChange={(e) => set('brand', e.target.value)} placeholder="MSI, AMD, Corsair…" />
            </Field>
            <Field label="Modèle">
              <Input value={draft.model ?? ''} onChange={(e) => set('model', e.target.value)} placeholder="RTX 3070" />
            </Field>
            <Field label="Statut" hint={inBuild ? 'Géré depuis la fiche du PC.' : ITEM_STATUSES.find((s) => s.value === draft.status)?.hint}>
              <Select value={draft.status} disabled={inBuild} onChange={(e) => set('status', e.target.value as Item['status'])}>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Emplacement" hint="Où est rangé l’article">
              <Input list="locations" value={draft.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="Étagère A2" />
              <datalist id="locations">
                {locations.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <Field label="Tags" className="col-span-2">
              <TagInput value={draft.tags ?? []} onChange={(v) => set('tags', v)} suggestions={tagSuggestions} />
            </Field>
          </div>
        </Section>

        <Section title="Achat" description="Tout ce qui compose votre coût de revient.">
          {lot && (
            <div className="mb-4 flex gap-2 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-[13px] text-fg-2">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                Issu du lot « {lot.name} ».{' '}
                {lot.allocation === 'manual' ? 'Répartition manuelle : saisissez le coût de cet article.' : 'Le prix d’achat est calculé automatiquement à partir du coût du lot.'}
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Acheté sur" className="col-span-2" htmlFor="purchase-platform">
              <PlatformSelect id="purchase-platform" value={draft.purchase_platform_id} onChange={(v) => set('purchase_platform_id', v)} />
            </Field>
            <Field label="Date d’achat">
              <Input type="date" value={draft.purchase_date ?? ''} onChange={(e) => set('purchase_date', e.target.value || null)} />
            </Field>
            <Field label="Reçu le">
              <Input type="date" value={draft.received_date ?? ''} onChange={(e) => set('received_date', e.target.value || null)} />
            </Field>
            <Field label="Prix payé">
              <NumberInput value={draft.purchase_price} disabled={!!lot && lot.allocation !== 'manual'} onValueChange={(v) => set('purchase_price', v ?? 0)} />
            </Field>
            <Field label="Frais de port">
              <NumberInput value={draft.purchase_shipping} disabled={!!lot && lot.allocation !== 'manual'} onValueChange={(v) => set('purchase_shipping', v ?? 0)} />
            </Field>
            <Field
              label="Protection acheteur"
              action={
                buyPlatform && (buyPlatform.buyer_fee_percent > 0 || buyPlatform.buyer_fee_fixed > 0) ? (
                  <button
                    type="button"
                    title={`${buyPlatform.name} : ${buyPlatform.buyer_fee_percent} % + ${eur(buyPlatform.buyer_fee_fixed)}`}
                    onClick={() => {
                      setTouched((t) => ({ ...t, buyFees: true }))
                      set('purchase_fees', platformFee(buyPlatform, draft.purchase_price ?? 0, 'buyer'))
                    }}
                    className="text-muted hover:text-accent"
                  >
                    <Calculator className="size-3.5" />
                  </button>
                ) : undefined
              }
            >
              <NumberInput
                value={draft.purchase_fees}
                disabled={!!lot && lot.allocation !== 'manual'}
                onValueChange={(v) => {
                  setTouched((t) => ({ ...t, buyFees: true }))
                  set('purchase_fees', v ?? 0)
                }}
              />
            </Field>
            <Field label="Réparations / pièces" hint="Frais annexes">
              <NumberInput value={draft.extra_costs} onValueChange={(v) => set('extra_costs', v ?? 0)} />
            </Field>
            <Field label="Vendeur" className="col-span-2">
              <Input value={draft.seller ?? ''} onChange={(e) => set('seller', e.target.value)} placeholder="Pseudo ou nom" />
            </Field>
            <Field label="Réf. commande" className="col-span-2">
              <Input value={draft.order_ref ?? ''} onChange={(e) => set('order_ref', e.target.value)} placeholder="Numéro de transaction" />
            </Field>
            <Field label="Lien de l’annonce" className="col-span-2 sm:col-span-4">
              <Input type="url" value={draft.purchase_url ?? ''} onChange={(e) => set('purchase_url', e.target.value)} placeholder="https://www.leboncoin.fr/…" />
            </Field>
          </div>
        </Section>

        <Section title="Revente" description="Prix visé et annonce en cours. Les infos de vente apparaissent quand l’article est vendu.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Prix de revente visé" hint="Estimation de la cote">
              <NumberInput value={draft.target_price} onValueChange={(v) => set('target_price', v)} />
            </Field>
            <Field label="Prix affiché">
              <NumberInput value={draft.listed_price} onValueChange={(v) => set('listed_price', v)} />
            </Field>
            <Field label="Vendu / mis en vente sur" htmlFor="sale-platform">
              <PlatformSelect id="sale-platform" value={draft.sale_platform_id} onChange={(v) => set('sale_platform_id', v)} />
            </Field>
            <Field label="Mis en vente le">
              <Input type="date" value={draft.listed_date ?? ''} onChange={(e) => set('listed_date', e.target.value || null)} />
            </Field>
          </div>
          {showSale && (
            <div className={cn('mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2/60 p-3 sm:grid-cols-4')}>
              <Field label="Prix de vente">
                <NumberInput value={draft.sale_price} onValueChange={(v) => set('sale_price', v)} />
              </Field>
              <Field label="Date de vente">
                <Input type="date" value={draft.sale_date ?? ''} onChange={(e) => set('sale_date', e.target.value || null)} />
              </Field>
              <Field label="Frais plateforme">
                <NumberInput
                  value={draft.sale_fees}
                  onValueChange={(v) => {
                    setTouched((t) => ({ ...t, saleFees: true }))
                    set('sale_fees', v ?? 0)
                  }}
                />
              </Field>
              <Field label="Envoi à ma charge">
                <NumberInput value={draft.sale_shipping} onValueChange={(v) => set('sale_shipping', v ?? 0)} />
              </Field>
              <Field label="Acheteur" className="col-span-2">
                <Input value={draft.buyer ?? ''} onChange={(e) => set('buyer', e.target.value)} />
              </Field>
              <Field label="N° de suivi">
                <Input value={draft.tracking_number ?? ''} onChange={(e) => set('tracking_number', e.target.value)} />
              </Field>
              <Field label="Expédié le">
                <Input type="date" value={draft.shipped_date ?? ''} onChange={(e) => set('shipped_date', e.target.value || null)} />
              </Field>
            </div>
          )}
        </Section>

        <Section title="Caractéristiques" description={cat?.slot ? 'Utilisées pour les contrôles de compatibilité des PC et les annonces.' : undefined}>
          {cat?.slot && (
            <div className="mb-4">
              <SpecFields slot={cat.slot} value={draft.specs ?? {}} onChange={(v) => set('specs', v)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="N° de série">
              <Input value={draft.serial_number ?? ''} onChange={(e) => set('serial_number', e.target.value)} />
            </Field>
            <Field label="Garantie jusqu’au">
              <Input type="date" value={draft.warranty_until ?? ''} onChange={(e) => set('warranty_until', e.target.value || null)} />
            </Field>
          </div>
        </Section>

        <Section title="Photos" description="Glissez-déposez vos photos. Elles sont redimensionnées automatiquement.">
          <PhotoUploader value={draft.photos ?? []} onChange={(v) => set('photos', v)} />
        </Section>

        <Section title="Notes privées">
          <Textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Défauts, historique, négociation…" rows={3} />
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
