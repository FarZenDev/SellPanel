import { api } from './api'

/** Redimensionne une photo côté navigateur (max 1600 px, JPEG) avant l'envoi. */
async function resize(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 900_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85))
  } catch {
    return file
  }
}

export async function uploadPhotos(files: File[]): Promise<string[]> {
  const form = new FormData()
  for (const f of files) {
    const blob = await resize(f)
    const name = blob === f ? f.name : f.name.replace(/\.\w+$/, '') + '.jpg'
    form.append('files', blob, name)
  }
  const { files: names } = await api.upload(form)
  return names
}
