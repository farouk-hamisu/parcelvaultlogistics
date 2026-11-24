import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShipmentsApi, PaymentsApi, AuthApi, ContentApi, UploadsApi } from '../../lib/api'
import { Card, Button, StatusBadge, Spinner, EmptyState, Pill, Input, Textarea, Select, Label } from '../../components/ui/primitives'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Package, Wallet, FileText, Image as ImageIcon, Settings, LogOut, Plus, Trash2, ChevronRight,
  MapPin, Calendar, Truck, AlertCircle, CheckCircle2, Clock, X, Edit3, Save, Search, Upload, ExternalLink, Globe, Megaphone,
  Bitcoin, FileWarning, FileVideo, FileImage, Download, Mail,
} from 'lucide-react'
import { LogoMark } from '../../components/layout/header'
import {
  fmtDate, fmtDateTime, fmtMoney, statusLabel, initials, fileToDataUrl, fileToCompressedDataUrl,
  paymentStatusLabel, paymentMethodLabel, mediaKind, formatBytes, isInlineReceipt,
} from '../../lib/utils'
import { LiveMap } from '../../components/tracking/live-map'
import type { Shipment, TrackingEvent, Fee, ShipmentImage, Profile, Payment, Service, Testimonial, GalleryItem, BrandPartner, SiteSettings, MediaFile } from '../../lib/types'
import { uploadWithProgress } from '../../lib/api'

export { AdminPaymentMethods } from './payment-methods'
export { AdminEmails } from './emails'

const sidebarLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/shipments', icon: Package, label: 'Shipments' },
  { to: '/admin/payments', icon: Wallet, label: 'Payments' },
  { to: '/admin/payment-methods', icon: Bitcoin, label: 'Payment methods' },
  { to: '/admin/content', icon: FileText, label: 'Content' },
  { to: '/admin/notice', icon: Megaphone, label: 'Delivery notice' },
  { to: '/admin/emails', icon: Mail, label: 'Email templates' },
  { to: '/admin/media', icon: ImageIcon, label: 'Media' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

const SHIPMENT_STATUSES = [
  'created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered',
  'awaiting_customs_clearance', 'awaiting_payment', 'customs_hold',
  'payment_verification', 'cancelled', 'on_hold', 'returned',
]

const inputNumber = (v: string) => (v === '' ? null : Number(v))
const dateValue = (v: any) => (v ? String(v).slice(0, 10) : '')

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <h4 className="text-sm font-bold uppercase tracking-wide text-dtl-charcoal mb-3">{title}</h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ShipmentFields({
  value,
  onChange,
  includeTracking = false,
}: {
  value: any
  onChange: (key: string, fieldValue: any) => void
  includeTracking?: boolean
}) {
  return (
    <>
      <FormSection title="Shipment details">
        {includeTracking && (
          <FormField label="Tracking number">
            <Input value={value.tracking_number ?? ''} onChange={e => onChange('tracking_number', e.target.value)} placeholder="Auto-generated if left blank" />
          </FormField>
        )}
        <FormField label="Reference">
          <Input value={value.reference ?? ''} onChange={e => onChange('reference', e.target.value)} placeholder="Customer reference / PO number" />
        </FormField>
        <FormField label="Service">
          <Input value={value.service ?? ''} onChange={e => onChange('service', e.target.value)} placeholder="Air Freight, Sea Freight, ..." />
        </FormField>
        <FormField label="Status">
          <Select value={value.status ?? 'created'} onChange={e => onChange('status', e.target.value)}>
            {SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        </FormField>
        <FormField label="Weight (kg)">
          <Input type="number" min="0" step="0.001" value={value.weight_kg ?? ''} onChange={e => onChange('weight_kg', inputNumber(e.target.value))} />
        </FormField>
        <FormField label="Pieces">
          <Input type="number" min="0" step="1" value={value.pieces ?? ''} onChange={e => onChange('pieces', inputNumber(e.target.value))} />
        </FormField>
        <FormField label="Dimensions">
          <Input value={value.dimensions ?? ''} onChange={e => onChange('dimensions', e.target.value)} placeholder="e.g. 120 × 80 × 100 cm" />
        </FormField>
        <FormField label="Estimated delivery">
          <Input type="date" value={dateValue(value.estimated_delivery)} onChange={e => onChange('estimated_delivery', e.target.value || null)} />
        </FormField>
        <FormField label="Actual delivery">
          <Input type="date" value={dateValue(value.actual_delivery)} onChange={e => onChange('actual_delivery', e.target.value || null)} />
        </FormField>
        <FormField label="Notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea rows={3} value={value.notes ?? ''} onChange={e => onChange('notes', e.target.value)} placeholder="Internal notes, special instructions, etc." />
        </FormField>
      </FormSection>

      <FormSection title="Sender information">
        <FormField label="Sender name">
          <Input value={value.sender_name ?? ''} onChange={e => onChange('sender_name', e.target.value)} />
        </FormField>
        <FormField label="Sender company">
          <Input value={value.sender_company ?? ''} onChange={e => onChange('sender_company', e.target.value)} />
        </FormField>
        <FormField label="Sender phone">
          <Input value={value.sender_phone ?? ''} onChange={e => onChange('sender_phone', e.target.value)} />
        </FormField>
        <FormField label="Sender country">
          <Input value={value.sender_country ?? ''} onChange={e => onChange('sender_country', e.target.value)} />
        </FormField>
        <FormField label="Sender address" className="sm:col-span-2 lg:col-span-3">
          <Input value={value.sender_address ?? ''} onChange={e => onChange('sender_address', e.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Recipient information">
        <FormField label="Recipient name">
          <Input value={value.receiver_name ?? ''} onChange={e => onChange('receiver_name', e.target.value)} />
        </FormField>
        <FormField label="Recipient company">
          <Input value={value.receiver_company ?? ''} onChange={e => onChange('receiver_company', e.target.value)} />
        </FormField>
        <FormField label="Recipient phone">
          <Input value={value.receiver_phone ?? ''} onChange={e => onChange('receiver_phone', e.target.value)} />
        </FormField>
        <FormField label="Recipient email">
          <Input type="email" value={value.receiver_email ?? ''} onChange={e => onChange('receiver_email', e.target.value)} />
        </FormField>
        <FormField label="Recipient country">
          <Input value={value.receiver_country ?? ''} onChange={e => onChange('receiver_country', e.target.value)} />
        </FormField>
        <FormField label="Recipient address" className="sm:col-span-2 lg:col-span-3">
          <Input value={value.receiver_address ?? ''} onChange={e => onChange('receiver_address', e.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Origin">
        <FormField label="Origin name">
          <Input value={value.origin_name ?? ''} onChange={e => onChange('origin_name', e.target.value)} />
        </FormField>
        <FormField label="Origin country">
          <Input value={value.origin_country ?? ''} onChange={e => onChange('origin_country', e.target.value)} />
        </FormField>
        <FormField label="Origin latitude">
          <Input type="number" step="any" value={value.origin_lat ?? ''} onChange={e => onChange('origin_lat', inputNumber(e.target.value))} />
        </FormField>
        <FormField label="Origin longitude">
          <Input type="number" step="any" value={value.origin_lng ?? ''} onChange={e => onChange('origin_lng', inputNumber(e.target.value))} />
        </FormField>
      </FormSection>

      <FormSection title="Destination">
        <FormField label="Destination name">
          <Input value={value.destination_name ?? ''} onChange={e => onChange('destination_name', e.target.value)} />
        </FormField>
        <FormField label="Destination country">
          <Input value={value.destination_country ?? ''} onChange={e => onChange('destination_country', e.target.value)} />
        </FormField>
        <FormField label="Destination latitude">
          <Input type="number" step="any" value={value.destination_lat ?? ''} onChange={e => onChange('destination_lat', inputNumber(e.target.value))} />
        </FormField>
        <FormField label="Destination longitude">
          <Input type="number" step="any" value={value.destination_lng ?? ''} onChange={e => onChange('destination_lng', inputNumber(e.target.value))} />
        </FormField>
      </FormSection>

      <FormSection title="Current position">
        <FormField label="Current location label" className="sm:col-span-2 lg:col-span-3">
          <Input value={value.current_location_label ?? ''} onChange={e => onChange('current_location_label', e.target.value)} placeholder="e.g. Customs clearance, Lagos" />
        </FormField>
        <FormField label="Current latitude">
          <Input type="number" step="any" value={value.current_lat ?? ''} onChange={e => onChange('current_lat', inputNumber(e.target.value))} />
        </FormField>
        <FormField label="Current longitude">
          <Input type="number" step="any" value={value.current_lng ?? ''} onChange={e => onChange('current_lng', inputNumber(e.target.value))} />
        </FormField>
      </FormSection>
    </>
  )
}

export function AdminLayout() {
  const { profile, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!profile) navigate({ to: '/admin/login' })
    else if (!['admin', 'manager', 'staff'].includes(profile.role)) navigate({ to: '/' })
  }, [loading, profile, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  if (loading || !profile || !['admin', 'manager', 'staff'].includes(profile.role)) return null

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 bg-navy text-white hidden lg:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <Link to="/admin" className="flex items-center gap-2 text-xl font-bold tracking-tight"><LogoMark onDark /> <span className="text-sm text-white/70">Admin</span></Link>
          <p className="text-xs text-white/40 mt-2">Operations panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map(link => {
            const active = link.to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(link.to)
            return (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-primary/20 text-primary-light ring-1 ring-primary/30' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}>
                <link.icon className="size-4" /> {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-navy">{initials(profile?.full_name || profile?.email)}</div>
            <div className="text-sm truncate"><p className="font-semibold truncate">{profile?.full_name || 'Admin'}</p><p className="text-white/50 text-xs truncate">{profile?.email}</p></div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center justify-between p-4 bg-surface border-b border-border">
          <Link to="/admin" className="flex items-center gap-2 text-lg font-bold text-navy"><LogoMark /> <span className="text-xs font-semibold text-text-secondary">Admin</span></Link>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-navy">{initials(profile?.full_name || profile?.email)}</div>
            <button aria-label="Sign out" onClick={handleSignOut} className="text-ocean-blue hover:text-danger"><LogOut className="size-5" /></button>
          </div>
        </div>
        <div className="lg:hidden flex overflow-x-auto gap-1 p-2 bg-surface border-b border-border">
          {sidebarLinks.map(link => {
            const active = link.to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(link.to)
            return (
              <Link key={link.to} to={link.to}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  active ? 'bg-primary text-navy' : 'text-ocean-blue hover:bg-background'
                }`}>
                <link.icon className="size-3.5" /> {link.label}
              </Link>
            )
          })}
        </div>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => ContentApi.analytics(),
  })

  const stats = (data as any) || {}

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-dtl-black">Dashboard Overview</h1>
      {isLoading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6"><p className="text-sm text-dtl-charcoal font-semibold">Total shipments</p><p className="text-3xl font-bold text-dtl-black mt-1">{stats.totals?.shipments ?? 0}</p></Card>
            <Card className="p-6"><p className="text-sm text-dtl-charcoal font-semibold">Pending payments</p><p className="text-3xl font-bold text-danger mt-1">{stats.totals?.pendingPayments ?? 0}</p></Card>
            <Card className="p-6"><p className="text-sm text-dtl-charcoal font-semibold">Outstanding fees</p><p className="text-3xl font-bold text-danger mt-1">{stats.outstandingFees ? fmtMoney(stats.outstandingFees) : '$0'}</p></Card>
            <Card className="p-6"><p className="text-sm text-dtl-charcoal font-semibold">Revenue</p><p className="text-3xl font-bold text-emerald-600 mt-1">{stats.totalRevenue ? fmtMoney(stats.totalRevenue) : '$0'}</p></Card>
          </div>
          {stats.statusCounts && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-dtl-black mb-4">Shipments by status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-3 rounded-xl bg-dtl-light-gray">
                    <span className="text-sm text-dtl-charcoal">{statusLabel(status)}</span>
                    <span className="font-bold text-dtl-black">{count as number}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

type ShipmentMediaKind = 'image' | 'video' | 'document'
type ShipmentMediaSelection = { file: File; kind: ShipmentMediaKind; previewUrl: string | null }
type MediaProgress = { index: number; total: number; percent: number; name: string }
type Feedback = { kind: 'success' | 'error'; text: string }

const SHIPMENT_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/ogg,application/pdf'

const EXTENSION_KINDS: Record<string, ShipmentMediaKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp4: 'video', webm: 'video', mov: 'video', ogv: 'video', ogg: 'video',
  pdf: 'document',
}

function shipmentMediaKind(file: File): ShipmentMediaKind | null {
  const type = (file.type || '').toLowerCase()
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) return 'image'
  if (['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'].includes(type)) return 'video'
  if (type === 'application/pdf') return 'document'
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  return EXTENSION_KINDS[ext] ?? null
}

function validateShipmentMedia(file: File, kind: ShipmentMediaKind): string | null {
  const mb = 1024 * 1024
  if (kind === 'image' && file.size > 10 * mb) return 'image is too large (maximum 10 MB).'
  if (kind === 'video' && file.size > 100 * mb) return 'video is too large (maximum 100 MB).'
  if (kind === 'document' && file.size > 25 * mb) return 'PDF is too large (maximum 25 MB).'
  return null
}

function releaseMedia(items: ShipmentMediaSelection[]) {
  for (const item of items) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
}

function MediaThumb({ item, onRemove }: { item: ShipmentMediaSelection; onRemove?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-lg ring-1 ring-dtl-border bg-white">
      {item.kind === 'image' && item.previewUrl ? (
        <img src={item.previewUrl} alt={item.file.name} className="h-24 w-full object-cover" />
      ) : item.kind === 'video' && item.previewUrl ? (
        <video src={item.previewUrl} muted playsInline preload="metadata" className="h-24 w-full bg-navy object-cover" />
      ) : (
        <div className="flex h-24 w-full flex-col items-center justify-center gap-1 bg-dtl-light-gray text-dtl-charcoal">
          <FileWarning className="size-6 text-primary-dark" />
          <span className="text-[10px] font-bold uppercase tracking-wide">PDF</span>
        </div>
      )}
      <p className="truncate px-2 py-1 text-[11px] text-dtl-charcoal" title={item.file.name}>{item.file.name}</p>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.file.name}`}
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white/90 text-danger shadow hover:bg-white">
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

export function AdminShipments() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-shipments'],
    queryFn: () => ShipmentsApi.listAll(),
  })

  const shipments: Shipment[] = (data as any)?.shipments ?? []
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<any>({})
  const [createMedia, setCreateMedia] = useState<ShipmentMediaSelection[]>([])
  const [createProgress, setCreateProgress] = useState<MediaProgress | null>(null)
  const [createFeedback, setCreateFeedback] = useState<Feedback | null>(null)
  const queryClient = useQueryClient()

  const clearCreateMedia = () => {
    releaseMedia(createMedia)
    setCreateMedia([])
  }

  const createMut = useMutation({
    mutationFn: async (b: any) => {
      const result = await ShipmentsApi.create(b)
      const shipmentId = (result as any)?.shipment?.id
      let uploadError = ''

      if (shipmentId && createMedia.length > 0) {
        for (let index = 0; index < createMedia.length; index++) {
          const item = createMedia[index]
          try {
            setCreateProgress({ index: index + 1, total: createMedia.length, percent: 0, name: item.file.name })
            const up = await uploadWithProgress('shipment-images', item.file, (percent) => {
              setCreateProgress({ index: index + 1, total: createMedia.length, percent, name: item.file.name })
            })
            await ShipmentsApi.addImage(shipmentId, {
              url: up.url,
              caption: '',
              kind: item.kind === 'document' ? 'document' : 'progress',
            })
          } catch (err: any) {
            uploadError = uploadError
              ? `${uploadError} ${item.file.name}: ${err?.message || 'upload failed.'}`
              : `${item.file.name}: ${err?.message || 'upload failed.'}`
          }
        }
      }

      return { result, uploadError }
    },
    onSuccess: ({ uploadError }: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] })
      setShowCreate(false)
      setForm({})
      clearCreateMedia()
      setCreateProgress(null)
      setCreateFeedback(
        uploadError
          ? { kind: 'error', text: `Shipment was created, but some media could not be uploaded. ${uploadError}` }
          : { kind: 'success', text: 'Shipment created successfully.' },
      )
    },
    onError: () => setCreateProgress(null),
  })

  const deleteMut = useMutation({
    mutationFn: (shipmentId: string) => ShipmentsApi.remove(shipmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] })
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] })
    },
  })

  const set = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }))

  const handleCreateMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    const additions: ShipmentMediaSelection[] = []
    const errors: string[] = []

    for (const file of files) {
      const kind = shipmentMediaKind(file)
      const problem = kind ? validateShipmentMedia(file, kind) : 'Unsupported file type.'
      if (problem || !kind) {
        errors.push(`${file.name}: ${problem ?? 'unsupported file type.'}`)
        continue
      }
      additions.push({
        file,
        kind,
        previewUrl: kind === 'document' ? null : URL.createObjectURL(file),
      })
    }

    if (additions.length > 0) setCreateMedia(prev => [...prev, ...additions])
    setCreateFeedback(errors.length
      ? { kind: 'error', text: errors.join(' ') }
      : null)
  }

  const removeCreateMedia = (index: number) => {
    setCreateMedia(prev => {
      const item = prev[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-dtl-black">Shipments</h1>
        <Button onClick={() => { setShowCreate(true); setCreateFeedback(null) }}><Plus className="size-4" /> New shipment</Button>
      </div>

      {createFeedback && showCreate && (
        <div className={`mb-4 flex items-start gap-2 rounded-card p-4 text-sm ${
          createFeedback.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'
        }`}>
          {createFeedback.kind === 'error'
            ? <AlertCircle className="mt-0.5 size-4 shrink-0" />
            : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0 break-words">{createFeedback.text}</span>
        </div>
      )}

      {showCreate && (
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-bold text-dtl-black mb-4">Create shipment</h3>
          <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); setCreateFeedback(null); createMut.mutate(form) }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ShipmentFields value={form} onChange={set} includeTracking />

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-dtl-charcoal mb-2">Shipment media (optional)</label>
              <input multiple type="file" accept={SHIPMENT_MEDIA_ACCEPT} onChange={handleCreateMediaSelect}
                className="block w-full text-sm text-dtl-charcoal file:mr-4 file:py-2 file:px-4 file:rounded-[14px] file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20" />
              <p className="mt-1.5 text-xs text-dtl-charcoal/70">
                Images: JPG, PNG, WEBP up to 10 MB · Videos: MP4, WEBM, MOV up to 100 MB · Documents: PDF up to 25 MB
              </p>

              {createMedia.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {createMedia.map((item, i) => (
                    <MediaThumb key={`${item.file.name}-${i}`} item={item} onRemove={() => removeCreateMedia(i)} />
                  ))}
                </div>
              )}

              {createProgress && createMut.isPending && (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-dtl-light-gray ring-1 ring-dtl-border">
                    <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${createProgress.percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-primary-dark">
                    Uploading {createProgress.index} of {createProgress.total}: {createProgress.name} ({createProgress.percent}%)
                  </p>
                </div>
              )}
            </div>

            {createMut.isError && (
              <p className="sm:col-span-2 lg:col-span-3 text-sm text-danger">{(createMut.error as any)?.message}</p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? <><Spinner className="size-4" /> Creating…</> : 'Create'}
              </Button>
              <Button type="button" variant="ghost" disabled={createMut.isPending} onClick={() => { setShowCreate(false); setCreateFeedback(null); clearCreateMedia(); setForm({}) }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {createFeedback && !showCreate && (
        <div className={`mb-4 flex items-start gap-2 rounded-card p-4 text-sm ${
          createFeedback.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'
        }`}>
          {createFeedback.kind === 'error'
            ? <AlertCircle className="mt-0.5 size-4 shrink-0" />
            : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0 break-words">{createFeedback.text}</span>
        </div>
      )}

      {isLoading && <Spinner />}
      {error && <p className="text-danger">{(error as any).message}</p>}
      {deleteMut.isError && (
        <p className="text-danger text-sm mb-4">{(deleteMut.error as any)?.message}</p>
      )}
      {!isLoading && !error && shipments.length === 0 && <EmptyState title="No shipments" />}
      {shipments.length > 0 && (
        <div className="overflow-x-auto rounded-card ring-1 ring-dtl-border">
          <table className="w-full text-sm">
            <thead className="bg-dtl-light-gray text-dtl-charcoal text-left">
              <tr>
                <th className="p-4 font-semibold">Tracking</th>
                <th className="p-4 font-semibold">Sender</th>
                <th className="p-4 font-semibold">Route</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Created</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dtl-border bg-white">
              {shipments.map(s => (
                <tr key={s.id} className="hover:bg-dtl-light-gray/50 transition-colors">
                  <td className="p-4 font-semibold text-dtl-black">#{s.tracking_number}</td>
                  <td className="p-4 text-dtl-charcoal">{s.sender_name || '—'}</td>
                  <td className="p-4 text-dtl-charcoal text-xs">{s.origin_name || '?'} → {s.destination_name || '?'}</td>
                  <td className="p-4"><StatusBadge status={s.status} /></td>
                  <td className="p-4 text-dtl-charcoal text-xs">{fmtDate(s.created_at)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Link to="/admin/shipments/$id" params={{ id: s.id }} aria-label="Open shipment">
                        <ChevronRight className="size-4 text-dtl-charcoal/50" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete shipment ${s.tracking_number}`}
                        disabled={deleteMut.isPending && deleteMut.variables === s.id}
                        onClick={() => {
                          if (!window.confirm(`Permanently delete shipment ${s.tracking_number}? This removes all tracking events, fees, payments, and images and cannot be undone.`)) return
                          deleteMut.mutate(s.id)
                        }}
                        className="text-dtl-charcoal/50 hover:text-danger transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AdminShipment() {
  const { id } = useParams({ from: '/admin/shipments/$id' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [newEvent, setNewEvent] = useState({ status: '', location_label: '', note: '', occurred_at: '', lat: '', lng: '' })
  const [newFee, setNewFee] = useState({ name: '', description: '', amount: 0, currency: 'USD', status: 'unpaid' as const, due_date: '', notes: '' })
  const [mediaFiles, setMediaFiles] = useState<ShipmentMediaSelection[]>([])
  const [mediaCaption, setMediaCaption] = useState('')
  const [mediaKindState, setMediaKindState] = useState('progress')
  const [mediaProgress, setMediaProgress] = useState<MediaProgress | null>(null)
  const [mediaFeedback, setMediaFeedback] = useState<Feedback | null>(null)
  const [editingShipment, setEditingShipment] = useState(false)
  const [shipmentForm, setShipmentForm] = useState<any>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-shipment', id],
    queryFn: () => ShipmentsApi.get(id),
    enabled: !!id,
  })

  const updateShipmentMut = useMutation({
    mutationFn: (b: any) => { if (!id) throw new Error('missing id'); return ShipmentsApi.update(id, b) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] })
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] })
      setEditingShipment(false)
    },
  })

  const deleteShipmentMut = useMutation({
    mutationFn: () => { if (!id) throw new Error('missing id'); return ShipmentsApi.remove(id) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] })
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] })
      navigate({ to: '/admin/shipments' })
    },
  })

  const confirmDeleteShipment = (label: string) => {
    if (!window.confirm(`Permanently delete shipment ${label}? This removes all tracking events, fees, payments, and images and cannot be undone.`)) return
    deleteShipmentMut.mutate()
  }

  const addEventMut = useMutation({
    mutationFn: (b: any) => { if (!id) throw new Error('missing id'); return ShipmentsApi.addEvent(id, b) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] }); setNewEvent({ status: '', location_label: '', note: '', occurred_at: '', lat: '', lng: '' }) },
  })

  const delEventMut = useMutation({
    mutationFn: (evId: string) => { if (!id) throw new Error('missing id'); return ShipmentsApi.delEvent(id, evId) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] }),
  })

  const addFeeMut = useMutation({
    mutationFn: (b: any) => { if (!id) throw new Error('missing id'); return ShipmentsApi.addFee(id, b) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] }); setNewFee({ name: '', description: '', amount: 0, currency: 'USD', status: 'unpaid', due_date: '', notes: '' }) },
  })

  const delFeeMut = useMutation({
    mutationFn: (feeId: string) => { if (!id) throw new Error('missing id'); return ShipmentsApi.delFee(id, feeId) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] }),
  })

  const uploadImagesMut = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('missing id')
      if (mediaFiles.length === 0) throw new Error('Choose at least one file to upload.')
      const results = []
      for (let index = 0; index < mediaFiles.length; index++) {
        const item = mediaFiles[index]
        setMediaProgress({ index: index + 1, total: mediaFiles.length, percent: 0, name: item.file.name })
        const up = await uploadWithProgress('shipment-images', item.file, (percent) => {
          setMediaProgress({ index: index + 1, total: mediaFiles.length, percent, name: item.file.name })
        })
        const img = await ShipmentsApi.addImage(id, {
          url: up.url,
          caption: mediaCaption,
          kind: mediaKindState,
        })
        results.push(img)
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['track'] })
      releaseMedia(mediaFiles)
      setMediaFiles([])
      setMediaCaption('')
      setMediaKindState('progress')
      setMediaProgress(null)
      setMediaFeedback({ kind: 'success', text: 'Media uploaded and attached to this shipment.' })
    },
    onError: (err: any) => {
      setMediaProgress(null)
      setMediaFeedback({ kind: 'error', text: err?.message || 'Upload failed. Please try again.' })
    },
  })

  const delImgMut = useMutation({
    mutationFn: (imgId: string) => { if (!id) throw new Error('missing id'); return ShipmentsApi.delImage(id, imgId) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-shipment', id] }),
  })

  if (isLoading) return <Spinner />
  if (error) return <p className="text-danger">{(error as any).message}</p>
  if (!data) return <p className="text-dtl-charcoal">Not found.</p>

  const shipment: Shipment = data.shipment || data
  const events: TrackingEvent[] = data.events ?? []
  const fees: Fee[] = data.fees ?? []
  const images: ShipmentImage[] = data.images ?? []
  const sortedEvents = [...events].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())

  const setEvent = (k: string, v: any) => setNewEvent((prev: any) => ({ ...prev, [k]: v }))
  const setFee = (k: string, v: any) => setNewFee((prev: any) => ({ ...prev, [k]: v }))
  const setShip = (k: string, v: any) => setShipmentForm((prev: any) => ({ ...prev, [k]: v }))

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    const additions: ShipmentMediaSelection[] = []
    const errors: string[] = []

    for (const file of files) {
      const kind = shipmentMediaKind(file)
      const problem = kind ? validateShipmentMedia(file, kind) : 'Unsupported file type.'
      if (problem || !kind) {
        errors.push(`${file.name}: ${problem ?? 'unsupported file type.'}`)
        continue
      }
      additions.push({
        file,
        kind,
        previewUrl: kind === 'document' ? null : URL.createObjectURL(file),
      })
    }

    if (additions.length > 0) setMediaFiles(prev => [...prev, ...additions])
    setMediaFeedback(errors.length ? { kind: 'error', text: errors.join(' ') } : null)
  }

  const removeSelectedMedia = (index: number) => {
    setMediaFiles(prev => {
      const item = prev[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const presetFees = [
    'Customs Duty', 'Customs Clearance Fee', 'Shipping Fee', 'Storage Fee',
    'Warehouse Charges', 'Handling Fee', 'Insurance', 'Documentation Fee',
    'Inspection Fee', 'VAT', 'Government Charges',
  ]

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link to="/admin/shipments" className="text-dtl-charcoal hover:text-dtl-black"><ChevronRight className="size-5 rotate-180" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dtl-black">#{shipment.tracking_number}</h1>
          <p className="text-sm text-dtl-charcoal">{shipment.sender_name || '—'} → {shipment.receiver_name || '—'}</p>
        </div>
        <Button variant="outline" onClick={() => { setEditingShipment(!editingShipment); setShipmentForm(shipment) }}>
          <Edit3 className="size-4" /> {editingShipment ? 'Cancel' : 'Edit'}
        </Button>
        <Button variant="outline" className="text-danger border-danger/40 hover:bg-danger/5"
          onClick={() => confirmDeleteShipment(shipment.tracking_number)}
          disabled={deleteShipmentMut.isPending}>
          <Trash2 className="size-4" /> {deleteShipmentMut.isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </div>

      {deleteShipmentMut.isError && (
        <p className="text-sm text-danger">{(deleteShipmentMut.error as any)?.message}</p>
      )}

      {editingShipment && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-dtl-black mb-4">Edit shipment</h3>
          <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateShipmentMut.mutate(shipmentForm) }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ShipmentFields value={shipmentForm} onChange={setShip} includeTracking />

            {updateShipmentMut.isError && (
              <p className="sm:col-span-2 lg:col-span-3 text-sm text-danger">{(updateShipmentMut.error as any)?.message}</p>
            )}

            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <Button type="submit" disabled={updateShipmentMut.isPending}><Save className="size-4" /> {updateShipmentMut.isPending ? 'Saving…' : 'Save'}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditingShipment(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {shipment.origin_lat != null && shipment.origin_lng != null &&
       shipment.destination_lat != null && shipment.destination_lng != null &&
       shipment.current_lat != null && shipment.current_lng != null && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-dtl-black mb-4 flex items-center gap-2"><Globe className="size-5" /> Live Map</h3>
          <div className="h-[360px] rounded-xl overflow-hidden ring-1 ring-dtl-border">
            <LiveMap
              origin={[shipment.origin_lat, shipment.origin_lng]}
              destination={[shipment.destination_lat, shipment.destination_lng]}
              current={[shipment.current_lat, shipment.current_lng]}
              events={events}
              originLabel={shipment.origin_name}
              destinationLabel={shipment.destination_name}
              currentLabel={shipment.current_location_label}
              currentStatus={shipment.status}
            />
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-bold text-dtl-black mb-4">Tracking Events</h3>
        {sortedEvents.map((ev, i) => (
          <div key={ev.id} className="flex gap-4 pb-4 relative items-start">
            <div className="size-3 rounded-full bg-dtl-yellow ring-2 ring-dtl-yellow/20 z-10 mt-1.5" />
            {i < sortedEvents.length - 1 && <div className="w-px flex-1 bg-dtl-border absolute left-1.5 top-5" />}
            <div className="flex-1 -mt-1">
              <p className="font-semibold text-dtl-black">{statusLabel(ev.status)}</p>
              {ev.location_label && <p className="text-sm text-dtl-charcoal flex items-center gap-1"><MapPin className="size-3.5" />{ev.location_label}</p>}
              {ev.note && <p className="text-sm text-dtl-charcoal">{ev.note}</p>}
              <p className="text-xs text-dtl-charcoal/50">{fmtDateTime(ev.occurred_at)}</p>
            </div>
            <button onClick={() => delEventMut.mutate(ev.id)} className="text-dtl-charcoal/50 hover:text-danger transition-colors p-1"><Trash2 className="size-4" /></button>
          </div>
        ))}
        {sortedEvents.length === 0 && <p className="text-sm text-dtl-charcoal mb-4">No events yet.</p>}

        <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); addEventMut.mutate({ ...newEvent, lat: parseFloat(newEvent.lat) || null, lng: parseFloat(newEvent.lng) || null }) }}
          className="grid grid-cols-2 lg:grid-cols-6 gap-3 pt-4 border-t border-dtl-border">
          <select required value={newEvent.status} onChange={(e: any) => setEvent('status', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40">
            <option value="">Status</option>
            {['created','picked_up','in_transit','out_for_delivery','delivered','awaiting_customs_clearance','awaiting_payment','customs_hold','payment_verification','on_hold'].map(s => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <input placeholder="Location" value={newEvent.location_label} onChange={(e: any) => setEvent('location_label', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <input placeholder="Lat" type="number" step="any" value={newEvent.lat} onChange={(e: any) => setEvent('lat', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <input placeholder="Lng" type="number" step="any" value={newEvent.lng} onChange={(e: any) => setEvent('lng', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <input type="datetime-local" required value={newEvent.occurred_at} onChange={(e: any) => setEvent('occurred_at', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <Button type="submit" size="sm" disabled={addEventMut.isPending}><Plus className="size-4" /></Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-dtl-black mb-4">Fees & Charges</h3>
        {fees.map(fee => (
          <div key={fee.id} className="flex items-center justify-between py-3 border-b border-dtl-border last:border-0">
            <div>
              <p className="font-semibold text-dtl-black text-sm">{fee.name}</p>
              <p className="text-xs text-dtl-charcoal">{fee.description}</p>
              {fee.due_date && <p className="text-xs text-dtl-charcoal/50">Due: {fmtDate(fee.due_date)}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-dtl-black">{fmtMoney(fee.amount, fee.currency)}</span>
              <StatusBadge status={fee.status} />
              <button onClick={() => delFeeMut.mutate(fee.id)} className="text-dtl-charcoal/50 hover:text-danger"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
        {fees.length === 0 && <p className="text-sm text-dtl-charcoal mb-4">No fees.</p>}

        <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); addFeeMut.mutate(newFee) }} className="grid grid-cols-2 lg:grid-cols-7 gap-3 pt-4 border-t border-dtl-border">
          <div className="relative">
            <input required placeholder="Fee name" list="fee-presets" value={newFee.name} onChange={(e: any) => setFee('name', e.target.value)}
              className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
            <datalist id="fee-presets">
              {presetFees.map((f: string) => <option key={f} value={f} />)}
            </datalist>
          </div>
          <input placeholder="Description" value={newFee.description} onChange={(e: any) => setFee('description', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <input required type="number" step="0.01" placeholder="Amount" value={newFee.amount} onChange={(e: any) => setFee('amount', parseFloat(e.target.value) || 0)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <input placeholder="Currency" value={newFee.currency} onChange={(e: any) => setFee('currency', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <input type="date" placeholder="Due date" value={newFee.due_date} onChange={(e: any) => setFee('due_date', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <select value={newFee.status} onChange={(e: any) => setFee('status', e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40">
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partial</option>
            <option value="waived">Waived</option>
          </select>
          <Button type="submit" size="sm" disabled={addFeeMut.isPending}><Plus className="size-4" /></Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-dtl-black mb-4 flex items-center gap-2"><ImageIcon className="size-5" /> Shipment media</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {images.map(img => {
            const kind = mediaKind(img.url)
            return (
              <div key={img.id} className="relative group rounded-xl overflow-hidden ring-1 ring-dtl-border bg-white">
                {kind === 'video' ? (
                  <video src={img.url} controls preload="metadata" className="w-full h-28 bg-navy object-cover" />
                ) : kind === 'document' ? (
                  <a href={img.url} target="_blank" rel="noopener noreferrer"
                    className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-dtl-light-gray text-dtl-charcoal hover:bg-primary-soft transition">
                    <FileWarning className="size-7 text-primary-dark" />
                    <span className="text-[11px] font-bold uppercase tracking-wide">View PDF</span>
                  </a>
                ) : (
                  <a href={img.url} target="_blank" rel="noopener noreferrer">
                    <img src={img.url} alt={img.caption || ''} className="w-full h-28 object-cover" />
                  </a>
                )}
                {img.caption && <p className="text-xs text-dtl-charcoal p-2 bg-white">{img.caption}</p>}
                <button onClick={() => delImgMut.mutate(img.id)} aria-label="Delete media"
                  className="absolute top-2 right-2 size-7 rounded-full bg-white/90 flex items-center justify-center text-danger opacity-0 group-hover:opacity-100 focus:opacity-100 transition shadow">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })}
          {images.length === 0 && <p className="col-span-full text-sm text-dtl-charcoal">No media yet.</p>}
        </div>

        {mediaFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {mediaFiles.map((item, i) => (
              <MediaThumb key={`${item.file.name}-${i}`} item={item} onRemove={() => removeSelectedMedia(i)} />
            ))}
          </div>
        )}

        {mediaProgress && uploadImagesMut.isPending && (
          <div className="mb-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-dtl-light-gray ring-1 ring-dtl-border">
              <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${mediaProgress.percent}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold text-primary-dark">
              Uploading {mediaProgress.index} of {mediaProgress.total}: {mediaProgress.name} ({mediaProgress.percent}%)
            </p>
          </div>
        )}

        {mediaFeedback && (
          <p role={mediaFeedback.kind === 'error' ? 'alert' : 'status'}
            className={`mb-4 flex items-start gap-2 rounded-xl p-3 text-sm ${
              mediaFeedback.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'
            }`}>
            {mediaFeedback.kind === 'error'
              ? <AlertCircle className="mt-0.5 size-4 shrink-0" />
              : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            <span className="min-w-0 break-words">{mediaFeedback.text}</span>
          </p>
        )}

        <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); setMediaFeedback(null); uploadImagesMut.mutate() }}
          className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-dtl-charcoal mb-1">Upload media</label>
            <input multiple type="file" accept={SHIPMENT_MEDIA_ACCEPT} onChange={handleMediaSelect}
              className="block w-full text-sm text-dtl-charcoal file:mr-4 file:py-2 file:px-4 file:rounded-[14px] file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20" />
            <p className="mt-1 text-[11px] text-dtl-charcoal/70">JPG, PNG, WEBP · MP4, WEBM, MOV · PDF</p>
          </div>
          <input placeholder="Caption" value={mediaCaption} onChange={(e: any) => setMediaCaption(e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
          <select value={mediaKindState} onChange={(e: any) => setMediaKindState(e.target.value)}
            className="rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40">
            <option value="progress">Progress</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
            <option value="damage">Damage</option>
            <option value="document">Document</option>
            <option value="warehouse">Warehouse</option>
            <option value="port">Port</option>
          </select>
          <Button type="submit" size="sm" disabled={uploadImagesMut.isPending || mediaFiles.length === 0}>
            {uploadImagesMut.isPending
              ? <><Spinner className="size-4" /> Uploading…</>
              : <><Upload className="size-4" /> Upload{mediaFiles.length > 0 ? ` (${mediaFiles.length})` : ''}</>}
          </Button>
        </form>
      </Card>
    </div>
  )
}

function ReceiptPreview({ value, label = 'Receipt' }: { value: string; label?: string }) {
  const isStoragePath = /^(payment-receipts|documents|shipment-media)\//.test(value)
  const { data, isLoading, error } = useQuery({
    queryKey: ['receipt-url', value],
    enabled: isStoragePath,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [bucket, ...rest] = value.split('/')
      return UploadsApi.view(bucket, rest.join('/'))
    },
  })

  const url: string | undefined = isStoragePath ? data?.url : value
  const kind = isStoragePath ? mediaKind(value) : value.startsWith('data:application/pdf') ? 'document' : value.startsWith('data:image/') ? 'image' : mediaKind(value)

  if (isStoragePath && isLoading) return <p className="text-xs text-text-secondary">Loading secure link…</p>
  if (isStoragePath && error) return <p className="text-xs text-danger">{(error as any)?.message || 'Could not open the file.'}</p>
  if (!url) return null

  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
        <img src={url} alt={label} className="max-h-56 w-auto max-w-full rounded-xl object-contain ring-1 ring-border" />
      </a>
    )
  }
  if (kind === 'video') {
    return <video src={url} controls className="max-h-56 w-full rounded-xl bg-black" />
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-dark hover:text-primary">
      <ExternalLink className="size-3.5" /> View {kind === 'document' ? 'PDF' : 'file'}
    </a>
  )
}

export function AdminPayments() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => PaymentsApi.listAll(),
  })
  const queryClient = useQueryClient()
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  const verifyMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'verified' | 'rejected' }) => {
      if (!id) throw new Error('missing id')
      return PaymentsApi.verify(id, status)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-payments'] }); setSelectedPayment(null) },
  })

  const payments: Payment[] = (data as any)?.payments ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold text-dtl-black mb-8">Payments</h1>
      {isLoading && <Spinner />}
      {error && <p className="text-danger">{(error as any).message}</p>}
      {!isLoading && !error && payments.length === 0 && <EmptyState title="No payments" />}
      {payments.length > 0 && (
        <div className="overflow-x-auto rounded-card ring-1 ring-dtl-border">
          <table className="w-full text-sm">
            <thead className="bg-dtl-light-gray text-dtl-charcoal text-left">
              <tr>
                <th className="p-4 font-semibold">Tracking</th>
                <th className="p-4 font-semibold">Amount</th>
                <th className="p-4 font-semibold">Method</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Receipt</th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dtl-border bg-white">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-dtl-light-gray/50 transition-colors">
                  <td className="p-4 font-semibold text-dtl-black">#{(p as any).shipments?.tracking_number || '—'}</td>
                  <td className="p-4 font-semibold text-dtl-black">{fmtMoney(p.amount, p.currency)}</td>
                  <td className="p-4 text-dtl-charcoal">
                    {paymentMethodLabel(p.method)}
                    {(p as any).payment_methods?.name && (
                      <span className="block text-xs text-dtl-charcoal/70">{(p as any).payment_methods.name}{(p as any).payment_methods.network ? ` · ${(p as any).payment_methods.network}` : ''}</span>
                    )}
                  </td>
                  <td className="p-4"><StatusBadge status={p.status} label={paymentStatusLabel(p.status)} /></td>
                  <td className="p-4">
                    {p.receipt_url ? (
                      <span className="inline-flex items-center gap-1 text-primary-dark">Proof attached</span>
                    ) : '—'}
                  </td>
                  <td className="p-4 text-dtl-charcoal text-xs">{fmtDate(p.created_at)}</td>
                  <td className="p-4">
                    <button onClick={() => setSelectedPayment(selectedPayment?.id === p.id ? null : p)}
                      className="text-sm font-semibold text-primary-dark hover:text-primary">
                      {selectedPayment?.id === p.id ? 'Close' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPayment && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-bold text-dtl-black mb-4">Review payment</h3>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm"><span className="text-dtl-charcoal">Amount</span><span className="font-semibold">{fmtMoney(selectedPayment.amount, selectedPayment.currency)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-dtl-charcoal">Method</span><span className="font-semibold">{paymentMethodLabel(selectedPayment.method)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-dtl-charcoal">Status</span><StatusBadge status={selectedPayment.status} label={paymentStatusLabel(selectedPayment.status)} /></div>
            {selectedPayment.method === 'gift_card' && (
              <>
                <div className="flex justify-between text-sm"><span className="text-dtl-charcoal">Gift card type</span><span className="font-semibold">{selectedPayment.card_brand || '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-dtl-charcoal">Card value</span><span className="font-semibold">{selectedPayment.card_value != null ? fmtMoney(selectedPayment.card_value) : '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-dtl-charcoal">Card number</span><span className="font-mono font-semibold break-all">{selectedPayment.card_number || '—'}</span></div>
              </>
            )}
            {(selectedPayment.sender_name || selectedPayment.sender_email) && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-dtl-charcoal shrink-0">Submitted by</span>
                <span className="font-semibold text-right">{selectedPayment.sender_name || ''}{selectedPayment.sender_name && selectedPayment.sender_email ? ' · ' : ''}{selectedPayment.sender_email || ''}</span>
              </div>
            )}
            {selectedPayment.method !== 'gift_card' && (
              <>
                <div className="flex justify-between gap-4 text-sm"><span className="text-dtl-charcoal shrink-0">Payment option</span><span className="font-semibold text-right">{(selectedPayment as any).payment_methods?.name || '—'}</span></div>
                <div className="flex justify-between gap-4 text-sm"><span className="text-dtl-charcoal shrink-0">Network</span><span className="font-semibold text-right">{selectedPayment.network || (selectedPayment as any).payment_methods?.network || '—'}</span></div>
                <div className="flex justify-between gap-4 text-sm"><span className="text-dtl-charcoal shrink-0">Transaction hash</span><span className="font-mono font-semibold break-all text-right">{selectedPayment.tx_hash || '—'}</span></div>
                <div className="flex justify-between gap-4 text-sm"><span className="text-dtl-charcoal shrink-0">Transfer reference</span><span className="font-mono font-semibold break-all text-right">{selectedPayment.reference || '—'}</span></div>
              </>
            )}
            {selectedPayment.receipt_url && (
              <div className="text-sm">
                <p className="text-dtl-charcoal mb-2">{selectedPayment.method === 'gift_card' ? 'Gift card photo' : 'Proof of payment'}</p>
                <ReceiptPreview value={selectedPayment.receipt_url} label="Proof of payment" />
              </div>
            )}
            {selectedPayment.notes && <div className="flex justify-between gap-4 text-sm"><span className="text-dtl-charcoal shrink-0">Notes</span><span className="text-right">{selectedPayment.notes}</span></div>}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => verifyMut.mutate({ id: selectedPayment.id, status: 'verified' })} disabled={verifyMut.isPending}>
              <CheckCircle2 className="size-4" /> Approve
            </Button>
            <Button variant="danger" onClick={() => verifyMut.mutate({ id: selectedPayment.id, status: 'rejected' })} disabled={verifyMut.isPending}>
              <X className="size-4" /> Reject
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export function AdminContent() {
  const [tab, setTab] = useState<'services' | 'gallery' | 'testimonials' | 'partners'>('services')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-content', tab],
    queryFn: () => ContentApi.list(tab),
  })

  const items: any[] = Array.isArray(data) ? data : []

  const createMut = useMutation({
    mutationFn: (b: any) => ContentApi.create(tab, b),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-content', tab] }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => {
      if (!id) throw new Error('missing id')
      return ContentApi.update(tab, id, body)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-content', tab] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => {
      if (!id) throw new Error('missing id')
      return ContentApi.remove(tab, id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-content', tab] }),
  })

  const [newItem, setNewItem] = useState<any>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const tabs = [
    { key: 'services' as const, label: 'Services' },
    { key: 'gallery' as const, label: 'Gallery' },
    { key: 'testimonials' as const, label: 'Testimonials' },
    { key: 'partners' as const, label: 'Partners' },
  ]

  const fields: Record<string, { key: string; label: string; type?: string }[]> = {
    services: [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
      { key: 'icon', label: 'Icon' },
      { key: 'image_url', label: 'Image URL' },
      { key: 'category_label', label: 'Category' },
    ],
    gallery: [
      { key: 'title', label: 'Title' },
      { key: 'url', label: 'URL' },
      { key: 'category', label: 'Category' },
    ],
    testimonials: [
      { key: 'author', label: 'Author' },
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
      { key: 'quote', label: 'Quote' },
      { key: 'rating', label: 'Rating', type: 'number' },
    ],
    partners: [
      { key: 'name', label: 'Name' },
      { key: 'logo_url', label: 'Logo URL' },
    ],
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMut.mutate(newItem, { onSuccess: () => setNewItem({}) })
  }

  const setNew = (k: string, v: any) => setNewItem((p: any) => ({ ...p, [k]: v }))
  const setEdit = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-dtl-black mb-6">Content</h1>
      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setEditingId(null) }}
            className={`px-5 py-2.5 rounded-[14px] text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-dtl-yellow text-dtl-black' : 'bg-white text-dtl-charcoal hover:bg-dtl-light-gray ring-1 ring-dtl-border'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}

      <div className="space-y-4 mb-8">
        {items.map((item: any) => (
          <Card key={item.id} className="p-5">
            {editingId === item.id ? (
              <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); updateMut.mutate({ id: item.id, body: editForm }); setEditingId(null) }}
                className="space-y-3">
                {fields[tab].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-dtl-charcoal mb-1">{f.label}</label>
                    {f.key === 'quote' ? (
                      <textarea value={editForm[f.key] ?? ''} onChange={(e: any) => setEdit(f.key, e.target.value)}
                        className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" rows={3} />
                    ) : (
                      <input type={f.type || 'text'} value={editForm[f.key] ?? ''} onChange={(e: any) => setEdit(f.key, e.target.value)}
                        className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={updateMut.isPending}><Save className="size-4" /> Save</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-dtl-black">{item.title || item.author || item.name || item.id}</p>
                  {item.description && <p className="text-sm text-dtl-charcoal truncate">{item.description}</p>}
                  {item.quote && <p className="text-sm text-dtl-charcoal line-clamp-2">{item.quote}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setEditingId(item.id); setEditForm(item) }}
                    className="size-8 rounded-full bg-dtl-light-gray flex items-center justify-center text-dtl-charcoal/50 hover:text-dtl-black"><Edit3 className="size-4" /></button>
                  <button onClick={() => deleteMut.mutate(item.id)}
                    className="size-8 rounded-full bg-dtl-light-gray flex items-center justify-center text-dtl-charcoal/50 hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-dtl-black mb-4">Add new {tab.slice(0, -1)}</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          {fields[tab].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-dtl-charcoal mb-1">{f.label}</label>
              {f.key === 'quote' ? (
                <textarea value={newItem[f.key] ?? ''} onChange={(e: any) => setNew(f.key, e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" rows={3} />
              ) : (
                <input type={f.type || 'text'} value={newItem[f.key] ?? ''} onChange={(e: any) => setNew(f.key, e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              )}
            </div>
          ))}
          <Button type="submit" size="sm" disabled={createMut.isPending}><Plus className="size-4" /> Add</Button>
        </form>
      </Card>
    </div>
  )
}

const MEDIA_BUCKETS = ['shipment-media', 'shipment-images', 'gallery', 'brand-logos', 'homepage', 'documents', 'payment-receipts'] as const
const PUBLIC_BUCKETS = ['shipment-media', 'shipment-images', 'gallery', 'brand-logos', 'homepage']

const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf'

function validateMediaFile(file: File): string | null {
  if (file.type === 'application/pdf') {
    if (file.size > 25 * 1024 * 1024) return 'That PDF is too large. The maximum size is 25 MB.'
    return null
  }
  if (file.type.startsWith('video/')) {
    if (!['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'].includes(file.type)) {
      return 'Unsupported video format. Use MP4 or WEBM.'
    }
    if (file.size > 100 * 1024 * 1024) return 'That video is too large. The maximum size is 100 MB.'
    return null
  }
  if (file.type.startsWith('image/')) {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      return 'Unsupported image format. Use JPG, PNG or WEBP.'
    }
    if (file.size > 10 * 1024 * 1024) return 'That image is too large. The maximum size is 10 MB.'
    return null
  }
  return 'Unsupported file type. Upload a JPG, PNG or WEBP image, an MP4 or WEBM video, or a PDF document.'
}

export function AdminMedia() {
  const queryClient = useQueryClient()
  const [activeBucket, setActiveBucket] = useState<string>(MEDIA_BUCKETS[0])
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'document'>('all')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [preview, setPreview] = useState<{ name: string; url: string; kind: 'image' | 'video' | 'document' } | null>(null)
  const [openingName, setOpeningName] = useState('')

  const isPublicBucket = PUBLIC_BUCKETS.includes(activeBucket)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-media', activeBucket],
    queryFn: () => UploadsApi.list(activeBucket),
  })

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Choose a file first.')
      const problem = validateMediaFile(uploadFile)
      if (problem) throw new Error(problem)
      return uploadWithProgress(activeBucket, uploadFile, setProgress)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media', activeBucket] })
      setFeedback('File uploaded successfully.')
      setUploadFile(null)
      setProgress(0)
      setUploadError('')
    },
    onError: (err: any) => {
      setUploadError(err?.message || 'Upload failed. Please try again.')
      setProgress(0)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (path: string) => UploadsApi.remove(activeBucket, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media', activeBucket] })
      setFeedback('File deleted.')
    },
    onError: (err: any) => setFeedback(err?.message || 'Could not delete that file.'),
  })

  const files: MediaFile[] = (data as any)?.files ?? []

  const publicUrl = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${activeBucket}/${name}`
  const kindOf = (file: MediaFile) => {
    const mime = file.metadata?.mimetype || ''
    if (mime.startsWith('video/')) return 'video' as const
    if (mime === 'application/pdf') return 'document' as const
    if (mime.startsWith('image/')) return 'image' as const
    return mediaKind(file.name)
  }

  async function openFile(file: MediaFile) {
    const kind = kindOf(file)
    setOpeningName(file.name)
    try {
      const url = isPublicBucket ? publicUrl(file.name) : (await UploadsApi.view(activeBucket, file.name)).url
      if (kind === 'document' || kind === 'other') {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setPreview({ name: file.name, url, kind })
      }
    } catch (err: any) {
      setFeedback(err?.message || 'Could not open that file.')
    } finally {
      setOpeningName('')
    }
  }

  const visible = files.filter(f => filter === 'all' || kindOf(f) === filter)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Media library</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Upload and manage images, videos, and PDF documents. Public buckets are served directly to customers;
            private buckets are available to admins through secure links.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {MEDIA_BUCKETS.map(b => (
          <button key={b} onClick={() => { setActiveBucket(b); setFeedback(''); setUploadError('') }}
            className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition-colors ${
              activeBucket === b ? 'bg-primary text-navy' : 'bg-white text-text-secondary ring-1 ring-border hover:bg-background'
            }`}>
            {b}
            {!PUBLIC_BUCKETS.includes(b) && <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-70">private</span>}
          </button>
        ))}
      </div>

      <Card className="mb-6 p-6">
        <h3 className="mb-1 text-lg font-bold text-navy">Upload file</h3>
        <p className="mb-4 text-sm text-text-secondary">
          Images: JPG, PNG, WEBP (max 10 MB) · Videos: MP4, WEBM (max 100 MB) · Documents: PDF (max 25 MB)
        </p>
        <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); setFeedback(''); setUploadError(''); uploadMut.mutate() }} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <input
                required
                type="file"
                accept={MEDIA_ACCEPT}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setUploadFile(e.target.files?.[0] || null)
                  setUploadError('')
                  setProgress(0)
                }}
                className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-[14px] file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-dark hover:file:bg-primary/20"
              />
              {uploadFile && (
                <p className="mt-1.5 text-xs text-text-secondary">
                  {uploadFile.name} · {formatBytes(uploadFile.size)}
                </p>
              )}
            </div>
            <Button type="submit" disabled={uploadMut.isPending || !uploadFile}>
              <Upload className="size-4" /> {uploadMut.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>

          {uploadMut.isPending && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-background ring-1 ring-border">
                <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs font-semibold text-primary-dark">{progress}% uploaded</p>
            </div>
          )}

          {uploadError && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-bg p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {uploadError}
            </p>
          )}
        </form>
      </Card>

      {feedback && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-sm font-semibold text-primary-dark">
          <CheckCircle2 className="size-4" /> {feedback}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'image', 'video', 'document'] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              filter === k ? 'bg-navy text-white' : 'bg-white text-text-secondary ring-1 ring-border hover:bg-background'
            }`}>
            {k === 'all' ? 'All files' : k === 'image' ? 'Images' : k === 'video' ? 'Videos' : 'PDFs'}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {error && <p className="text-sm text-danger">{(error as any)?.message || 'Could not load files.'}</p>}
      {!isLoading && !error && visible.length === 0 && (
        <EmptyState title="No files" hint="Upload a file to see it here." />
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map(file => {
            const kind = kindOf(file)
            const thumb = isPublicBucket ? publicUrl(file.name) : null
            return (
              <div key={file.name} className="group overflow-hidden rounded-xl bg-white ring-1 ring-border">
                <button type="button" onClick={() => openFile(file)} className="relative block h-32 w-full overflow-hidden bg-background text-left">
                  {kind === 'image' && thumb ? (
                    <img src={thumb} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : kind === 'video' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-navy text-white">
                      <FileVideo className="size-7 text-primary-light" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">Video</span>
                    </div>
                  ) : kind === 'document' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-primary-soft text-primary-dark">
                      <FileWarning className="size-7" />
                      <span className="text-[11px] font-bold uppercase tracking-wide">PDF</span>
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-secondary">
                      <FileImage className="size-7" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">File</span>
                    </div>
                  )}
                  {openingName === file.name && (
                    <span className="absolute inset-0 grid place-items-center bg-white/70"><Spinner /></span>
                  )}
                </button>
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold text-navy" title={file.name}>{file.name}</p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    {file.metadata?.size ? formatBytes(file.metadata.size) : ''}
                    {file.metadata?.size && isPublicBucket ? ' · ' : ''}
                    {isPublicBucket ? 'public' : 'private'}
                  </p>
                </div>
                <div className="flex border-t border-border">
                  <button onClick={() => openFile(file)} className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary-dark hover:bg-primary-soft">
                    <ExternalLink className="size-3.5" /> View
                  </button>
                  {isPublicBucket && (
                    <a href={publicUrl(file.name)} download target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center border-l border-border px-3 py-2 text-text-secondary hover:bg-background" aria-label={`Download ${file.name}`}>
                      <Download className="size-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => { if (window.confirm(`Delete ${file.name}?`)) deleteMut.mutate(file.name) }}
                    disabled={deleteMut.isPending}
                    className="flex items-center justify-center border-l border-border px-3 py-2 text-danger hover:bg-danger-bg disabled:opacity-50"
                    aria-label={`Delete ${file.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-navy/80 p-4" role="dialog" aria-modal="true" aria-label="File preview" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-card bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <p className="min-w-0 truncate text-sm font-semibold text-navy">{preview.name}</p>
              <div className="flex items-center gap-2">
                <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-dark hover:text-primary">Open in new tab</a>
                <button onClick={() => setPreview(null)} className="rounded-lg p-1.5 text-text-secondary hover:bg-background" aria-label="Close preview">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(90vh-3.5rem)] overflow-auto bg-navy/5 p-3">
              {preview.kind === 'image' ? (
                <img src={preview.url} alt={preview.name} className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg object-contain" />
              ) : preview.kind === 'video' ? (
                <video src={preview.url} controls autoPlay playsInline className="mx-auto max-h-[75vh] w-full rounded-lg bg-black" />
              ) : (
                <iframe src={preview.url} title={preview.name} className="h-[75vh] w-full rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const DEFAULT_TRACKING_NOTICE =
  'Please contact your dispatch desk if any holds have been placed on your package for delivery purposes.'

export function AdminNotice() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => ContentApi.getSettings(),
  })

  const settings = (data as any)?.settings as SiteSettings | undefined
  const [notice, setNotice] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (settings) setNotice(settings.tracking_notice ?? DEFAULT_TRACKING_NOTICE)
  }, [settings])

  const saveMut = useMutation({
    mutationFn: (value: string) => ContentApi.patchSettings({ tracking_notice: value }),
    onSuccess: () => {
      setFeedback({ kind: 'success', text: 'Delivery notice saved. Customers will see the updated message on their tracking timeline.' })
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['track'] })
      queryClient.invalidateQueries({ queryKey: ['public-site-settings'] })
    },
    onError: (err: any) => {
      setFeedback({ kind: 'error', text: err?.message || 'We could not save the delivery notice. Please try again.' })
    },
  })

  const savedNotice = settings?.tracking_notice ?? DEFAULT_TRACKING_NOTICE
  const dirty = notice !== savedNotice

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = notice.trim()
    if (!value) {
      setFeedback({ kind: 'error', text: 'Please enter a notice message before saving.' })
      return
    }
    setFeedback(null)
    setNotice(value)
    saveMut.mutate(value)
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Delivery Notice</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This message appears inside the shipment tracking timeline for every customer. Changes are saved to the
          database and go live immediately — no redeploy required.
        </p>
      </div>

      {isLoading && <Spinner />}
      {error && (
        <div className="mb-6 rounded-card border border-danger/20 bg-danger-bg p-4 text-sm text-danger">
          {(error as any)?.message || 'We could not load the current delivery notice.'}
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-primary-soft p-4 ring-1 ring-primary/20">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-primary-dark" />
          <div>
            <p className="font-semibold text-navy">Tracking timeline notice</p>
            <p className="mt-1 text-sm text-text-secondary">
              Keep it clear and brief. Customers see this above their shipment status updates.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tracking-notice">Notice message</Label>
            <Textarea
              id="tracking-notice"
              rows={6}
              value={notice}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setNotice(e.target.value)
                if (feedback) setFeedback(null)
              }}
              placeholder={DEFAULT_TRACKING_NOTICE}
              className="resize-y"
            />
            <div className="mt-1.5 flex items-center justify-between gap-4 text-xs text-text-secondary">
              <span>Plain text. Line breaks are preserved.</span>
              <span>{notice.length} characters</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-dark">Customer preview</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">
              {notice.trim() || 'No notice will be shown while this field is empty.'}
            </p>
          </div>

          {feedback && (
            <p
              role={feedback.kind === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-2 text-sm ${feedback.kind === 'success' ? 'text-success' : 'text-danger'}`}
            >
              {feedback.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              {feedback.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saveMut.isPending || !dirty}>
              {saveMut.isPending ? (
                <><Spinner className="size-4" /> Saving…</>
              ) : (
                <><Save className="size-4" /> Save notice</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saveMut.isPending || notice === DEFAULT_TRACKING_NOTICE}
              onClick={() => {
                setNotice(DEFAULT_TRACKING_NOTICE)
                setFeedback(null)
              }}
            >
              Restore default
            </Button>
            {dirty && <span className="text-xs font-semibold text-warning">Unsaved changes</span>}
          </div>
        </form>
      </Card>
    </div>
  )
}

export function AdminSettings() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => ContentApi.getSettings(),
  })

  const settings: SiteSettings = ((data as any)?.settings ?? {}) as SiteSettings

  const [form, setForm] = useState<any>({})
  const [message, setMessage] = useState('')

  const patchMut = useMutation({
    mutationFn: (b: any) => ContentApi.patchSettings(b),
    onSuccess: () => {
      setMessage('Settings saved.')
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
    onError: (err: any) => setMessage(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    patchMut.mutate(form)
  }

  if (isLoading) return <Spinner />

  const current = settings || {}
  const merged = { ...current, ...form }

  const set = (key: string, value: string) => setForm((p: any) => ({ ...p, [key]: value }))

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-dtl-black mb-8">Platform Settings</h1>
      <div className="space-y-6">
        <Card className="p-8">
          <h3 className="text-lg font-bold text-dtl-black mb-6">General</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-dtl-black mb-1.5">Site name</label>
              <input value={merged.site_name ?? ''} onChange={(e: any) => set('site_name', e.target.value)}
                className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dtl-black mb-1.5">Tagline</label>
              <input value={merged.tagline ?? ''} onChange={(e: any) => set('tagline', e.target.value)}
                className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
            </div>
            <Card className="p-6 bg-dtl-light-gray">
              <h4 className="font-bold text-dtl-black mb-4">Hero Section</h4>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-dtl-black mb-1.5">Headline</label>
                  <input value={merged.hero_headline ?? ''} onChange={(e: any) => set('hero_headline', e.target.value)}
                    className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dtl-black mb-1.5">Subheadline</label>
                  <input value={merged.hero_subheadline ?? ''} onChange={(e: any) => set('hero_subheadline', e.target.value)}
                    className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
                </div>
              </div>
            </Card>
            {message && <p className={`text-sm ${patchMut.isSuccess ? 'text-emerald-600' : 'text-danger'}`}>{message}</p>}
            <Button type="submit" disabled={patchMut.isPending}>{patchMut.isPending ? 'Saving...' : 'Save settings'}</Button>
          </form>
        </Card>

        <Card className="p-8">
          <h3 className="text-lg font-bold text-dtl-black mb-6">Contact Information</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-dtl-black mb-1.5">Email</label>
                <input value={merged.contact_email ?? ''} onChange={(e: any) => set('contact_email', e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dtl-black mb-1.5">Phone</label>
                <input value={merged.contact_phone ?? ''} onChange={(e: any) => set('contact_phone', e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-dtl-black mb-1.5">Address</label>
              <input value={merged.contact_address ?? ''} onChange={(e: any) => set('contact_address', e.target.value)}
                className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dtl-black mb-1.5">Business hours</label>
              <input value={merged.business_hours ?? ''} onChange={(e: any) => set('business_hours', e.target.value)}
                className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
            </div>
            {message && <p className={`text-sm ${patchMut.isSuccess ? 'text-emerald-600' : 'text-danger'}`}>{message}</p>}
            <Button type="submit" disabled={patchMut.isPending}>{patchMut.isPending ? 'Saving...' : 'Save settings'}</Button>
          </form>
        </Card>

        <Card className="p-8">
          <h3 className="text-lg font-bold text-dtl-black mb-2">Payment methods</h3>
          <p className="text-sm text-dtl-charcoal mb-5">
            Cryptocurrency wallets and bank wire accounts are now managed as individual payment options, so you can add,
            edit, hide, or remove them without a redeploy.
          </p>
          <Link to="/admin/payment-methods" className="inline-flex items-center gap-2 rounded-[14px] bg-primary px-5 py-3 text-sm font-semibold text-navy hover:bg-[#0898A0] transition">
            <Bitcoin className="size-4" /> Manage payment methods
          </Link>
        </Card>

        <Card className="p-8">
          <h3 className="text-lg font-bold text-dtl-black mb-6">Social Media</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-dtl-black mb-1.5">Facebook</label>
                <input value={merged.social_facebook ?? ''} onChange={(e: any) => set('social_facebook', e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dtl-black mb-1.5">Twitter</label>
                <input value={merged.social_twitter ?? ''} onChange={(e: any) => set('social_twitter', e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-dtl-black mb-1.5">LinkedIn</label>
                <input value={merged.social_linkedin ?? ''} onChange={(e: any) => set('social_linkedin', e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dtl-black mb-1.5">Instagram</label>
                <input value={merged.social_instagram ?? ''} onChange={(e: any) => set('social_instagram', e.target.value)}
                  className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-dtl-black mb-1.5">YouTube</label>
              <input value={merged.social_youtube ?? ''} onChange={(e: any) => set('social_youtube', e.target.value)}
                className="w-full rounded-[14px] border border-dtl-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dtl-yellow/40" />
            </div>
            {message && <p className={`text-sm ${patchMut.isSuccess ? 'text-emerald-600' : 'text-danger'}`}>{message}</p>}
            <Button type="submit" disabled={patchMut.isPending}>{patchMut.isPending ? 'Saving...' : 'Save settings'}</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

