import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Cpu,
  Info,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  ShoppingCart,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { buildMetrics, daysBetween, itemCost, todayISO } from '@shared/calc'
import { checkBuild, slotOf, type CheckLevel } from '@shared/compat'
import { BENCHMARK_PRESETS, BUILD_STATUSES, PC_SLOTS } from '@shared/constants'
import { buildListing, buildListingTitle, DEFAULT_LISTING_OPTIONS, specSummary, type ListingOptions } from '@shared/listing'
import type { Benchmark, Build, BuildDetail, BuildStatus, ChecklistEntry, Item, PcSlot } from '@shared/types'
import { BuildStatusBadge, PlatformTag } from '@/components/badges'
import { ComponentPicker } from '@/components/component-picker'
import { useEditors } from '@/components/editors'
import { Profit } from '@/components/money'
import { PhotoUploader } from '@/components/photos'
import { KpiCard, StatLine } from '@/components/stats'
import { Timeline } from '@/components/timeline'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog'
import { Checkbox, Input, NumberInput, Switch, Textarea } from '@/components/ui/form'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, PageLoader, Progress, Segmented, Tip } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { eur, eur0, fmtDate, fmtDateShort, fmtDays, pct } from '@/lib/format'
import { useAction, useBuild, useLookups } from '@/lib/queries'
import { cn, copyText, uid } from '@/lib/utils'

const PIPELINE: BuildStatus[] = ['planning', 'building', 'testing', 'listed', 'sold']

const checkIcon: Record<CheckLevel, { icon: typeof Info; cls: string }> = {
  ok: { icon: CheckCircle2, cls: 'text-positive' },
  warn: { icon: TriangleAlert, cls: 'text-warning' },
  error: { icon: AlertCircle, cls: 'text-negative' },
  info: { icon: Info, cls: 'text-sky-500' },
}

function Stepper({ build, onChange }: { build: Build; onChange: (s: BuildStatus) => void }) {
  const idx = PIPELINE.indexOf(build.status)
  return (
    <div className="flex items-center overflow-x-auto rounded-xl border border-border bg-surface p-1">
      {PIPELINE.map((s, i) => {
        const def = BUILD_STATUSES.find((d) => d.value === s)!
        const active = s === build.status
        const done = idx >= 0 && i < idx
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
              active ? 'bg-accent text-accent-fg shadow-sm' : done ? 'text-fg-2 hover:bg-surface-2' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <span
              className={cn('flex size-4 items-center justify-center rounded-full text-[10px]', active ? 'bg-white/25' : done ? 'bg-positive/15 text-positive' : 'bg-surface-3')}
            >
              {done ? '✓' : i + 1}
            </span>
            {def.label}
          </button>
        )
      })}
    </div>
  )
}

function ComponentsCard({ build, onAdd }: { build: BuildDetail; onAdd: (slot?: PcSlot) => void }) {
  const lk = useLookups()
  const confirm = useConfirm()
  const detach = useAction((itemId: number) => api.del(`/api/builds/${build.id}/components/${itemId}`), { success: 'Pièce remise en stock' })
  const bySlot = useMemo(() => {
    const map = new Map<PcSlot, Item[]>()
    for (const c of build.components) {
      const s = slotOf(c, lk.categories)
      map.set(s, [...(map.get(s) ?? []), c])
    }
    return map
  }, [build.components, lk.categories])
  const totalCost = build.components.reduce((s, c) => s + itemCost(c), 0)
  const totalValue = build.components.reduce((s, c) => s + (c.target_price ?? c.listed_price ?? itemCost(c)), 0)
  const locked = build.status === 'sold' || build.status === 'dismantled'

  return (
    <Card>
      <CardHeader
        title="Composants"
        description={`${build.components.length} pièce${build.components.length > 1 ? 's' : ''} — cliquez sur une pièce pour voir sa fiche d’achat.`}
        icon={<Cpu />}
        action={
          !locked && (
            <Button size="sm" variant="primary" onClick={() => onAdd()}>
              <Plus /> Ajouter une pièce
            </Button>
          )
        }
      />
      <ul className="divide-y divide-border border-t border-border md:hidden">
        {PC_SLOTS.flatMap((slot) =>
          (bySlot.get(slot.value) ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-base">{slot.emoji}</span>
              <Link to={`/items/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted">
                  {slot.label} · {lk.platform(c.purchase_platform_id)?.name ?? '—'}
                </p>
              </Link>
              <span className="tabular text-sm font-medium">{eur(itemCost(c))}</span>
            </li>
          )),
        )}
        {!locked &&
          PC_SLOTS.filter((s) => s.required && !bySlot.has(s.value)).map((slot) => (
            <li key={slot.value} className="px-4 py-2.5">
              <button type="button" onClick={() => onAdd(slot.value)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent">
                <Plus className="size-4" /> {slot.emoji} Ajouter {slot.label.toLowerCase()}
              </button>
            </li>
          ))}
        <li className="flex justify-between bg-surface-2/60 px-4 py-2.5 text-sm font-medium">
          <span>Total des pièces</span>
          <span className="tabular">{eur(totalCost)}</span>
        </li>
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
            <tr>
              <th className="w-32 px-5 py-2 font-medium">Emplacement</th>
              <th className="px-3 py-2 font-medium">Pièce</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 text-right font-medium">Coût</th>
              <th className="px-3 py-2 text-right font-medium">
                <Tip content="Valeur estimée si la pièce était revendue seule (prix visé).">
                  <span className="cursor-help underline decoration-dotted underline-offset-2">Valeur</span>
                </Tip>
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PC_SLOTS.map((slot) => {
              const list = bySlot.get(slot.value) ?? []
              if (!list.length) {
                if (!slot.required || locked) return null
                return (
                  <tr key={slot.value} className="bg-warning/[0.03]">
                    <td className="px-5 py-2.5 text-[13px] text-muted">
                      <span className="mr-1.5">{slot.emoji}</span>
                      {slot.label}
                    </td>
                    <td colSpan={5} className="px-3 py-2.5">
                      <button type="button" onClick={() => onAdd(slot.value)} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-accent">
                        <Plus className="size-3.5" /> Ajouter {slot.label.toLowerCase()}
                      </button>
                    </td>
                  </tr>
                )
              }
              return list.map((c, i) => {
                const sum = specSummary(slot.value, c.specs)
                return (
                  <tr key={c.id} className="group hover:bg-surface-2/50">
                    <td className="px-5 py-2.5 align-top text-[13px] text-muted">
                      {i === 0 && (
                        <>
                          <span className="mr-1.5">{slot.emoji}</span>
                          {slot.label}
                        </>
                      )}
                    </td>
                    <td className="max-w-[300px] px-3 py-2.5">
                      <Link to={`/items/${c.id}`} className="block truncate font-medium hover:text-accent">
                        {c.title}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {c.sku}
                        {sum && ` · ${sum}`}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <PlatformTag platform={lk.platform(c.purchase_platform_id)} />
                      <p className="text-xs text-muted">{fmtDateShort(c.purchase_date)}</p>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">{eur(itemCost(c))}</td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">{eur(c.target_price ?? c.listed_price)}</td>
                    <td className="pr-3 text-right">
                      {!locked && (
                        <Tip content="Retirer du PC (remise en stock)">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="opacity-50 group-hover:opacity-100"
                            onClick={async () => {
                              if (
                                await confirm({
                                  title: 'Retirer cette pièce ?',
                                  description: `« ${c.title} » sera remise en stock et pourra être revendue seule.`,
                                  confirmLabel: 'Retirer',
                                })
                              )
                                detach.mutate(c.id)
                            }}
                          >
                            <X />
                          </Button>
                        </Tip>
                      )}
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
          <tfoot className="border-t border-border bg-surface-2/60 text-[13px]">
            <tr>
              <td className="px-5 py-2.5 font-medium" colSpan={3}>
                Total des pièces
              </td>
              <td className="tabular px-3 py-2.5 text-right font-semibold">{eur(totalCost)}</td>
              <td className="tabular px-3 py-2.5 text-right text-muted">{eur(totalValue)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

function ChecklistTab({ build }: { build: Build }) {
  const [label, setLabel] = useState('')
  const save = useAction((checklist: ChecklistEntry[]) => api.patch(`/api/builds/${build.id}`, { checklist }), { silent: false })
  const list = build.checklist
  const done = list.filter((c) => c.done).length
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Progress value={list.length ? done / list.length : 0} tone={done === list.length && list.length > 0 ? 'positive' : 'accent'} className="h-2 flex-1" />
        <span className="tabular text-sm font-medium">
          {done}/{list.length}
        </span>
      </div>
      <ul className="space-y-1">
        {list.map((c) => (
          <li key={c.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <Checkbox checked={c.done} onChange={(v) => save.mutate(list.map((x) => (x.id === c.id ? { ...x, done: v } : x)))} aria-label={c.label} />
            <span className={cn('flex-1 text-sm', c.done && 'text-muted line-through')}>{c.label}</span>
            <button
              type="button"
              className="text-muted opacity-0 group-hover:opacity-100 hover:text-negative"
              onClick={() => save.mutate(list.filter((x) => x.id !== c.id))}
              aria-label="Supprimer"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!label.trim()) return
          save.mutate([...list, { id: uid(), label: label.trim(), done: false }])
          setLabel('')
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ajouter un contrôle…" />
        <Button type="submit" variant="outline">
          <Plus />
        </Button>
      </form>
    </div>
  )
}

function BenchmarksTab({ build }: { build: Build }) {
  const [rows, setRows] = useState<Benchmark[]>(build.benchmarks)
  useEffect(() => setRows(build.benchmarks), [build.benchmarks])
  const dirty = JSON.stringify(rows) !== JSON.stringify(build.benchmarks)
  const save = useAction(() => api.patch(`/api/builds/${build.id}`, { benchmarks: rows.filter((r) => r.label.trim()) }), { success: 'Benchmarks enregistrés' })
  const update = (id: string, patch: Partial<Benchmark>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">Des chiffres rassurent l’acheteur : score Cinebench, 3DMark, FPS mesurés en jeu, températures…</p>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <Input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} placeholder="Test" className="flex-1" />
          <Input value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder="Résultat" className="w-28" />
          <Input value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} placeholder="Unité" className="w-20" />
          <Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label="Supprimer">
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus /> Ajouter un test
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            {BENCHMARK_PRESETS.map((p) => (
              <MenuItem key={p.label} onSelect={() => setRows((rs) => [...rs, { id: uid(), label: p.label, value: '', unit: p.unit }])}>
                {p.label}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem onSelect={() => setRows((rs) => [...rs, { id: uid(), label: '', value: '', unit: '' }])}>Test personnalisé</MenuItem>
          </MenuContent>
        </Menu>
        {dirty && (
          <Button size="sm" variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Enregistrer
          </Button>
        )}
      </div>
    </div>
  )
}

function ListingTab({ build }: { build: BuildDetail }) {
  const lk = useLookups()
  const [opts, setOpts] = useState<ListingOptions>(DEFAULT_LISTING_OPTIONS)
  const title = buildListingTitle(build, build.components, lk.categories)
  const text = buildListing(build, build.components, lk.categories, opts)
  const copy = async (s: string, what: string) => {
    if (await copyText(s)) toast.success(`${what} copié`)
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(
          [
            ['emojis', 'Emojis'],
            ['price', 'Prix'],
            ['benchmarks', 'Benchmarks'],
            ['tests', 'Contrôles'],
            ['warranty', 'Garantie'],
          ] as [keyof ListingOptions, string][]
        ).map(([k, label]) => (
          <Switch key={k} checked={opts[k]} onChange={(v) => setOpts((o) => ({ ...o, [k]: v }))} label={<span className="text-[13px] text-fg-2">{label}</span>} />
        ))}
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Titre</span>
          <Button size="xs" variant="ghost" onClick={() => copy(title, 'Titre')}>
            <Copy /> Copier
          </Button>
        </div>
        <Input readOnly value={title} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Description</span>
          <Button size="xs" variant="ghost" onClick={() => copy(text, 'Texte')}>
            <Copy /> Copier
          </Button>
        </div>
        <Textarea readOnly value={text} rows={Math.min(24, text.split('\n').length + 1)} className="font-mono text-[13px]" />
      </div>
      <Link to={`/builds/${build.id}/print`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        <Printer className="size-4" /> Fiche technique imprimable (PDF) pour l’acheteur
      </Link>
    </div>
  )
}

function InlineMoney({ label, value, onSave, suffix = '€', hint }: { label: string; value: number; onSave: (v: number) => void; suffix?: string; hint?: string }) {
  const [v, setV] = useState<number | null>(value)
  useEffect(() => setV(value), [value])
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-fg-2" title={hint}>
        {label}
      </span>
      <NumberInput className="w-28" value={v} onValueChange={setV} onBlur={() => (v ?? 0) !== value && onSave(v ?? 0)} suffix={suffix} />
    </div>
  )
}

export function BuildDetailPage() {
  const id = Number(useParams().id)
  const { data: build, isLoading, error } = useBuild(id)
  const lk = useLookups()
  const editors = useEditors()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [picker, setPicker] = useState<{ slot?: PcSlot } | null>(null)
  const [tab, setTab] = useState<'checklist' | 'benchmarks' | 'listing' | 'photos' | 'history'>('checklist')

  const patch = useAction((body: Partial<Build>) => api.patch<Build>(`/api/builds/${id}`, body), { success: 'PC mis à jour' })
  const dismantle = useAction(() => api.post(`/api/builds/${id}/dismantle`), { success: 'PC démonté : pièces remises en stock' })
  const remove = useAction(() => api.del(`/api/builds/${id}`), { success: 'Fiche PC supprimée' })

  const settings = lk.meta?.settings ?? { hourly_rate: 0 }
  const m = useMemo(() => (build ? buildMetrics(build, build.components, settings, lk.platforms) : null), [build, settings, lk.platforms])
  const compat = useMemo(() => (build ? checkBuild(build.components, lk.categories) : null), [build, lk.categories])

  if (isLoading) return <PageLoader />
  if (error || !build || !m || !compat)
    return (
      <EmptyState
        icon={<Cpu />}
        title="PC introuvable"
        action={
          <Link to="/builds">
            <Button>Retour aux PC</Button>
          </Link>
        }
      />
    )

  const saleP = lk.platform(build.sale_platform_id)
  const warrantyEnd =
    build.sale_date && build.warranty_months > 0
      ? new Date(new Date(build.sale_date).setMonth(new Date(build.sale_date).getMonth() + build.warranty_months)).toISOString().slice(0, 10)
      : null
  const listedDays = build.status === 'listed' ? daysBetween(build.listed_date, todayISO()) : null

  const onStatus = (s: BuildStatus) => {
    if (s === build.status) return
    if (s === 'sold') editors.openSell({ kind: 'build', build, cost: m.totalCost })
    else if (s === 'listed' && build.listed_price == null) editors.openList({ kind: 'build', build, cost: m.totalCost })
    else patch.mutate({ status: s })
  }

  const errors = compat.checks.filter((c) => c.level === 'error').length
  const warns = compat.checks.filter((c) => c.level === 'warn').length

  return (
    <div className="space-y-5">
      <div>
        <Link to="/builds" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> PC montés
        </Link>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <BuildStatusBadge status={build.status} />
              <span>{build.ref}</span>
              {build.usage && <span>· {build.usage}</span>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{build.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {build.status !== 'sold' && build.status !== 'dismantled' && (
              <>
                <Button variant="outline" onClick={() => editors.openList({ kind: 'build', build, cost: m.totalCost })}>
                  <Tag /> {build.status === 'listed' ? 'Modifier l’annonce' : 'Mettre en vente'}
                </Button>
                <Button variant="success" onClick={() => editors.openSell({ kind: 'build', build, cost: m.totalCost })}>
                  <ShoppingCart /> Vendu
                </Button>
              </>
            )}
            <Link to={`/builds/${build.id}/print`} target="_blank">
              <Button variant="outline">
                <Printer /> Fiche
              </Button>
            </Link>
            <Button variant="primary" onClick={() => editors.openBuild(build)}>
              <Pencil /> Modifier
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Plus d’actions">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Statut</MenuLabel>
                {BUILD_STATUSES.filter((s) => !['sold', 'dismantled', build.status].includes(s.value)).map((s) => (
                  <MenuItem key={s.value} onSelect={() => onStatus(s.value)}>
                    {s.label}
                  </MenuItem>
                ))}
                <MenuSeparator />
                {build.status !== 'sold' && build.components.length > 0 && (
                  <MenuItem
                    icon={<Undo2 />}
                    onSelect={async () => {
                      if (
                        await confirm({
                          title: 'Démonter ce PC ?',
                          description: `Les ${build.components.length} pièces retourneront en stock pour être revendues séparément. La fiche est conservée avec le statut « Démonté ».`,
                          confirmLabel: 'Démonter',
                        })
                      )
                        dismantle.mutate(undefined)
                    }}
                  >
                    Démonter (revendre en pièces)
                  </MenuItem>
                )}
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: 'Supprimer cette fiche PC ?',
                        description: 'Les pièces seront remises en stock. La fiche et son historique seront supprimés.',
                        confirmLabel: 'Supprimer',
                        danger: true,
                      })
                    )
                      remove.mutate(undefined, { onSuccess: () => navigate('/builds') })
                  }}
                >
                  Supprimer la fiche
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
        {build.status !== 'dismantled' && build.status !== 'kept' && (
          <div className="mt-4">
            <Stepper build={build} onChange={onStatus} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Coût total" value={eur0(m.totalCost)} sub={`${eur0(m.componentsCost)} pièces + ${eur0(m.extraCosts)} frais`} />
        <KpiCard label={m.sold ? 'Vendu' : build.listed_price != null ? 'Prix affiché' : 'Prix visé'} value={eur0(m.price)} sub={saleP?.name} />
        <KpiCard
          label={m.sold ? 'Bénéfice' : 'Bénéfice estimé'}
          value={<Profit value={m.profit} signed={false} className="font-semibold" />}
          sub={m.net != null ? `net ${eur0(m.net)}` : 'définissez un prix'}
        />
        <KpiCard label="Marge / ROI" value={pct(m.margin)} sub={m.roi != null ? `ROI ${pct(m.roi)}` : undefined} />
        <KpiCard
          label="Taux horaire"
          value={m.hourlyRate != null ? `${eur0(m.hourlyRate)}/h` : '—'}
          sub={build.labor_hours ? `${build.labor_hours} h de travail` : 'heures non saisies'}
          hint="Bénéfice divisé par le temps passé (montage, tests, annonce, remise)."
        />
        <KpiCard
          label="Montage vs pièces"
          value={<Profit value={m.assemblyGain} className="font-semibold" />}
          sub={`pièces seules : ${eur0(m.partsValue)}`}
          hint="Différence entre le prix du PC monté et la somme des valeurs de revente des pièces vendues séparément. Négatif : il serait plus rentable de revendre en pièces."
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <ComponentsCard build={build} onAdd={(slot) => setPicker({ slot })} />

          <Card>
            <div className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  {
                    value: 'checklist',
                    label: (
                      <>
                        <ListChecks className="size-4" /> Tests QA
                      </>
                    ),
                  },
                  {
                    value: 'benchmarks',
                    label: (
                      <>
                        <Zap className="size-4" /> Benchmarks
                      </>
                    ),
                  },
                  {
                    value: 'listing',
                    label: (
                      <>
                        <Tag className="size-4" /> Annonce
                      </>
                    ),
                  },
                  { value: 'photos', label: `Photos${build.photos.length ? ` (${build.photos.length})` : ''}` },
                  { value: 'history', label: 'Historique' },
                ]}
              />
            </div>
            <CardBody className="pt-4">
              {tab === 'checklist' && <ChecklistTab build={build} />}
              {tab === 'benchmarks' && <BenchmarksTab build={build} />}
              {tab === 'listing' && <ListingTab build={build} />}
              {tab === 'photos' && <PhotoUploader value={build.photos} onChange={(photos) => patch.mutate({ photos })} />}
              {tab === 'history' && <Timeline events={build.events} />}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Compatibilité"
              icon={<Wrench />}
              description={
                errors
                  ? `${errors} problème(s) bloquant(s)`
                  : warns
                    ? `${warns} point(s) à vérifier`
                    : build.components.length
                      ? 'Aucun problème détecté'
                      : 'Ajoutez des pièces pour lancer les contrôles'
              }
            />
            <CardBody className="space-y-2.5">
              {compat.checks.map((c, i) => {
                const { icon: Icon, cls } = checkIcon[c.level]
                return (
                  <div key={i} className="flex gap-2.5">
                    <Icon className={cn('mt-0.5 size-4 shrink-0', cls)} />
                    <div className="min-w-0">
                      <p className="text-sm">{c.title}</p>
                      {c.detail && <p className="text-xs text-muted">{c.detail}</p>}
                    </div>
                  </div>
                )
              })}
              {compat.estimatedWattage != null && (
                <div className="mt-3 rounded-lg bg-surface-2 p-3">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-muted">Consommation estimée en charge</span>
                    <span className="tabular font-medium">
                      ~{compat.estimatedWattage} W{compat.psuWattage ? ` / ${compat.psuWattage} W` : ''}
                    </span>
                  </div>
                  <Progress
                    value={compat.psuWattage ? compat.estimatedWattage / compat.psuWattage : 0}
                    tone={
                      compat.psuWattage && compat.estimatedWattage > compat.psuWattage
                        ? 'negative'
                        : compat.psuWattage && compat.estimatedWattage * 1.35 > compat.psuWattage
                          ? 'warning'
                          : 'positive'
                    }
                  />
                  <p className="mt-1.5 text-[11px] text-muted">Alimentation conseillée : {compat.recommendedWattage} W minimum</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rentabilité" />
            <CardBody>
              {m.price != null ? (
                <>
                  <StatLine label={m.sold ? 'Prix de vente' : build.listed_price != null ? 'Prix affiché' : 'Prix visé'} value={eur(m.price)} />
                  {m.sold ? (
                    <>
                      <StatLine label="− Frais plateforme" value={eur(-build.sale_fees)} muted />
                      <StatLine label="− Envoi" value={eur(-build.sale_shipping)} muted />
                    </>
                  ) : (
                    m.net != null && m.net !== m.price && <StatLine label="− Frais plateforme estimés" value={eur(m.net - m.price)} muted />
                  )}
                </>
              ) : (
                <p className="mb-2 text-sm text-muted">Aucun prix défini.</p>
              )}
              <StatLine label="− Pièces" value={eur(-m.componentsCost)} muted />
              <StatLine label="− Consommables / frais" value={eur(-m.extraCosts)} muted />
              <div className="mt-2 flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2.5">
                <span className="text-sm font-medium">{m.sold ? 'Bénéfice' : 'Bénéfice estimé'}</span>
                <Profit value={m.profit} className="text-lg font-semibold" />
              </div>
              {m.laborCost > 0 && (
                <>
                  <StatLine label={`− Main d’œuvre (${build.labor_hours} h × ${eur(settings.hourly_rate)})`} value={eur(-m.laborCost)} muted className="mt-2" />
                  <StatLine label="Bénéfice après main d’œuvre" value={<Profit value={m.profitAfterLabor} />} strong />
                </>
              )}
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                <InlineMoney
                  label="Consommables / frais"
                  value={build.extra_costs}
                  onSave={(v) => patch.mutate({ extra_costs: v })}
                  hint="Pâte thermique, câbles, ventilateurs d’appoint, licence…"
                />
                <InlineMoney label="Temps passé" value={build.labor_hours} suffix="h" onSave={(v) => patch.mutate({ labor_hours: v })} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vente" />
            <CardBody className="space-y-0.5">
              <StatLine label="Prix visé" value={eur(build.target_price)} />
              <StatLine label="Prix affiché" value={eur(build.listed_price)} />
              <StatLine label="Plateforme" value={saleP ? <PlatformTag platform={saleP} /> : '—'} />
              {build.listed_date && <StatLine label="En ligne depuis" value={`${fmtDate(build.listed_date)}${listedDays != null ? ` (${fmtDays(listedDays)})` : ''}`} />}
              {m.sold && (
                <>
                  <StatLine label="Vendu le" value={fmtDate(build.sale_date)} />
                  {build.buyer && <StatLine label="Acheteur" value={build.buyer} />}
                  {m.daysToSell != null && <StatLine label="Cycle complet" value={fmtDays(m.daysToSell)} />}
                </>
              )}
              <StatLine
                label="Garantie offerte"
                value={build.warranty_months ? `${build.warranty_months} mois${warrantyEnd ? ` (jusqu’au ${fmtDate(warrantyEnd)})` : ''}` : 'Aucune'}
              />
            </CardBody>
          </Card>

          {(build.description || build.notes) && (
            <Card>
              <CardHeader title="Description & notes" />
              <CardBody className="space-y-3 text-sm">
                {build.description && <p className="whitespace-pre-wrap text-fg-2">{build.description}</p>}
                {build.notes && <p className="rounded-lg bg-surface-2 p-3 whitespace-pre-wrap text-muted">{build.notes}</p>}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ComponentPicker buildId={build.id} open={!!picker} slot={picker?.slot} onOpenChange={(o) => !o && setPicker(null)} />
    </div>
  )
}
