import { useMemo } from 'react'
import { collectSales, componentsByBuild } from '@shared/analytics'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { useBuilds, useExpenses, useItems, useLookups, useLots } from './queries'

/** Charge toutes les données nécessaires aux vues analytiques et dérive le registre des ventes. */
export function useAllData() {
  const items = useItems()
  const builds = useBuilds()
  const expenses = useExpenses()
  const lots = useLots()
  const lookups = useLookups()
  const settings = lookups.meta?.settings ?? DEFAULT_SETTINGS
  const data = useMemo(() => {
    const i = items.data ?? []
    const b = builds.data ?? []
    return {
      items: i,
      builds: b,
      expenses: expenses.data ?? [],
      lots: lots.data ?? [],
      sales: collectSales(i, b, settings),
      components: componentsByBuild(i),
    }
  }, [items.data, builds.data, expenses.data, lots.data, settings])
  return {
    ...data,
    ...lookups,
    settings,
    isLoading: items.isLoading || builds.isLoading || expenses.isLoading || lots.isLoading || !lookups.meta,
    error: items.error || builds.error || expenses.error || lots.error,
  }
}
