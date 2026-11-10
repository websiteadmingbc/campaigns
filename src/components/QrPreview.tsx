import { useEffect, useState } from 'react'
import { Download, Link2 } from 'lucide-react'
import { downloadDataUrl, generateQrDataUrl } from '../lib/qr'
import { Button, LoadingState } from './ui'

export function QrPreview({
  url,
  filename = 'qr-code.png',
}: {
  url: string
  filename?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    setError(null)
    if (!url) return
    generateQrDataUrl(url)
      .then((next) => {
        if (!cancelled) setDataUrl(next)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'QR generation failed')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  async function copyUrl() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (!url) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Add a tracking source to generate a QR code.</p>
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!dataUrl) return <LoadingState label="Generating QR…" />

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      <img
        src={dataUrl}
        alt={`QR code for ${url}`}
        className="h-44 w-44 rounded-lg border border-[var(--color-border)] bg-white p-2"
      />
      <div className="space-y-3 min-w-0 flex-1">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Short URL</p>
          <p className="mt-1 break-all text-sm font-medium">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copyUrl}>
            <Link2 size={16} />
            {copied ? 'Copied' : 'Copy URL'}
          </Button>
          <Button variant="secondary" onClick={() => downloadDataUrl(dataUrl, filename)}>
            <Download size={16} />
            Download QR
          </Button>
        </div>
      </div>
    </div>
  )
}
