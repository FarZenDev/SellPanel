import { useState } from 'react'
import { SLOT_SPECS } from '@shared/constants'
import type { Category, PcSlot, Platform, Specs } from '@shared/types'
import { api } from '@/lib/api'
import { useAction, useLookups } from '@/lib/queries'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, NumberInput, Select, Switch } from './ui/form'

const NEW = '__new__'
const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b']

export function PlatformSelect({
  value,
  onChange,
  placeholder = '— Choisir —',
  id,
}: {
  value: number | null | undefined
  onChange: (id: number | null) => void
  placeholder?: string
  id?: string
}) {
  const { platforms } = useLookups()
  const [creating, setCreating] = useState(false)
  const visible = platforms.filter((p) => !p.archived || p.id === value)
  return (
    <>
      <Select
        id={id}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW) setCreating(true)
          else onChange(e.target.value ? Number(e.target.value) : null)
        }}
      >
        <option value="">{placeholder}</option>
        {visible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.archived ? ' (archivée)' : ''}
          </option>
        ))}
        <option value={NEW}>＋ Nouvelle plateforme…</option>
      </Select>
      <QuickPlatformDialog open={creating} onOpenChange={setCreating} onCreated={(p) => onChange(p.id)} />
    </>
  )
}

export function QuickPlatformDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (p: Platform) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [url, setUrl] = useState('')
  const create = useAction((body: Partial<Platform>) => api.post<Platform>('/api/platforms', body), { success: (p) => `Plateforme « ${p.name} » ajoutée` })
  const submit = () => {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), color, url: url.trim() || null },
      {
        onSuccess: (p) => {
          onCreated?.(p)
          onOpenChange(false)
          setName('')
          setUrl('')
        },
      },
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouvelle plateforme"
      description="Site d’achat ou de revente (Back Market, Rakuten, forum HFR…). Les frais se règlent ensuite dans Paramètres."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit} loading={create.isPending} disabled={!name.trim()}>
            Ajouter
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Nom">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Back Market" />
        </Field>
        <Field label="Site web" hint="Optionnel">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="size-7 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
      </form>
    </Dialog>
  )
}

export function CategorySelect({
  value,
  onChange,
  id,
  placeholder = '— Aucune —',
}: {
  value: number | null | undefined
  onChange: (id: number | null) => void
  id?: string
  placeholder?: string
}) {
  const { categories } = useLookups()
  const pc = categories.filter((c) => c.slot)
  const other = categories.filter((c) => !c.slot)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const create = useAction((body: Partial<Category>) => api.post<Category>('/api/categories', body), { success: 'Catégorie ajoutée' })
  return (
    <>
      <Select
        id={id}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW) setCreating(true)
          else onChange(e.target.value ? Number(e.target.value) : null)
        }}
      >
        <option value="">{placeholder}</option>
        <optgroup label="Composants PC">
          {pc.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Autres">
          {other.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <option value={NEW}>＋ Nouvelle catégorie…</option>
      </Select>
      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nouvelle catégorie"
        size="sm"
        footer={
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() =>
              create.mutate(
                { name: name.trim(), color: '#64748b' },
                {
                  onSuccess: (c) => {
                    onChange(c.id)
                    setCreating(false)
                    setName('')
                  },
                },
              )
            }
          >
            Ajouter
          </Button>
        }
      >
        <Field label="Nom">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tablette" />
        </Field>
      </Dialog>
    </>
  )
}

export function SpecFields({ slot, value, onChange }: { slot: PcSlot; value: Specs; onChange: (v: Specs) => void }) {
  const fields = SLOT_SPECS[slot]
  if (!fields.length) return <p className="text-sm text-muted">Pas de caractéristiques particulières pour cette catégorie.</p>
  const set = (key: string, v: string | number | boolean | null) => {
    const next = { ...value }
    if (v === null || v === '') delete next[key]
    else next[key] = v
    onChange(next)
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.type === 'select' ? (
            <Select value={String(value[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value || null)}>
              <option value="">—</option>
              {f.options!.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : f.type === 'number' ? (
            <NumberInput value={typeof value[f.key] === 'number' ? (value[f.key] as number) : null} onValueChange={(v) => set(f.key, v)} suffix={f.unit ?? ''} />
          ) : f.type === 'bool' ? (
            <div className="flex h-9 items-center">
              <Switch checked={value[f.key] === true} onChange={(v) => set(f.key, v)} label={<span className="text-muted">{value[f.key] === true ? 'Oui' : 'Non'}</span>} />
            </div>
          ) : (
            <Input value={String(value[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value || null)} />
          )}
        </Field>
      ))}
    </div>
  )
}
