import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Build, Expense, Item, Lot } from '@shared/types'
import { BuildForm, ExpenseForm, LotForm } from './entity-forms'
import { ItemForm, type ItemDraft } from './item-form'
import { ListDialog, SellDialog, type ListTarget, type SaleTarget } from './quick-dialogs'

interface Editors {
  openItem: (item?: Item | null, defaults?: ItemDraft) => void
  openSell: (target: SaleTarget) => void
  openList: (target: ListTarget) => void
  openBuild: (build?: Build | null) => void
  openLot: (lot?: Lot | null) => void
  openExpense: (expense?: Expense | null) => void
}

const Ctx = createContext<Editors | null>(null)

/** Point d'entrée unique des formulaires (accessibles depuis n'importe quelle page et la palette de commandes). */
export function EditorsProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<{ item: Item | null; defaults?: ItemDraft } | null>(null)
  const [sell, setSell] = useState<SaleTarget | null>(null)
  const [list, setList] = useState<ListTarget | null>(null)
  const [build, setBuild] = useState<{ build: Build | null } | null>(null)
  const [lot, setLot] = useState<{ lot: Lot | null } | null>(null)
  const [expense, setExpense] = useState<{ expense: Expense | null } | null>(null)

  const openItem = useCallback((i?: Item | null, defaults?: ItemDraft) => setItem({ item: i ?? null, defaults }), [])
  const value = useMemo<Editors>(
    () => ({
      openItem,
      openSell: setSell,
      openList: setList,
      openBuild: (b) => setBuild({ build: b ?? null }),
      openLot: (l) => setLot({ lot: l ?? null }),
      openExpense: (e) => setExpense({ expense: e ?? null }),
    }),
    [openItem],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <ItemForm open={!!item} onOpenChange={(o) => !o && setItem(null)} item={item?.item} defaults={item?.defaults} />
      <SellDialog target={sell} onOpenChange={(o) => !o && setSell(null)} />
      <ListDialog target={list} onOpenChange={(o) => !o && setList(null)} />
      <BuildForm open={!!build} onOpenChange={(o) => !o && setBuild(null)} build={build?.build} />
      <LotForm open={!!lot} onOpenChange={(o) => !o && setLot(null)} lot={lot?.lot} />
      <ExpenseForm open={!!expense} onOpenChange={(o) => !o && setExpense(null)} expense={expense?.expense} />
    </Ctx.Provider>
  )
}

export function useEditors() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEditors doit être utilisé dans EditorsProvider')
  return ctx
}
