import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import type { AppEvent, Build, BuildDetail, Category, Expense, Item, ItemDetail, Lot, LotDetail, Meta, Platform } from '@shared/types'
import { api } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/api/meta') })
export const useItems = () => useQuery({ queryKey: ['items'], queryFn: () => api.get<Item[]>('/api/items') })
export const useItem = (id: number) => useQuery({ queryKey: ['item', id], queryFn: () => api.get<ItemDetail>(`/api/items/${id}`), enabled: id > 0 })
export const useBuilds = () => useQuery({ queryKey: ['builds'], queryFn: () => api.get<Build[]>('/api/builds') })
export const useBuild = (id: number) => useQuery({ queryKey: ['build', id], queryFn: () => api.get<BuildDetail>(`/api/builds/${id}`), enabled: id > 0 })
export const useLots = () => useQuery({ queryKey: ['lots'], queryFn: () => api.get<Lot[]>('/api/lots') })
export const useLot = (id: number) => useQuery({ queryKey: ['lot', id], queryFn: () => api.get<LotDetail>(`/api/lots/${id}`), enabled: id > 0 })
export const useExpenses = () => useQuery({ queryKey: ['expenses'], queryFn: () => api.get<Expense[]>('/api/expenses') })
export const useEvents = (limit = 30) => useQuery({ queryKey: ['events', limit], queryFn: () => api.get<AppEvent[]>(`/api/events?limit=${limit}`) })

export function invalidateAll() {
  return queryClient.invalidateQueries()
}

/** Mutation générique : invalide tout le cache au succès et affiche les erreurs. */
export function useAction<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, opts: { success?: string | ((r: TResult) => string); silent?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries()
      const msg = typeof opts.success === 'function' ? opts.success(result) : opts.success
      if (msg) toast.success(msg)
    },
    onError: (err: Error) => {
      if (!opts.silent) toast.error(err.message)
    },
  })
}

export interface Lookups {
  platforms: Platform[]
  activePlatforms: Platform[]
  categories: Category[]
  platform: (id: number | null | undefined) => Platform | undefined
  category: (id: number | null | undefined) => Category | undefined
}

export function useLookups(): Lookups & { meta: Meta | undefined } {
  const { data: meta } = useMeta()
  return useMemo(() => {
    const platforms = meta?.platforms ?? []
    const categories = meta?.categories ?? []
    const pMap = new Map(platforms.map((p) => [p.id, p]))
    const cMap = new Map(categories.map((c) => [c.id, c]))
    return {
      meta,
      platforms,
      activePlatforms: platforms.filter((p) => !p.archived),
      categories,
      platform: (id) => (id == null ? undefined : pMap.get(id)),
      category: (id) => (id == null ? undefined : cMap.get(id)),
    }
  }, [meta])
}
