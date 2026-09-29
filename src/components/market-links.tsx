import { ExternalLink } from 'lucide-react'
import type { Platform } from '@shared/types'
import { searchUrl } from '@/lib/utils'
import { PlatformDot } from './badges'

const EXTRA = [{ name: 'LeDénicheur (prix neuf)', color: '#10b981', search_url: 'https://ledenicheur.fr/search?search={q}' }]

/** Liens de recherche rapide pour estimer le prix du marché (annonces actives / ventes réussies). */
export function MarketLinks({ query, platforms }: { query: string; platforms: Platform[] }) {
  const q = query.trim()
  if (!q) return null
  const sources = [...platforms.filter((p) => p.search_url && !p.archived), ...EXTRA]
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((p) => {
        const url = searchUrl(p.search_url, q)
        if (!url) return null
        return (
          <a
            key={p.name}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-xs text-fg-2 transition-colors hover:border-border-strong hover:text-fg"
          >
            <PlatformDot color={p.color} />
            {p.name === 'eBay' ? 'eBay (vendus)' : p.name}
            <ExternalLink className="size-3 text-muted" />
          </a>
        )
      })}
    </div>
  )
}
