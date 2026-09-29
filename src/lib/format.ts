const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eur0Fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
const pctFmt = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })
const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const dateShortFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Montant en euros (1 234,56 €). */
export const eur = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : eurFmt.format(n === 0 ? 0 : n))
/** Montant arrondi à l'euro, pour les grands totaux. */
export const eur0 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : eur0Fmt.format(Math.round(n) === 0 ? 0 : n))
export const eurCompact = (n: number) => (Math.abs(n) >= 10_000 ? `${compactFmt.format(n)} €` : eur0Fmt.format(n))
export const signedEur = (n: number | null | undefined) => (n == null ? '—' : `${n > 0 ? '+' : ''}${eurFmt.format(n)}`)
export const pct = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : pctFmt.format(n))
export const num = (n: number | null | undefined) => (n == null ? '—' : numFmt.format(n))

const parse = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d)
export const fmtDate = (d: string | null | undefined) => (d ? dateFmt.format(parse(d)) : '—')
export const fmtDateShort = (d: string | null | undefined) => (d ? dateShortFmt.format(parse(d)) : '—')
export const fmtDateTime = (d: string | null | undefined) => (d ? dateTimeFmt.format(parse(d)) : '—')

export function fmtDays(days: number | null | undefined): string {
  if (days == null) return '—'
  if (days === 0) return 'auj.'
  if (days < 60) return `${days} j`
  const months = days / 30.4
  return months < 24 ? `${numFmt.format(Math.round(months * 10) / 10)} mois` : `${numFmt.format(Math.round((days / 365) * 10) / 10)} ans`
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - parse(iso).getTime()) / 1000
  if (diff < 60) return 'à l’instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`
  return fmtDate(iso)
}

/** Analyse une saisie « 12,50 » ou « 12.5 » en nombre. */
export function parseNumber(v: string): number | null {
  const clean = v.replace(/\s/g, '').replace('€', '').replace(',', '.')
  if (clean === '' || clean === '-') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}
