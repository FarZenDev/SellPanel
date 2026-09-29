import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { photoUrl } from '@/lib/api'
import { uploadPhotos } from '@/lib/images'
import { cn } from '@/lib/utils'

export function PhotoUploader({ value, onChange, max = 20 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  const add = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, max - value.length)
    if (!list.length) return
    setBusy(true)
    try {
      const names = await uploadPhotos(list)
      onChange([...value, ...names])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void add(e.dataTransfer.files)
      }}
      className={cn('grid grid-cols-3 gap-2 rounded-xl sm:grid-cols-5', drag && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
    >
      {value.map((p, i) => (
        <div key={p} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
          <img src={photoUrl(p)} alt="" className="size-full object-cover" loading="lazy" />
          {i === 0 && <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Couverture</span>}
          <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {i > 0 && (
              <button
                type="button"
                title="Définir comme couverture"
                onClick={() => onChange([p, ...value.filter((x) => x !== p)])}
                className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <Star className="size-3.5" />
              </button>
            )}
            <button type="button" title="Retirer" onClick={() => onChange(value.filter((x) => x !== p))} className="rounded-md bg-black/60 p-1 text-white hover:bg-negative">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? 'Envoi…' : 'Ajouter'}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void add(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function PhotoGallery({ photos, className }: { photos: string[]; className?: string }) {
  const [active, setActive] = useState(0)
  if (!photos.length) return null
  const current = photos[Math.min(active, photos.length - 1)]
  return (
    <div className={cn('space-y-2', className)}>
      <a href={photoUrl(current)} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface-2">
        <img src={photoUrl(current)} alt="" className="size-full object-contain" />
      </a>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setActive(i)}
              className={cn('size-14 shrink-0 overflow-hidden rounded-lg border-2', i === active ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <img src={photoUrl(p)} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Thumb({ photo, className, fallback }: { photo?: string; className?: string; fallback?: React.ReactNode }) {
  return (
    <div className={cn('flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-muted [&_svg]:size-4', className)}>
      {photo ? <img src={photoUrl(photo)} alt="" className="size-full object-cover" loading="lazy" /> : fallback}
    </div>
  )
}
