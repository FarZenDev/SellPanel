import { eur, pct, signedEur } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Montant de bénéfice coloré (vert / rouge). `estimated` l'affiche en style atténué. */
export function Profit({ value, estimated, className, signed = true }: { value: number | null | undefined; estimated?: boolean; className?: string; signed?: boolean }) {
  if (value == null) return <span className={cn('text-muted', className)}>—</span>
  const tone = value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-muted'
  return (
    <span className={cn('tabular font-medium', tone, estimated && 'font-normal opacity-70', className)} title={estimated ? 'Bénéfice estimé' : undefined}>
      {estimated && '≈ '}
      {signed ? signedEur(value) : eur(value)}
    </span>
  )
}

export function Percent({ value, className, colored = true }: { value: number | null | undefined; className?: string; colored?: boolean }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn('text-muted', className)}>—</span>
  const tone = !colored ? '' : value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-muted'
  return <span className={cn('tabular', tone, className)}>{pct(value)}</span>
}
