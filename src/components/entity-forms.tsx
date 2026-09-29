import { Plus, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { allocateLotCost, round2, todayISO } from '@shared/calc'
import { BUILD_USAGES, EXPENSE_CATEGORIES } from '@shared/constants'
import type { AllocationMethod, Build, Expense, ExpenseCategory, ItemStatus, Lot, LotDetail } from '@shared/types'
import { api } from '@/lib/api'
import { eur } from '@/lib/format'
import { useAction, useLookups, useMeta } from '@/lib/queries'
import { uid } from '@/lib/utils'
import { Profit } from './money'
import { CategorySelect, PlatformSelect } from './selects'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, NumberInput, Select, Textarea } from './ui/form'
import { Segmented } from './ui/misc'

// ─── PC monté ───────────────────────────────────────────────────────────────

export function BuildForm({ open, onOpenChange, build }: { open: boolean; onOpenChange: (o: boolean) => void; build?: Build | null }) {
  const navigate = useNavigate()
  const { data: meta } = useMeta()
  const [name, setName] = useState('')
  const [usage, setUsage] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const [warranty, setWarranty] = useState<number | null>(3)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!open) return
    setName(build?.name ?? '')
    setUsage(build?.usage ?? '')
    setTarget(build?.target_price ?? null)
    setWarranty(build?.warranty_months ?? meta?.settings.default_warranty_months ?? 3)
    setDescription(build?.description ?? '')
    setNotes(build?.notes ?? '')
  }, [open, build, meta])
  const save = useAction(
    async () => {
      const body = {
        name: name.trim(),
        usage: usage || null,
        target_price: target,
        warranty_months: Math.round(warranty ?? 0),
        description: description || null,
        notes: notes || null,
      }
      return build ? api.patch<Build>(`/api/builds/${build.id}`, body) : api.post<Build>('/api/builds', body)
    },
    { success: build ? 'PC mis à jour' : 'Fiche PC créée' },
  )
  const submit = () =>
    name.trim() &&
    save.mutate(undefined, {
      onSuccess: (b) => {
        onOpenChange(false)
        if (!build) navigate(`/builds/${b.id}`)
      },
    })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={build ? 'Modifier le PC' : 'Nouveau PC monté'}
      description={build ? build.ref : 'Créez la fiche, puis ajoutez les pièces depuis votre stock ou directement.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!name.trim()} loading={save.isPending} onClick={submit}>
            {build ? 'Enregistrer' : 'Créer la fiche'}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Nom du PC *" className="col-span-2">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Gamer 1440p RTX 3070" />
        </Field>
        <Field label="Usage" className="col-span-2">
          <Input list="usages" value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="Gaming 1080p" />
          <datalist id="usages">
            {BUILD_USAGES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label="Prix de vente visé">
          <NumberInput value={target} onValueChange={setTarget} />
        </Field>
        <Field label="Garantie offerte">
          <NumberInput value={warranty} onValueChange={setWarranty} suffix="mois" />
        </Field>
        <Field label="Description pour l’annonce" className="col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Points forts, jeux testés, état…" />
        </Field>
        <Field label="Notes privées" className="col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}

// ─── Lot / achat groupé ─────────────────────────────────────────────────────

interface Line {
  key: string
  title: string
  category_id: number | null
  target_price: number | null
  status: ItemStatus
}

const PART_OUT_PRESET: { title: string; category: string }[] = [
  { title: 'Processeur', category: 'Processeur' },
  { title: 'Carte mère', category: 'Carte mère' },
  { title: 'Mémoire RAM', category: 'Mémoire RAM' },
  { title: 'Carte graphique', category: 'Carte graphique' },
  { title: 'Stockage', category: 'Stockage' },
  { title: 'Alimentation', category: 'Alimentation' },
  { title: 'Boîtier', category: 'Boîtier' },
]

export const ALLOCATION_OPTIONS: { value: AllocationMethod; label: string; hint: string }[] = [
  { value: 'value', label: 'Au prorata de la valeur', hint: 'Chaque article porte une part du coût proportionnelle à son prix de revente visé (méthode recommandée).' },
  { value: 'equal', label: 'Parts égales', hint: 'Le coût est divisé équitablement entre les articles.' },
  { value: 'manual', label: 'Manuelle', hint: 'Vous saisissez vous-même le coût de chaque article.' },
]

const newLine = (): Line => ({ key: uid(), title: '', category_id: null, target_price: null, status: 'in_stock' })

export function LotForm({ open, onOpenChange, lot }: { open: boolean; onOpenChange: (o: boolean) => void; lot?: LotDetail | Lot | null }) {
  const navigate = useNavigate()
  const { categories } = useLookups()
  const [name, setName] = useState('')
  const [platformId, setPlatformId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [price, setPrice] = useState<number | null>(null)
  const [shipping, setShipping] = useState<number | null>(0)
  const [fees, setFees] = useState<number | null>(0)
  const [seller, setSeller] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [allocation, setAllocation] = useState<AllocationMethod>('value')
  const [lines, setLines] = useState<Line[]>([newLine(), newLine()])

  useEffect(() => {
    if (!open) return
    setName(lot?.name ?? '')
    setPlatformId(lot?.platform_id ?? null)
    setDate(lot?.purchase_date ?? todayISO())
    setPrice(lot?.price ?? null)
    setShipping(lot?.shipping ?? 0)
    setFees(lot?.fees ?? 0)
    setSeller(lot?.seller ?? '')
    setUrl(lot?.url ?? '')
    setNotes(lot?.notes ?? '')
    setAllocation(lot?.allocation ?? 'value')
    setLines([newLine(), newLine()])
  }, [open, lot])

  const total = round2((price ?? 0) + (shipping ?? 0) + (fees ?? 0))
  const validLines = lines.filter((l) => l.title.trim())
  const alloc = useMemo(
    () =>
      allocateLotCost(
        total,
        allocation === 'manual' ? 'equal' : allocation,
        validLines.map((l, i) => ({ id: i, weight: l.target_price, manual: null })),
      ),
    [total, allocation, validLines],
  )
  const expectedTotal = validLines.reduce((s, l) => s + (l.target_price ?? 0), 0)

  const save = useAction(
    async () => {
      const body = {
        name: name.trim(),
        platform_id: platformId,
        purchase_date: date || null,
        price: price ?? 0,
        shipping: shipping ?? 0,
        fees: fees ?? 0,
        seller: seller || null,
        url: url || null,
        notes: notes || null,
        allocation,
      }
      if (lot) return api.patch<LotDetail>(`/api/lots/${lot.id}`, body)
      return api.post<LotDetail>('/api/lots', {
        ...body,
        items: validLines.map((l) => ({ title: l.title.trim(), category_id: l.category_id, target_price: l.target_price, status: l.status })),
      })
    },
    { success: lot ? 'Lot mis à jour' : 'Lot enregistré' },
  )
  const submit = () =>
    name.trim() &&
    save.mutate(undefined, {
      onSuccess: (l) => {
        onOpenChange(false)
        if (!lot) navigate(`/lots/${l.id}`)
      },
    })

  const updateLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size={lot ? 'md' : 'xl'}
      title={lot ? 'Modifier le lot' : 'Nouvel achat groupé'}
      description={lot ? lot.name : 'Un lot, un PC complet à démonter… Le coût total est réparti automatiquement entre les articles.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!name.trim()} loading={save.isPending} onClick={submit}>
            {lot ? 'Enregistrer' : `Créer le lot${validLines.length ? ` (${validLines.length} articles)` : ''}`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Nom du lot *" className="col-span-2">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="PC gamer complet à démonter" />
        </Field>
        <Field label="Acheté sur">
          <PlatformSelect value={platformId} onChange={setPlatformId} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Prix payé">
          <NumberInput value={price} onValueChange={setPrice} />
        </Field>
        <Field label="Frais de port">
          <NumberInput value={shipping} onValueChange={setShipping} />
        </Field>
        <Field label="Frais / protection">
          <NumberInput value={fees} onValueChange={setFees} />
        </Field>
        <Field label="Coût total">
          <div className="tabular flex h-9 items-center rounded-lg bg-surface-2 px-3 text-sm font-semibold">{eur(total)}</div>
        </Field>
        <Field label="Vendeur" className="col-span-2">
          <Input value={seller} onChange={(e) => setSeller(e.target.value)} />
        </Field>
        <Field label="Lien de l’annonce" className="col-span-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Répartition du coût" className="col-span-2 sm:col-span-4" hint={ALLOCATION_OPTIONS.find((o) => o.value === allocation)?.hint}>
          <Segmented value={allocation} onChange={setAllocation} options={ALLOCATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Field>
        {lot && (
          <Field label="Notes" className="col-span-2 sm:col-span-4">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        )}
      </div>

      {!lot && (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Articles du lot</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLines(PART_OUT_PRESET.map((p) => ({ ...newLine(), title: p.title, category_id: categories.find((c) => c.name === p.category)?.id ?? null })))}
            >
              <Wand2 /> Pièces d’un PC complet
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium">Catégorie</th>
                  <th className="w-32 px-3 py-2 font-medium">Revente visée</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Coût réparti</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Bénéfice</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((l) => {
                  const idx = validLines.indexOf(l)
                  const cost = idx >= 0 ? (alloc.get(idx) ?? 0) : null
                  return (
                    <tr key={l.key}>
                      <td className="px-2 py-1.5">
                        <Input value={l.title} onChange={(e) => updateLine(l.key, { title: e.target.value })} placeholder="ex. GTX 1080 8 Go" />
                      </td>
                      <td className="px-2 py-1.5">
                        <CategorySelect value={l.category_id} onChange={(v) => updateLine(l.key, { category_id: v })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberInput value={l.target_price} onValueChange={(v) => updateLine(l.key, { target_price: v })} />
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-fg-2">{cost != null ? eur(cost) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">
                        {cost != null && l.target_price != null ? <Profit value={round2(l.target_price - cost)} estimated /> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Retirer la ligne">
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-border bg-surface-2/60 text-[13px]">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    <Button size="xs" variant="ghost" onClick={() => setLines((ls) => [...ls, newLine()])}>
                      <Plus /> Ajouter une ligne
                    </Button>
                  </td>
                  <td className="tabular px-3 py-2 font-medium">{eur(expectedTotal)}</td>
                  <td className="tabular px-3 py-2 text-right font-medium">{eur(total)}</td>
                  <td className="px-3 py-2 text-right">
                    <Profit value={round2(expectedTotal - total)} estimated />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {allocation === 'manual' && (
            <p className="mt-2 text-xs text-muted">En mode manuel, l’aperçu répartit à parts égales ; ajustez ensuite le coût de chaque article depuis sa fiche.</p>
          )}
        </div>
      )}
    </Dialog>
  )
}

// ─── Dépense ────────────────────────────────────────────────────────────────

export function ExpenseForm({ open, onOpenChange, expense }: { open: boolean; onOpenChange: (o: boolean) => void; expense?: Expense | null }) {
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState<ExpenseCategory>('emballage')
  const [amount, setAmount] = useState<number | null>(null)
  const [platformId, setPlatformId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  useEffect(() => {
    if (!open) return
    setDate(expense?.date ?? todayISO())
    setCategory(expense?.category ?? 'emballage')
    setAmount(expense?.amount ?? null)
    setPlatformId(expense?.platform_id ?? null)
    setDescription(expense?.description ?? '')
  }, [open, expense])
  const save = useAction(
    async () => {
      const body = { date, category, amount: amount ?? 0, platform_id: platformId, description: description || null }
      return expense ? api.patch<Expense>(`/api/expenses/${expense.id}`, body) : api.post<Expense>('/api/expenses', body)
    },
    { success: expense ? 'Dépense modifiée' : 'Dépense ajoutée' },
  )
  const submit = () => amount != null && save.mutate(undefined, { onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? 'Modifier la dépense' : 'Nouvelle dépense'}
      description="Frais généraux non liés à un article : emballages, carburant, outillage, boosts…"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" disabled={amount == null} loading={save.isPending} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Montant">
          <NumberInput autoFocus value={amount} onValueChange={setAmount} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Catégorie" className="col-span-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plateforme liée" className="col-span-2" hint="Optionnel (ex. boost Vinted)">
          <PlatformSelect value={platformId} onChange={setPlatformId} placeholder="— Aucune —" />
        </Field>
        <Field label="Description" className="col-span-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cartons + papier bulle" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  )
}
