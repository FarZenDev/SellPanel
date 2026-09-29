import { Archive, Database, Download, FileUp, Pencil, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PC_SLOTS } from '@shared/constants'
import type { Backup, Category, PcSlot, Platform, Settings } from '@shared/types'
import { PlatformDot } from '@/components/badges'
import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { Field, Input, NumberInput, Select, Switch } from '@/components/ui/form'
import { PageLoader, Segmented } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { exportItemsCsv, parseItemsCsv, type ImportRow } from '@/lib/csv'
import { eur } from '@/lib/format'
import { useAction, useItems, useLookups } from '@/lib/queries'

type Tab = 'general' | 'platforms' | 'categories' | 'data'

function GeneralTab({ settings }: { settings: Settings }) {
  const [s, setS] = useState<Settings>(settings)
  useEffect(() => setS(settings), [settings])
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }))
  const save = useAction(() => api.put<Settings>('/api/settings', s), { success: 'Paramètres enregistrés' })
  const dirty = JSON.stringify(s) !== JSON.stringify(settings)
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Boutique" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Nom affiché" hint="Utilisé sur les fiches PC imprimables">
            <Input value={s.shop_name} onChange={(e) => set('shop_name', e.target.value)} />
          </Field>
          <Field label="Préfixe des SKU" hint={`ex. ${s.sku_prefix}-0042`}>
            <Input value={s.sku_prefix} onChange={(e) => set('sku_prefix', e.target.value.toUpperCase())} maxLength={8} />
          </Field>
          <Field label="Préfixe des PC" hint={`ex. ${s.build_prefix}-007`}>
            <Input value={s.build_prefix} onChange={(e) => set('build_prefix', e.target.value.toUpperCase())} maxLength={8} />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Pilotage" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Objectif de bénéfice mensuel">
            <NumberInput value={s.monthly_goal} onValueChange={(v) => set('monthly_goal', v ?? 0)} />
          </Field>
          <Field label="Taux horaire (main d’œuvre)" hint="Valorise le temps passé sur les PC">
            <NumberInput value={s.hourly_rate} onValueChange={(v) => set('hourly_rate', v ?? 0)} suffix="€/h" />
          </Field>
          <Field label="Stock dormant après" hint="Alerte sur les articles qui ne partent pas">
            <NumberInput value={s.stale_days} onValueChange={(v) => set('stale_days', Math.max(1, Math.round(v ?? 60)))} suffix="jours" />
          </Field>
          <Field label="Garantie PC par défaut">
            <NumberInput value={s.default_warranty_months} onValueChange={(v) => set('default_warranty_months', Math.round(v ?? 0))} suffix="mois" />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Fiscalité" description="Suivi des seuils de déclaration des plateformes (DAC7) et des cotisations auto-entrepreneur." />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Seuil DAC7 : ventes / an">
            <NumberInput value={s.dac7_sales} onValueChange={(v) => set('dac7_sales', Math.round(v ?? 30))} suffix="" />
          </Field>
          <Field label="Seuil DAC7 : montant / an">
            <NumberInput value={s.dac7_amount} onValueChange={(v) => set('dac7_amount', v ?? 2000)} />
          </Field>
          <Field label="Micro-entreprise">
            <div className="flex h-9 items-center">
              <Switch
                checked={s.micro_enabled}
                onChange={(v) => set('micro_enabled', v)}
                label={<span className="text-sm text-muted">{s.micro_enabled ? 'Activée' : 'Désactivée'}</span>}
              />
            </div>
          </Field>
          <Field label="Taux de cotisations" hint="12,3 % en 2026 (achat-revente)">
            <NumberInput value={s.micro_rate} disabled={!s.micro_enabled} onValueChange={(v) => set('micro_rate', v ?? 0)} suffix="%" />
          </Field>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button variant="ghost" onClick={() => setS(settings)}>
            Annuler
          </Button>
        )}
        <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

function PlatformDialog({ platform, open, onOpenChange }: { platform: Platform | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const empty: Partial<Platform> = {
    name: '',
    color: '#6366f1',
    url: '',
    search_url: '',
    sale_fee_percent: 0,
    sale_fee_fixed: 0,
    buyer_fee_percent: 0,
    buyer_fee_fixed: 0,
    dac7: true,
    archived: false,
  }
  const [p, setP] = useState<Partial<Platform>>(empty)
  useEffect(() => {
    if (open) setP(platform ? { ...platform } : empty)
  }, [open, platform])
  const set = <K extends keyof Platform>(k: K, v: Platform[K]) => setP((x) => ({ ...x, [k]: v }))
  const save = useAction(
    () => {
      const body = {
        name: p.name,
        color: p.color,
        url: p.url || null,
        search_url: p.search_url || null,
        sale_fee_percent: p.sale_fee_percent,
        sale_fee_fixed: p.sale_fee_fixed,
        buyer_fee_percent: p.buyer_fee_percent,
        buyer_fee_fixed: p.buyer_fee_fixed,
        dac7: p.dac7,
        archived: p.archived,
      }
      return platform ? api.patch(`/api/platforms/${platform.id}`, body) : api.post('/api/platforms', body)
    },
    { success: platform ? 'Plateforme mise à jour' : 'Plateforme ajoutée' },
  )
  const example = 100
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={platform ? `Modifier ${platform.name}` : 'Nouvelle plateforme'}
      description="Les grilles de frais pré-remplissent automatiquement vos achats et ventes."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!p.name?.trim()} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => onOpenChange(false) })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Nom" className="col-span-2 sm:col-span-3">
          <Input value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Couleur">
          <div className="flex h-9 items-center gap-2">
            <input type="color" value={p.color} onChange={(e) => set('color', e.target.value)} className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-surface" />
            <span className="font-mono text-xs text-muted">{p.color}</span>
          </div>
        </Field>
        <Field label="Site web" className="col-span-2">
          <Input value={p.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="URL de recherche" className="col-span-2" hint="{q} = texte recherché — alimente les liens « Vérifier la cote »">
          <Input value={p.search_url ?? ''} onChange={(e) => set('search_url', e.target.value)} placeholder="https://site.fr/recherche?q={q}" />
        </Field>
        <div className="col-span-2 rounded-xl border border-border p-3 sm:col-span-2">
          <p className="mb-3 text-sm font-medium">Frais vendeur (quand je vends)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission">
              <NumberInput value={p.sale_fee_percent} onValueChange={(v) => set('sale_fee_percent', v ?? 0)} suffix="%" />
            </Field>
            <Field label="Fixe / vente">
              <NumberInput value={p.sale_fee_fixed} onValueChange={(v) => set('sale_fee_fixed', v ?? 0)} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            Pour une vente de {eur(example)} : {eur((example * (p.sale_fee_percent ?? 0)) / 100 + (p.sale_fee_fixed ?? 0))} de frais
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-border p-3 sm:col-span-2">
          <p className="mb-3 text-sm font-medium">Protection acheteur (quand j’achète)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pourcentage">
              <NumberInput value={p.buyer_fee_percent} onValueChange={(v) => set('buyer_fee_percent', v ?? 0)} suffix="%" />
            </Field>
            <Field label="Fixe / achat">
              <NumberInput value={p.buyer_fee_fixed} onValueChange={(v) => set('buyer_fee_fixed', v ?? 0)} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            Pour un achat de {eur(example)} : {eur((example * (p.buyer_fee_percent ?? 0)) / 100 + (p.buyer_fee_fixed ?? 0))} de frais
          </p>
        </div>
        <div className="col-span-2 flex flex-wrap gap-6 sm:col-span-4">
          <Switch checked={!!p.dac7} onChange={(v) => set('dac7', v)} label="Soumise à DAC7 (déclaration au fisc)" />
          <Switch checked={!!p.archived} onChange={(v) => set('archived', v)} label="Archivée (masquée des listes)" />
        </div>
      </div>
    </Dialog>
  )
}

function PlatformsTab() {
  const { platforms } = useLookups()
  const confirm = useConfirm()
  const [edit, setEdit] = useState<{ platform: Platform | null } | null>(null)
  const remove = useAction((id: number) => api.del(`/api/platforms/${id}`), { success: 'Plateforme supprimée' })
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Plateformes d’achat et de vente"
        description="Frais 2026 pour un particulier : Vinted et Leboncoin facturent la protection à l’acheteur (5 % + 0,70 €), eBay est gratuit pour les vendeurs particuliers depuis le 1er septembre 2026. Ajustez selon votre statut (pro, boutique…)."
        action={
          <Button size="sm" variant="primary" onClick={() => setEdit({ platform: null })}>
            <Plus /> Ajouter
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Plateforme</th>
              <th className="px-3 py-2.5 font-medium">Frais vendeur</th>
              <th className="px-3 py-2.5 font-medium">Protection acheteur</th>
              <th className="px-3 py-2.5 font-medium">DAC7</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {platforms.map((p) => (
              <tr key={p.id} className={p.archived ? 'opacity-50' : ''}>
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <PlatformDot color={p.color} className="size-2.5" />
                    {p.name}
                    {p.archived && (
                      <Badge tone="zinc">
                        <Archive className="size-3" /> Archivée
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="tabular px-3 py-2.5 text-fg-2">
                  {p.sale_fee_percent || p.sale_fee_fixed ? `${p.sale_fee_percent} % + ${eur(p.sale_fee_fixed)}` : <span className="text-muted">Aucun</span>}
                </td>
                <td className="tabular px-3 py-2.5 text-fg-2">
                  {p.buyer_fee_percent || p.buyer_fee_fixed ? `${p.buyer_fee_percent} % + ${eur(p.buyer_fee_fixed)}` : <span className="text-muted">Aucune</span>}
                </td>
                <td className="px-3 py-2.5">{p.dac7 ? <Badge tone="violet">Oui</Badge> : <span className="text-muted">Non</span>}</td>
                <td className="pr-3 text-right whitespace-nowrap">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEdit({ platform: p })} aria-label="Modifier">
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Supprimer"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Supprimer ${p.name} ?`,
                          description: 'Impossible si la plateforme est utilisée : archivez-la dans ce cas.',
                          confirmLabel: 'Supprimer',
                          danger: true,
                        })
                      )
                        remove.mutate(p.id)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PlatformDialog open={!!edit} platform={edit?.platform ?? null} onOpenChange={(o) => !o && setEdit(null)} />
    </Card>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const confirm = useConfirm()
  const [name, setName] = useState(category.name)
  useEffect(() => setName(category.name), [category.name])
  const patch = useAction((body: Partial<Category>) => api.patch(`/api/categories/${category.id}`, body), { success: 'Catégorie mise à jour' })
  const remove = useAction(() => api.del(`/api/categories/${category.id}`), { success: 'Catégorie supprimée' })
  return (
    <tr>
      <td className="px-5 py-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={category.color}
            onChange={(e) => patch.mutate({ color: e.target.value })}
            className="size-7 shrink-0 cursor-pointer rounded-md border border-border bg-surface"
            aria-label="Couleur"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== category.name && patch.mutate({ name: name.trim() })}
            className="h-8"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Select className="w-48" value={category.slot ?? ''} onChange={(e) => patch.mutate({ slot: (e.target.value || null) as PcSlot | null })}>
          <option value="">— Pas un composant PC —</option>
          {PC_SLOTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="pr-3 text-right">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Supprimer"
          onClick={async () => {
            if (
              await confirm({
                title: `Supprimer « ${category.name} » ?`,
                description: 'Les articles de cette catégorie deviendront « sans catégorie ».',
                confirmLabel: 'Supprimer',
                danger: true,
              })
            )
              remove.mutate(undefined)
          }}
        >
          <Trash2 />
        </Button>
      </td>
    </tr>
  )
}

function CategoriesTab() {
  const { categories } = useLookups()
  const [name, setName] = useState('')
  const create = useAction(() => api.post('/api/categories', { name: name.trim(), color: '#64748b' }), { success: 'Catégorie ajoutée' })
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Catégories" description="Associez une catégorie à un emplacement de PC pour activer les caractéristiques techniques et les contrôles de compatibilité." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-y border-border bg-surface-2/60 text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Nom</th>
              <th className="px-3 py-2.5 font-medium">Emplacement PC</th>
              <th className="w-14" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="flex gap-2 border-t border-border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) create.mutate(undefined, { onSuccess: () => setName('') })
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie…" className="max-w-xs" />
        <Button type="submit" variant="outline" loading={create.isPending}>
          <Plus /> Ajouter
        </Button>
      </form>
    </Card>
  )
}

function DataTab() {
  const lk = useLookups()
  const { data: items = [] } = useItems()
  const confirm = useConfirm()
  const restoreInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<{ rows: ImportRow[]; skipped: number; name: string } | null>(null)
  const restore = useAction((data: Backup) => api.post('/api/restore', data), { success: 'Sauvegarde restaurée' })
  const importCsv = useAction((rows: ImportRow[]) => api.post<{ count: number }>('/api/items/import', { items: rows }), { success: (r) => `${r.count} article(s) importé(s)` })
  const demo = useAction(() => api.post('/api/demo'), { success: 'Données de démonstration chargées' })

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Sauvegarde complète" icon={<Database />} description="Toutes vos données (articles, PC, lots, dépenses, paramètres) dans un fichier JSON." />
        <CardBody className="flex flex-wrap gap-2">
          <a href="/api/backup" download>
            <Button variant="primary">
              <Download /> Télécharger la sauvegarde
            </Button>
          </a>
          <Button variant="outline" onClick={() => restoreInput.current?.click()} loading={restore.isPending}>
            <RotateCcw /> Restaurer…
          </Button>
          <input
            ref={restoreInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const data = JSON.parse(await file.text()) as Backup
                if (
                  !(await confirm({
                    title: 'Restaurer cette sauvegarde ?',
                    description: `Toutes les données actuelles seront remplacées par celles du ${data.exported_at?.slice(0, 10) ?? 'fichier'} (${data.items?.length ?? 0} articles, ${data.builds?.length ?? 0} PC).`,
                    confirmLabel: 'Remplacer mes données',
                    danger: true,
                  }))
                )
                  return
                restore.mutate(data)
              } catch {
                toast.error('Fichier de sauvegarde illisible')
              }
            }}
          />
          <p className="w-full text-xs text-muted">
            Les photos sont stockées dans le dossier <code className="rounded bg-surface-2 px-1">data/uploads</code> du serveur : sauvegardez ce dossier en plus du fichier JSON.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Import / export CSV"
          icon={<FileUp />}
          description="Migrez depuis votre tableur : colonnes Titre, Prix achat, Date achat, Plateforme achat, Prix vente… (séparateur ; ou ,)."
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => csvInput.current?.click()}>
            <Upload /> Importer un CSV…
          </Button>
          <Button variant="outline" onClick={() => exportItemsCsv(items, lk)}>
            <Download /> Exporter l’inventaire
          </Button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const parsed = parseItemsCsv(await file.text())
              if (!parsed.rows.length) toast.error('Aucune ligne exploitable : une colonne « Titre » est nécessaire.')
              else setCsvRows({ ...parsed, name: file.name })
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Données de démonstration"
          icon={<Sparkles />}
          description="Un jeu de données réaliste (ventes, PC montés, lot démonté, dépenses) pour découvrir le panel. Disponible uniquement sur une base vide."
        />
        <CardBody>
          <Button variant="outline" disabled={items.length > 0} loading={demo.isPending} onClick={() => demo.mutate(undefined)}>
            Charger la démo
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sécurité" icon={<ShieldCheck />} description={lk.meta?.auth ? 'Le panel est protégé par mot de passe.' : 'Aucun mot de passe n’est configuré.'} />
        <CardBody className="text-sm text-fg-2">
          {lk.meta?.auth ? (
            <p>
              Le mot de passe est défini par la variable d’environnement <code className="rounded bg-surface-2 px-1">APP_PASSWORD</code> du serveur. Session valable 30 jours.
            </p>
          ) : (
            <p>
              Avant d’exposer SellPanel sur Internet, démarrez le serveur avec <code className="rounded bg-surface-2 px-1">APP_PASSWORD=votre-mot-de-passe</code> pour activer
              l’écran de connexion.
            </p>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={!!csvRows}
        onOpenChange={(o) => !o && setCsvRows(null)}
        title="Importer des articles"
        description={csvRows?.name}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCsvRows(null)}>
              Annuler
            </Button>
            <Button variant="primary" loading={importCsv.isPending} onClick={() => csvRows && importCsv.mutate(csvRows.rows, { onSuccess: () => setCsvRows(null) })}>
              Importer {csvRows?.rows.length} article(s)
            </Button>
          </>
        }
      >
        {csvRows && (
          <div className="space-y-3">
            <p className="text-sm text-fg-2">
              {csvRows.rows.length} ligne(s) reconnue(s){csvRows.skipped ? `, ${csvRows.skipped} ignorée(s) (sans titre)` : ''}. Les plateformes et catégories inconnues seront
              créées automatiquement.
            </p>
            <div className="max-h-72 overflow-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Titre</th>
                    <th className="px-3 py-2 font-medium">Achat</th>
                    <th className="px-3 py-2 text-right font-medium">Prix achat</th>
                    <th className="px-3 py-2 text-right font-medium">Prix vente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {csvRows.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="max-w-64 truncate px-3 py-1.5">{r.title}</td>
                      <td className="px-3 py-1.5 text-muted">
                        {r.purchase_platform_name ?? '—'} {r.purchase_date && `· ${r.purchase_date}`}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right">{eur(r.purchase_price)}</td>
                      <td className="tabular px-3 py-1.5 text-right">{eur(r.sale_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

export function SettingsPage() {
  const lk = useLookups()
  const [tab, setTab] = useState<Tab>('general')
  if (!lk.meta) return <PageLoader />
  return (
    <div>
      <PageHeader title="Paramètres" description="Plateformes, frais, catégories, objectifs et sauvegardes." />
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'general', label: 'Général' },
          { value: 'platforms', label: 'Plateformes', count: lk.platforms.length },
          { value: 'categories', label: 'Catégories', count: lk.categories.length },
          { value: 'data', label: 'Données' },
        ]}
      />
      {tab === 'general' && <GeneralTab settings={lk.meta.settings} />}
      {tab === 'platforms' && <PlatformsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'data' && <DataTab />}
    </div>
  )
}
