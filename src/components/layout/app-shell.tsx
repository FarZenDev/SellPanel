import { BarChart3, Boxes, Cpu, LayoutDashboard, LogOut, Menu as MenuIcon, Moon, Package, Plus, Receipt, Search, Settings, ShoppingBag, Sun, Wallet } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { api } from '@/lib/api'
import { useBuilds, useItems, useMeta } from '@/lib/queries'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { useEditors } from '../editors'
import { Button } from '../ui/button'
import { Sheet } from '../ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu'
import { Kbd } from '../ui/misc'
import { CommandPalette } from './command-palette'

interface NavEntry {
  to: string
  label: string
  icon: typeof LayoutDashboard
  count?: number
  end?: boolean
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-7 rounded-lg shadow-sm shadow-accent/30" />
      <span className="text-[15px] font-semibold tracking-tight">SellPanel</span>
    </div>
  )
}

function Nav({ entries, onNavigate }: { entries: NavEntry[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {entries.map(({ to, label, icon: Icon, count, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
              isActive ? 'bg-surface text-fg shadow-sm ring-1 ring-border' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-muted group-hover:text-fg-2')} />
              <span className="flex-1 truncate">{label}</span>
              {count != null && count > 0 && <span className="tabular text-xs text-muted">{count}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Sidebar({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
  const { data: items = [] } = useItems()
  const { data: builds = [] } = useBuilds()
  const { data: meta } = useMeta()
  const [theme, setTheme] = useTheme()
  const editors = useEditors()
  const stock = items.filter((i) => ['ordered', 'in_stock', 'testing', 'listed', 'reserved'].includes(i.status)).length
  const activeBuilds = builds.filter((b) => ['planning', 'building', 'testing', 'listed', 'reserved'].includes(b.status)).length

  const main: NavEntry[] = [
    { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/items', label: 'Inventaire', icon: Package, count: stock },
    { to: '/builds', label: 'PC montés', icon: Cpu, count: activeBuilds },
    { to: '/lots', label: 'Lots & achats groupés', icon: Boxes },
    { to: '/sales', label: 'Ventes', icon: ShoppingBag },
  ]
  const finance: NavEntry[] = [
    { to: '/expenses', label: 'Dépenses', icon: Wallet },
    { to: '/reports', label: 'Rapports & fiscalité', icon: BarChart3 },
  ]

  return (
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="flex items-center justify-between px-1.5">
        <Logo />
        <Button variant="ghost" size="icon-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Changer de thème" title="Changer de thème">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>

      <div className="space-y-2">
        <Menu>
          <MenuTrigger asChild>
            <Button variant="primary" className="w-full justify-start">
              <Plus /> Nouveau…
            </Button>
          </MenuTrigger>
          <MenuContent align="start" className="w-56">
            <MenuItem
              icon={<Package />}
              onSelect={() => {
                onNavigate?.()
                editors.openItem()
              }}
              shortcut="N"
            >
              Achat (article)
            </MenuItem>
            <MenuItem
              icon={<Boxes />}
              onSelect={() => {
                onNavigate?.()
                editors.openLot()
              }}
            >
              Achat groupé / lot
            </MenuItem>
            <MenuItem
              icon={<Cpu />}
              onSelect={() => {
                onNavigate?.()
                editors.openBuild()
              }}
            >
              PC monté
            </MenuItem>
            <MenuItem
              icon={<Receipt />}
              onSelect={() => {
                onNavigate?.()
                editors.openExpense()
              }}
            >
              Dépense
            </MenuItem>
          </MenuContent>
        </Menu>
        <button
          onClick={onSearch}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-fg-2"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Rechercher…</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto">
        <Nav entries={main} onNavigate={onNavigate} />
        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-muted/80 uppercase">Finances</p>
          <Nav entries={finance} onNavigate={onNavigate} />
        </div>
      </div>

      <div className="space-y-0.5 border-t border-border pt-3">
        <Nav entries={[{ to: '/settings', label: 'Paramètres', icon: Settings }]} onNavigate={onNavigate} />
        {meta?.auth && (
          <button
            onClick={async () => {
              await api.post('/api/auth/logout')
              window.location.reload()
            }}
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="size-4" /> Déconnexion
          </button>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const editors = useEditors()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return
      if (e.key === 'n') {
        e.preventDefault()
        editors.openItem()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editors])

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-bg lg:block">
        <Sidebar onSearch={() => setPaletteOpen(true)} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur-md lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Menu">
          <MenuIcon />
        </Button>
        <Logo />
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} aria-label="Rechercher">
            <Search />
          </Button>
          <Button variant="primary" size="icon" onClick={() => editors.openItem()} aria-label="Nouvel achat">
            <Plus />
          </Button>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title="Navigation" className="p-0">
        <Sidebar
          onNavigate={() => setMobileOpen(false)}
          onSearch={() => {
            setMobileOpen(false)
            setPaletteOpen(true)
          }}
        />
      </Sheet>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
