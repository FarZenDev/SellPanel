import * as D from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { BarChart3, Boxes, Cpu, LayoutDashboard, Moon, Package, Plus, Receipt, Settings, ShoppingBag, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router'
import { itemCost } from '@shared/calc'
import { eur } from '@/lib/format'
import { useBuilds, useItems, useLots } from '@/lib/queries'
import { useTheme } from '@/lib/theme'
import { BuildStatusBadge, ItemStatusBadge } from '../badges'
import { useEditors } from '../editors'

const itemCls =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-fg [&_svg]:size-4 [&_svg]:text-muted'
const groupCls =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase'

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const editors = useEditors()
  const [theme, setTheme] = useTheme()
  const { data: items = [] } = useItems()
  const { data: builds = [] } = useBuilds()
  const { data: lots = [] } = useLots()

  const run = (fn: () => void) => {
    onOpenChange(false)
    setTimeout(fn, 0)
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <D.Content className="animate-fade-in fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <D.Title className="sr-only">Recherche et commandes</D.Title>
          <D.Description className="sr-only">Rechercher un article, un PC, un lot ou lancer une action</D.Description>
          <Command
            filter={(value, search, keywords) => {
              const hay = `${value} ${(keywords ?? []).join(' ')}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
              const terms = search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean)
              return terms.every((t) => hay.includes(t)) ? 1 : 0
            }}
          >
            <Command.Input
              autoFocus
              placeholder="Rechercher un article, un SKU, un PC… ou une action"
              className="h-12 w-full border-b border-border bg-transparent px-4 text-[15px] outline-none placeholder:text-muted"
            />
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">Aucun résultat.</Command.Empty>
              <Command.Group heading="Actions" className={groupCls}>
                <Command.Item className={itemCls} onSelect={() => run(() => editors.openItem())} keywords={['ajouter', 'acheter', 'article']}>
                  <Plus /> Nouvel achat
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => editors.openLot())} keywords={['lot', 'groupé', 'démonter']}>
                  <Boxes /> Nouvel achat groupé / lot
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => editors.openBuild())} keywords={['pc', 'build', 'monter']}>
                  <Cpu /> Nouveau PC monté
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => editors.openExpense())} keywords={['frais', 'dépense']}>
                  <Receipt /> Nouvelle dépense
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))} keywords={['thème', 'sombre', 'clair', 'dark']}>
                  <Moon /> Basculer le thème {theme === 'dark' ? 'clair' : 'sombre'}
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Navigation" className={groupCls}>
                {[
                  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
                  { to: '/items', label: 'Inventaire', icon: Package },
                  { to: '/builds', label: 'PC montés', icon: Cpu },
                  { to: '/lots', label: 'Lots', icon: Boxes },
                  { to: '/sales', label: 'Ventes', icon: ShoppingBag },
                  { to: '/expenses', label: 'Dépenses', icon: Wallet },
                  { to: '/reports', label: 'Rapports & fiscalité', icon: BarChart3 },
                  { to: '/settings', label: 'Paramètres', icon: Settings },
                ].map(({ to, label, icon: Icon }) => (
                  <Command.Item key={to} className={itemCls} value={`aller ${label}`} onSelect={() => run(() => navigate(to))}>
                    <Icon /> {label}
                  </Command.Item>
                ))}
              </Command.Group>
              {builds.length > 0 && (
                <Command.Group heading="PC montés" className={groupCls}>
                  {builds.map((b) => (
                    <Command.Item
                      key={`b${b.id}`}
                      className={itemCls}
                      value={`pc ${b.ref} ${b.name}`}
                      keywords={[b.usage ?? '']}
                      onSelect={() => run(() => navigate(`/builds/${b.id}`))}
                    >
                      <Cpu />
                      <span className="flex-1 truncate">
                        <span className="mr-2 text-xs text-muted">{b.ref}</span>
                        {b.name}
                      </span>
                      <BuildStatusBadge status={b.status} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {lots.length > 0 && (
                <Command.Group heading="Lots" className={groupCls}>
                  {lots.map((l) => (
                    <Command.Item key={`l${l.id}`} className={itemCls} value={`lot ${l.name}`} onSelect={() => run(() => navigate(`/lots/${l.id}`))}>
                      <Boxes />
                      <span className="flex-1 truncate">{l.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Articles" className={groupCls}>
                {items.map((i) => (
                  <Command.Item
                    key={`i${i.id}`}
                    className={itemCls}
                    value={`${i.sku} ${i.title}`}
                    keywords={[i.brand ?? '', i.model ?? '', i.location ?? '', i.serial_number ?? '', ...i.tags]}
                    onSelect={() => run(() => navigate(`/items/${i.id}`))}
                  >
                    <Package />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="mr-2 text-xs text-muted">{i.sku}</span>
                      {i.title}
                    </span>
                    <span className="tabular hidden text-xs text-muted sm:inline">{eur(itemCost(i))}</span>
                    <ItemStatusBadge status={i.status} />
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
