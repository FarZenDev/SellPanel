import { X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Ajouter un tag…',
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !value.includes(t))
    if (tags.length) onChange([...value, ...tags])
    setText('')
  }
  const listId = 'tag-suggestions'
  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20',
      )}
    >
      {value.map((t) => (
        <span key={t} className="inline-flex h-6 items-center gap-1 rounded-md bg-accent-soft px-2 text-xs font-medium text-accent">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="opacity-60 hover:opacity-100" aria-label={`Retirer ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={text}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value)
          else setText(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => text && add(text)}
        className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}
