import { useEffect, useState } from 'react'
import { platformFee, round2, todayISO } from '@shared/calc'
import type { Build, Item } from '@shared/types'
import { api } from '@/lib/api'
import { eur, pct } from '@/lib/format'
import { useAction, useLookups } from '@/lib/queries'
import { Profit } from './money'
import { PlatformSelect } from './selects'
import { StatLine } from './stats'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, NumberInput } from './ui/form'

export type SaleTarget = { kind: 'item'; item: Item; cost: number } | { kind: 'build'; build: Build; cost: number }

export function SellDialog({ target, onOpenChange }: { target: SaleTarget | null; onOpenChange: (o: boolean) => void }) {
  const { platform } = useLookups()
  const src = target?.kind === 'item' ? target.item : target?.build
  const [price, setPrice] = useState<number | null>(null)
  const [platformId, setPlatformId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [fees, setFees] = useState(0)
  const [feesTouched, setFeesTouched] = useState(false)
  const [shipping, setShipping] = useState(0)
  const [buyer, setBuyer] = useState('')
  const [tracking, setTracking] = useState('')

  useEffect(() => {
    if (!src) return
    setPrice(src.sale_price ?? src.listed_price ?? src.target_price ?? null)
    setPlatformId(src.sale_platform_id)
    setDate(src.sale_date ?? todayISO())
    setFees(src.sale_fees ?? 0)
    setFeesTouched(false)
    setShipping(src.sale_shipping ?? 0)
    setBuyer(src.buyer ?? '')
    setTracking(target?.kind === 'item' ? (target.item.tracking_number ?? '') : '')
  }, [src, target?.kind])

  const p = platform(platformId)
  useEffect(() => {
    if (!feesTouched && p) setFees(platformFee(p, price ?? 0, 'sale'))
  }, [p, price, feesTouched])

  const net = round2((price ?? 0) - fees - shipping)
  const profit = round2(net - (target?.cost ?? 0))

  const save = useAction(
    async () => {
      const body = { status: 'sold', sale_price: price, sale_platform_id: platformId, sale_date: date, sale_fees: fees, sale_shipping: shipping, buyer: buyer || null }
      if (target?.kind === 'item') return api.patch(`/api/items/${target.item.id}`, { ...body, tracking_number: tracking || null })
      if (target?.kind === 'build') return api.patch(`/api/builds/${target.build.id}`, body)
    },
    { success: 'Vente enregistrée 🎉' },
  )

  return (
    <Dialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="Enregistrer la vente"
      description={target?.kind === 'item' ? target.item.title : target?.build.name}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="success" disabled={price == null} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>
            Marquer comme vendu
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix de vente">
          <NumberInput autoFocus value={price} onValueChange={setPrice} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Vendu sur" className="col-span-2">
          <PlatformSelect value={platformId} onChange={setPlatformId} />
        </Field>
        <Field
          label="Frais plateforme"
          hint={p && (p.sale_fee_percent > 0 || p.sale_fee_fixed > 0) ? `${p.sale_fee_percent} % + ${eur(p.sale_fee_fixed)}` : 'Aucun frais vendeur configuré'}
        >
          <NumberInput
            value={fees}
            onValueChange={(v) => {
              setFeesTouched(true)
              setFees(v ?? 0)
            }}
          />
        </Field>
        <Field label="Envoi à ma charge">
          <NumberInput value={shipping} onValueChange={(v) => setShipping(v ?? 0)} />
        </Field>
        <Field label="Acheteur" className={target?.kind === 'item' ? '' : 'col-span-2'}>
          <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Optionnel" />
        </Field>
        {target?.kind === 'item' && (
          <Field label="N° de suivi">
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Optionnel" />
          </Field>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-border bg-surface-2/60 px-4 py-2">
        <StatLine label="Net encaissé" value={eur(net)} />
        <StatLine label="Coût de revient" value={eur(target?.cost)} muted />
        <StatLine label="Bénéfice" value={<Profit value={profit} />} strong className="border-t border-border" />
        <StatLine label="Marge" value={price ? pct(profit / price) : '—'} muted />
      </div>
    </Dialog>
  )
}

export type ListTarget = { kind: 'item'; item: Item; cost: number } | { kind: 'build'; build: Build; cost: number }

export function ListDialog({ target, onOpenChange }: { target: ListTarget | null; onOpenChange: (o: boolean) => void }) {
  const { platform } = useLookups()
  const src = target?.kind === 'item' ? target.item : target?.build
  const [price, setPrice] = useState<number | null>(null)
  const [platformId, setPlatformId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  useEffect(() => {
    if (!src) return
    setPrice(src.listed_price ?? src.target_price ?? null)
    setPlatformId(src.sale_platform_id)
    setDate(src.listed_date ?? todayISO())
  }, [src])
  const fee = platformFee(platform(platformId), price ?? 0, 'sale')
  const profit = price != null ? round2(price - fee - (target?.cost ?? 0)) : null
  const save = useAction(
    async () => {
      const body = { status: 'listed', listed_price: price, sale_platform_id: platformId, listed_date: date }
      if (target?.kind === 'item') return api.patch(`/api/items/${target.item.id}`, body)
      if (target?.kind === 'build') return api.patch(`/api/builds/${target.build.id}`, body)
    },
    { success: 'Annonce enregistrée' },
  )
  return (
    <Dialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="Mettre en vente"
      description={target?.kind === 'item' ? target.item.title : target?.build.name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" disabled={price == null} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>
            Mettre en vente
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix affiché">
          <NumberInput autoFocus value={price} onValueChange={setPrice} />
        </Field>
        <Field label="Depuis le">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Plateforme" className="col-span-2">
          <PlatformSelect value={platformId} onChange={setPlatformId} />
        </Field>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-surface-2/60 px-4 py-2">
        <StatLine label="Coût de revient" value={eur(target?.cost)} muted />
        <StatLine label="Bénéfice si vendu à ce prix" value={<Profit value={profit} />} strong />
        {target && target.cost > 0 && price != null && <StatLine label="ROI" value={pct((profit ?? 0) / target.cost)} muted />}
      </div>
    </Dialog>
  )
}
