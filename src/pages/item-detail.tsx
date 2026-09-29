import { ArrowLeft, ArrowRight, Boxes, Check, Copy, Cpu, ExternalLink, MoreHorizontal, Package, PackageCheck, Pencil, ShoppingCart, Tag, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { buildMetrics, daysBetween, itemMetrics, round2, todayISO } from '@shared/calc'
import { CONDITIONS, ITEM_STATUSES, SLOT_SPECS } from '@shared/constants'
import { itemListing } from '@shared/listing'
import type { Item, ItemStatus } from '@shared/types'
import { BuildStatusBadge, ItemStatusBadge, PlatformTag } from '@/components/badges'
import { useEditors } from '@/components/editors'
import { MarketLinks } from '@/components/market-links'
import { Profit } from '@/components/money'
import { PhotoGallery } from '@/components/photos'
import { StatLine } from '@/components/stats'
import { Timeline } from '@/components/timeline'
import { toneClasses } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/dialog'
import { Switch, Textarea } from '@/components/ui/form'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, PageLoader } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { eur, fmtDate, fmtDays, pct } from '@/lib/format'
import { useAction, useBuild, useItem, useLookups, useLots } from '@/lib/queries'
import { cn, copyText } from '@/lib/utils'

function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{children ?? <span className="text-muted">—</span>}</dd>
    </div>
  )
}

function BuildBanner({ buildId }: { buildId: number }) {
  const { data: build } = useBuild(buildId)
  const lk = useLookups()
  if (!build) return <div className="h-24 animate-pulse rounded-xl bg-surface-3" />
  const m = buildMetrics(build, build.components, lk.meta?.settings ?? { hourly_rate: 0 }, lk.platforms)
  return (
    <Link to={`/builds/${build.id}`} className="group block">
      <Card className="relative overflow-hidden border-accent/30 transition-shadow group-hover:shadow-lg group-hover:shadow-accent/10">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/12 via-accent/5 to-transparent" />
        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-lg shadow-accent/30">
            <Cpu className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-accent uppercase">Intégré dans un PC monté</p>
            <p className="mt-0.5 truncate text-base font-semibold">
              {build.ref} · {build.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <BuildStatusBadge status={build.status} />
              <span>{m.componentCount} pièces</span>
              <span>
                Coût total <strong className="tabular text-fg-2">{eur(m.totalCost)}</strong>
              </span>
              {m.price != null && (
                <span>
                  {m.sold ? 'Vendu' : 'Prix'} <strong className="tabular text-fg-2">{eur(m.price)}</strong>
                </span>
              )}
              {m.profit != null && <Profit value={m.profit} estimated={!m.sold} />}
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            Voir la fiche du PC <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </Link>
  )
}

/** Prix de vente P tel que P − frais(P) − envoi = objectif. */
function priceFor(targetNet: number, pctFee: number, fixed: number, shipping: number) {
  const denom = 1 - pctFee / 100
  return denom > 0 ? round2((targetNet + fixed + shipping) / denom) : null
}

export function ItemDetailPage() {
  const id = Number(useParams().id)
  const { data: item, isLoading, error } = useItem(id)
  const { data: lots = [] } = useLots()
  const lk = useLookups()
  const editors = useEditors()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [emojis, setEmojis] = useState(true)

  const remove = useAction(() => api.del(`/api/items/${id}`), { success: 'Article supprimé' })
  const duplicate = useAction(() => api.post<Item>(`/api/items/${id}/duplicate`), { success: 'Article dupliqué' })
  const patch = useAction((body: Partial<Item>) => api.patch<Item>(`/api/items/${id}`, body), { success: 'Article mis à jour' })

  const m = useMemo(() => (item ? itemMetrics(item, lk.platforms) : null), [item, lk.platforms])

  if (isLoading) return <PageLoader />
  if (error || !item || !m)
    return (
      <EmptyState
        icon={<Package />}
        title="Article introuvable"
        action={
          <Link to="/items">
            <Button>Retour à l’inventaire</Button>
          </Link>
        }
      />
    )

  const cat = lk.category(item.category_id)
  const buyP = lk.platform(item.purchase_platform_id)
  const saleP = lk.platform(item.sale_platform_id)
  const lot = lots.find((l) => l.id === item.lot_id)
  const specFields = cat?.slot ? SLOT_SPECS[cat.slot] : []
  const listing = itemListing(item, cat, { emojis })
  const inBuild = item.build_id != null
  const listedDays = item.status === 'listed' ? daysBetween(item.listed_date, todayISO()) : null

  const pctFee = saleP?.sale_fee_percent ?? 0
  const fixedFee = saleP?.sale_fee_fixed ?? 0
  const floors = [
    { label: 'Prix plancher (0 € de bénéfice)', price: priceFor(m.cost, pctFee, fixedFee, 0) },
    { label: 'Pour +20 % de ROI', price: priceFor(m.cost * 1.2, pctFee, fixedFee, 0) },
    { label: 'Pour +35 % de ROI', price: priceFor(m.cost * 1.35, pctFee, fixedFee, 0) },
    { label: 'Pour +50 % de ROI', price: priceFor(m.cost * 1.5, pctFee, fixedFee, 0) },
  ]

  return (
    <div className="space-y-5">
      <div>
        <Link to="/items" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Inventaire
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <ItemStatusBadge status={item.status} />
              <span className="text-sm text-muted">{item.sku}</span>
              {cat && <span className="text-sm text-muted">· {cat.name}</span>}
              {item.condition && <span className="text-sm text-muted">· {CONDITIONS.find((c) => c.value === item.condition)?.label}</span>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight break-words">{item.title}</h1>
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <Link key={t} to={`/items?status=all&q=${encodeURIComponent(t)}`} className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!inBuild && item.status !== 'sold' && (
              <>
                <Button variant="outline" onClick={() => editors.openList({ kind: 'item', item, cost: m.cost })}>
                  <Tag /> {item.status === 'listed' ? 'Modifier l’annonce' : 'Mettre en vente'}
                </Button>
                <Button variant="success" onClick={() => editors.openSell({ kind: 'item', item, cost: m.cost })}>
                  <ShoppingCart /> Vendu
                </Button>
              </>
            )}
            {item.status === 'sold' && !item.shipped_date && (
              <Button variant="outline" loading={patch.isPending} onClick={() => patch.mutate({ shipped_date: todayISO() })}>
                <PackageCheck /> Marquer expédié
              </Button>
            )}
            <Button variant="primary" onClick={() => editors.openItem(item)}>
              <Pencil /> Modifier
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Plus d’actions">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                {!inBuild && (
                  <>
                    <MenuLabel>Changer le statut</MenuLabel>
                    {ITEM_STATUSES.filter((s) => !['in_build', 'sold', item.status].includes(s.value)).map((s) => (
                      <MenuItem
                        key={s.value}
                        onSelect={() => patch.mutate({ status: s.value as ItemStatus })}
                        icon={<span className={cn('block size-2 rounded-full', toneClasses[s.tone].dot)} />}
                      >
                        {s.label}
                      </MenuItem>
                    ))}
                    <MenuSeparator />
                  </>
                )}
                <MenuItem icon={<Copy />} onSelect={() => duplicate.mutate(undefined, { onSuccess: (r) => navigate(`/items/${(r as Item).id}`) })}>
                  Dupliquer
                </MenuItem>
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: 'Supprimer cet article ?',
                        description: 'L’article, ses photos et son historique seront supprimés définitivement.',
                        confirmLabel: 'Supprimer',
                        danger: true,
                      })
                    )
                      remove.mutate(undefined, { onSuccess: () => navigate('/items') })
                  }}
                >
                  Supprimer
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </div>

      {inBuild && <BuildBanner buildId={item.build_id!} />}
      {lot && (
        <Link to={`/lots/${lot.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-accent/40">
          <Boxes className="size-5 text-accent" />
          <span className="flex-1">
            Issu du lot <strong>« {lot.name} »</strong> — coût réparti{' '}
            {lot.allocation === 'value' ? 'au prorata de la valeur' : lot.allocation === 'equal' ? 'à parts égales' : 'manuellement'}.
          </span>
          <ArrowRight className="size-4 text-muted" />
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {item.photos.length > 0 ? (
            <Card className="p-3">
              <PhotoGallery photos={item.photos} />
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Achat"
              action={
                item.purchase_url ? (
                  <a href={item.purchase_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    Voir l’annonce <ExternalLink className="size-3" />
                  </a>
                ) : undefined
              }
            />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                <Info label="Plateforme">{buyP ? <PlatformTag platform={buyP} /> : null}</Info>
                <Info label="Date d’achat">{item.purchase_date ? fmtDate(item.purchase_date) : null}</Info>
                <Info label="Reçu le">{item.received_date ? fmtDate(item.received_date) : null}</Info>
                <Info label="Vendeur">{item.seller}</Info>
                <Info label="Prix payé">
                  <span className="tabular">{eur(item.purchase_price)}</span>
                </Info>
                <Info label="Frais de port">
                  <span className="tabular">{eur(item.purchase_shipping)}</span>
                </Info>
                <Info label="Protection acheteur">
                  <span className="tabular">{eur(item.purchase_fees)}</span>
                </Info>
                <Info label="Réparations / pièces">
                  <span className="tabular">{eur(item.extra_costs)}</span>
                </Info>
                <Info label="Réf. commande">{item.order_ref}</Info>
                <Info label="Emplacement">{item.location}</Info>
                <Info label="N° de série">{item.serial_number}</Info>
                <Info label="Garantie jusqu’au">{item.warranty_until ? fmtDate(item.warranty_until) : null}</Info>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Revente" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                <Info label="Prix visé">
                  <span className="tabular">{eur(item.target_price)}</span>
                </Info>
                <Info label="Prix affiché">
                  <span className="tabular">{eur(item.listed_price)}</span>
                </Info>
                <Info label={m.sold ? 'Vendu sur' : 'En vente sur'}>{saleP ? <PlatformTag platform={saleP} /> : null}</Info>
                <Info label="Mis en vente le">{item.listed_date ? `${fmtDate(item.listed_date)}${listedDays != null ? ` (${fmtDays(listedDays)})` : ''}` : null}</Info>
                {(m.sold || item.status === 'returned') && (
                  <>
                    <Info label="Prix de vente">
                      <span className="tabular font-medium">{eur(item.sale_price)}</span>
                    </Info>
                    <Info label="Date de vente">{item.sale_date ? fmtDate(item.sale_date) : null}</Info>
                    <Info label="Acheteur">{item.buyer}</Info>
                    <Info label="Expédition">
                      {item.shipped_date ? `${fmtDate(item.shipped_date)}${item.tracking_number ? ` · ${item.tracking_number}` : ''}` : item.tracking_number}
                    </Info>
                  </>
                )}
              </dl>
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-muted">Vérifier la cote du marché</p>
                <MarketLinks query={item.model ? `${item.brand ?? ''} ${item.model}` : item.title} platforms={lk.platforms} />
              </div>
            </CardBody>
          </Card>

          {specFields.length > 0 && Object.keys(item.specs).length > 0 && (
            <Card>
              <CardHeader title="Caractéristiques" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                  {specFields
                    .filter((f) => item.specs[f.key] != null)
                    .map((f) => {
                      const v = item.specs[f.key]
                      return (
                        <Info key={f.key} label={f.label}>
                          {typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : `${v}${f.unit ? ` ${f.unit}` : ''}`}
                        </Info>
                      )
                    })}
                </dl>
              </CardBody>
            </Card>
          )}

          {!inBuild && item.status !== 'sold' && (
            <Card>
              <CardHeader
                title="Texte d’annonce"
                description="Généré à partir de la fiche — à coller sur Vinted, Leboncoin ou eBay."
                action={
                  <>
                    <Switch checked={emojis} onChange={setEmojis} label={<span className="text-xs text-muted">Emojis</span>} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (await copyText(listing)) toast.success('Annonce copiée')
                      }}
                    >
                      <Copy /> Copier
                    </Button>
                  </>
                }
              />
              <CardBody>
                <Textarea readOnly value={listing} rows={Math.min(10, listing.split('\n').length + 1)} className="font-mono text-[13px]" />
              </CardBody>
            </Card>
          )}

          {item.notes && (
            <Card>
              <CardHeader title="Notes privées" />
              <CardBody>
                <p className="text-sm whitespace-pre-wrap text-fg-2">{item.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Rentabilité"
              description={inBuild ? 'Coût intégré au PC : la rentabilité se lit sur sa fiche.' : m.sold ? 'Vente réalisée' : 'Estimation au prix affiché ou visé'}
            />
            <CardBody>
              {inBuild ? (
                <>
                  <StatLine label="Prix d’achat" value={eur(item.purchase_price)} />
                  {item.purchase_shipping > 0 && <StatLine label="+ Port" value={eur(item.purchase_shipping)} muted />}
                  {item.purchase_fees > 0 && <StatLine label="+ Protection acheteur" value={eur(item.purchase_fees)} muted />}
                  {item.extra_costs > 0 && <StatLine label="+ Réparations" value={eur(item.extra_costs)} muted />}
                  <StatLine label="= Coût intégré au PC" value={eur(m.cost)} strong className="border-t border-border" />
                  <StatLine label="Valeur si revendue seule" value={eur(item.target_price ?? item.listed_price)} muted />
                  <Link to={`/builds/${item.build_id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    Voir la rentabilité du PC <ArrowRight className="size-4" />
                  </Link>
                </>
              ) : m.sold ? (
                <>
                  <StatLine label="Prix de vente" value={eur(item.sale_price)} />
                  <StatLine label="− Frais plateforme" value={eur(-item.sale_fees)} muted />
                  <StatLine label="− Envoi à ma charge" value={eur(-item.sale_shipping)} muted />
                  <StatLine label="= Net encaissé" value={eur(m.net)} className="border-t border-border" />
                </>
              ) : (
                <>
                  <StatLine label={item.listed_price != null ? 'Prix affiché' : 'Prix visé'} value={eur(m.expectedPrice)} />
                </>
              )}
              {!inBuild && (
                <>
                  <StatLine label="− Prix d’achat" value={eur(-item.purchase_price)} muted />
                  {item.purchase_shipping > 0 && <StatLine label="− Port" value={eur(-item.purchase_shipping)} muted />}
                  {item.purchase_fees > 0 && <StatLine label="− Protection acheteur" value={eur(-item.purchase_fees)} muted />}
                  {item.extra_costs > 0 && <StatLine label="− Réparations" value={eur(-item.extra_costs)} muted />}
                  <div className="mt-2 flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2.5">
                    <span className="text-sm font-medium">{m.sold ? 'Bénéfice' : 'Bénéfice estimé'}</span>
                    <Profit value={m.sold ? m.profit : m.expectedProfit} className="text-lg font-semibold" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border px-2 py-2">
                      <p className="text-[11px] text-muted">Marge</p>
                      <p className="tabular text-sm font-semibold">{pct(m.sold ? m.margin : m.expectedPrice ? (m.expectedProfit ?? 0) / m.expectedPrice : null)}</p>
                    </div>
                    <div className="rounded-lg border border-border px-2 py-2">
                      <p className="text-[11px] text-muted">ROI</p>
                      <p className="tabular text-sm font-semibold">{pct(m.sold ? m.roi : m.expectedRoi)}</p>
                    </div>
                    <div className="rounded-lg border border-border px-2 py-2">
                      <p className="text-[11px] text-muted">{m.sold ? 'Vendu en' : 'En stock depuis'}</p>
                      <p className="tabular text-sm font-semibold">{fmtDays(m.sold ? m.daysToSell : m.daysHeld)}</p>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {!m.sold && !inBuild && m.cost > 0 && (
            <Card>
              <CardHeader title="Aide au prix" description={saleP && (pctFee || fixedFee) ? `Frais ${saleP.name} inclus` : 'Prix de vente nécessaires'} />
              <CardBody className="space-y-0.5">
                {floors.map((f) => (
                  <StatLine key={f.label} label={f.label} value={<span className="font-medium">{eur(f.price)}</span>} />
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Historique" />
            <CardBody>
              <Timeline events={item.events} />
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <Check className="size-3.5" /> Créé le {fmtDate(item.created_at)}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
