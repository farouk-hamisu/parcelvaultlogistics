import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...args: ClassValue[]) {
  return twMerge(clsx(args))
}

export function fmtMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0)
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`
  }
}

export function fmtDate(d?: string | Date | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', opts).format(date)
}

export function fmtDateTime(d?: string | Date | null) {
  return fmtDate(d, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(d?: string | Date | null) {
  return fmtDate(d, { hour: '2-digit', minute: '2-digit' })
}

export function initials(name?: string | null) {
  if (!name) return ''
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('')
}

export function statusColor(s: string): string {
  return {
    created: 'bg-background text-ocean-blue ring-border',
    picked_up: 'bg-primary-soft text-primary-dark ring-primary/30',
    in_transit: 'bg-ocean-blue/10 text-ocean-blue ring-ocean-blue/20',
    out_for_delivery: 'bg-primary/15 text-primary-dark ring-primary/40',
    delivered: 'bg-success-bg text-success ring-success/20',
    awaiting_customs_clearance: 'bg-warning-bg text-warning ring-warning/25',
    awaiting_payment: 'bg-warning-bg text-warning ring-warning/25',
    customs_hold: 'bg-danger-bg text-danger ring-danger/25',
    payment_verification: 'bg-warning-bg text-warning ring-warning/25',
    cancelled: 'bg-background text-text-secondary ring-border',
    on_hold: 'bg-warning-bg text-warning ring-warning/25',
    returned: 'bg-danger-bg text-danger ring-danger/25',
    paid: 'bg-success-bg text-success ring-success/20',
    unpaid: 'bg-danger-bg text-danger ring-danger/25',
    partially_paid: 'bg-warning-bg text-warning ring-warning/25',
    waived: 'bg-background text-text-secondary ring-border',
    pending: 'bg-warning-bg text-warning ring-warning/25',
    verified: 'bg-success-bg text-success ring-success/20',
    rejected: 'bg-danger-bg text-danger ring-danger/25',
  }[s] ?? 'bg-background text-ocean-blue ring-border'
}

export function statusLabel(s: string): string {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending verification',
  verified: 'Verified',
  rejected: 'Rejected',
}

export function paymentStatusLabel(s: string): string {
  return PAYMENT_STATUS_LABELS[s] ?? statusLabel(s)
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  gift_card: 'Gift card',
  crypto: 'Cryptocurrency',
  bank: 'Bank wire transfer',
  usdt_trc20: 'USDT TRC20',
  ach: 'ACH',
  wire: 'Wire',
  other: 'Other',
}

export function paymentMethodLabel(m: string): string {
  return PAYMENT_METHOD_LABELS[m] ?? statusLabel(m)
}

export function isInlineReceipt(url?: string | null) {
  return !!url && (url.startsWith('data:') || /^https?:\/\//i.test(url))
}

/** Detect the media type of a storage URL or object name. */
export function mediaKind(urlOrName?: string | null): 'image' | 'video' | 'document' | 'other' {
  const value = (urlOrName || '').split(/[?#]/)[0].toLowerCase()
  if (/\.(jpe?g|png|webp|gif|avif)$/.test(value)) return 'image'
  if (/\.(mp4|webm|mov|ogv|ogg)$/.test(value)) return 'video'
  if (/\.pdf$/.test(value)) return 'document'
  return 'other'
}

export function formatBytes(bytes?: number | null) {
  if (!bytes || bytes < 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function copyToClipboard(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text)
  const t = document.createElement('textarea')
  t.value = text
  document.body.appendChild(t); t.select()
  document.execCommand('copy')
  document.body.removeChild(t)
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

const MAX_IMAGE_EDGE = 1600
const IMAGE_QUALITY = 0.85
const MAX_FILE_BYTES = 8 * 1024 * 1024

export function imageFileError(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file (JPG or PNG).'
  if (file.size > MAX_FILE_BYTES) return 'That image is too large. Please upload one under 8 MB.'
  return null
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as any)
  } catch {
    return await createImageBitmap(file)
  }
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return fileToDataUrl(file)
  try {
    const bitmap = await decodeBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return fileToDataUrl(file)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', IMAGE_QUALITY)
  } catch {
    return fileToDataUrl(file)
  }
}
