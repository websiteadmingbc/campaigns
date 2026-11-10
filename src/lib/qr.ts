import QRCode from 'qrcode'
import { DEFAULT_LANDING_BASE } from './traditionalTypes'

/** Slug for ?src= — letters/numbers only, lowercase */
export function trackingSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 64)
}

export function buildShortUrl(landingBase: string, trackingSrc: string): string {
  const base = (landingBase || DEFAULT_LANDING_BASE).trim() || DEFAULT_LANDING_BASE
  const src = trackingSlugFromName(trackingSrc || 'campaign') || 'campaign'
  if (base.endsWith('/')) return `${base}?src=${src}`
  return `${base}/?src=${src}`
}

export async function generateQrDataUrl(url: string, size = 280): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: {
      dark: '#1a1a1a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
