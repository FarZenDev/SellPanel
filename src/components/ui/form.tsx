import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { parseNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg border border-border bg-surface text-sm text-fg placeholder:text-muted/70 outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-9 px-3', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-20 px-3 py-2 leading-relaxed', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className={cn('relative', className)}>
    <select ref={ref} className={cn(fieldBase, 'h-9 appearance-none pr-8 pl-3')} {...props}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" />
  </div>
))
Select.displayName = 'Select'

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  action,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
  htmlFor?: string
  action?: ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg-2">
              {label}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? <p className="text-xs text-negative">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null | undefined
  onValueChange: (v: number | null) => void
  suffix?: string
}

/** Saisie numérique tolérante (virgule ou point), avec suffixe (€, W, Go…). */
export function NumberInput({ value, onValueChange, suffix = '€', className, ...props }: NumberInputProps) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value).replace('.', ','))
  }, [value, focused])
  return (
    <div className={cn('relative', className)}>
      <input
        inputMode="decimal"
        className={cn(fieldBase, 'tabular h-9 px-3', suffix && 'pr-8')}
        value={text}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          onValueChange(parseNumber(e.target.value))
        }}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2.5 text-sm select-none', disabled && 'opacity-50')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          checked ? 'bg-accent' : 'bg-surface-3 ring-1 ring-border-strong ring-inset',
        )}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
      {label}
    </label>
  )
}

export function Checkbox({
  checked,
  onChange,
  className,
  indeterminate,
  ...props
}: {
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
  indeterminate?: boolean
  'aria-label'?: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={cn('size-4 shrink-0 cursor-pointer rounded border-border-strong accent-[var(--accent)]', className)}
      {...props}
    />
  )
}
