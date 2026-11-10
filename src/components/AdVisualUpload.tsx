import { useCallback, useState, type DragEvent } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import type { AdVisual } from '../lib/types'
import { Button } from './ui'

interface PendingFile {
  file: File
  preview: string
  caption: string
  version_label: string
}

export function AdVisualUpload({
  existing,
  onUpload,
  onDelete,
  readOnly,
}: {
  existing: AdVisual[]
  onUpload: (file: File, meta: { caption?: string; version_label?: string }) => Promise<void>
  onDelete?: (visual: AdVisual) => Promise<void>
  readOnly?: boolean
}) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const next = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        caption: '',
        version_label: '',
      }))
    setPending((prev) => [...prev, ...next])
  }, [])

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  async function uploadAll() {
    if (!pending.length) return
    setUploading(true)
    setError(null)
    try {
      for (const item of pending) {
        await onUpload(item.file, {
          caption: item.caption || undefined,
          version_label: item.version_label || undefined,
        })
        URL.revokeObjectURL(item.preview)
      }
      setPending([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {existing.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {existing.map((v) => (
            <figure key={v.id} className="relative group overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
              <img src={v.image_url} alt={v.caption || 'Ad visual'} className="aspect-square w-full object-cover" />
              <figcaption className="p-2 text-xs text-[var(--color-ink-muted)]">
                {v.version_label && <span className="font-medium text-[var(--color-ink)]">{v.version_label} · </span>}
                {v.caption || 'No caption'}
              </figcaption>
              {!readOnly && onDelete && (
                <button
                  type="button"
                  className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition"
                  onClick={() => onDelete(v)}
                  aria-label="Delete visual"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragging ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,white)]' : 'border-[var(--color-border)] bg-white'
            }`}
          >
            <ImagePlus className="mx-auto mb-2 text-[var(--color-ink-muted)]" size={28} />
            <p className="text-sm font-medium">Drag & drop ad visuals here</p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">PNG, JPG, WEBP up to 10MB</p>
            <label className="mt-3 inline-flex cursor-pointer">
              <span className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:bg-[var(--color-surface)]">
                Browse files
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </label>
          </div>

          {pending.length > 0 && (
            <div className="space-y-3">
              {pending.map((item, idx) => (
                <div key={item.preview} className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3">
                  <img src={item.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm focus-ring"
                      placeholder="Version label (e.g. v1)"
                      value={item.version_label}
                      onChange={(e) =>
                        setPending((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, version_label: e.target.value } : p)),
                        )
                      }
                    />
                    <input
                      className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm focus-ring"
                      placeholder="Caption"
                      value={item.caption}
                      onChange={(e) =>
                        setPending((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, caption: e.target.value } : p)),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="self-start text-[var(--color-ink-muted)] hover:text-red-600"
                    onClick={() => {
                      URL.revokeObjectURL(item.preview)
                      setPending((prev) => prev.filter((_, i) => i !== idx))
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button onClick={uploadAll} disabled={uploading}>
                <Upload size={16} />
                {uploading ? 'Uploading…' : `Upload ${pending.length} file${pending.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  )
}
