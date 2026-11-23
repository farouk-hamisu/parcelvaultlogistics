import { useState } from 'react'
import { SectionLabel } from '../sections/_section'
import { fadeUp, scaleIn, staggerParent } from '../lib/motion'
import { Button, Card, Pill, StatusBadge, Input, Textarea, Select, Label, Spinner } from '../components/ui/primitives'
import {
  fmtDate, fmtDateTime, fmtMoney, statusLabel, paymentStatusLabel, paymentMethodLabel,
  imageFileError, fileToCompressedDataUrl, fileToDataUrl, copyToClipboard,
} from '../lib/utils'
import { PublicApi } from '../lib/api'
import { LiveMap } from '../components/tracking/live-map'
import { ContactSupportButton } from '../components/support/live-chat'
import { useParams, useNavigate, useLocation } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  MapPin, Package, Truck, Search, Image as ImageIcon, Wallet, AlertCircle,
  CheckCircle2, Upload, Gift, Megaphone, Copy, Check, Bitcoin, Building2, X, Headphones,
} from 'lucide-react'
import type { Shipment, TrackingEvent, Fee, ShipmentImage, PublicPayment, PaymentMethod } from '../lib/types'

const DEFAULT_TRACKING_NOTICE =
  'Please contact your dispatch desk if any holds have been placed on your package for delivery purposes.'

const GIFT_CARD_BRANDS = [
  'Amazon', 'Visa', 'Mastercard', 'Google Play', 'Apple / iTunes',
  'Steam', 'Walmart', 'Target', 'eBay', 'Other',
]

function RouteRow({ icon, name, country }: { icon: React.ReactNode; name?: string | null; country?: string | null }) {
  return (
    <div className="flex items-center gap-4">
      <div className="size-12 rounded-xl bg-dtl-light-gray flex items-center justify-center text-primary-dark shrink-0">{icon}</div>
      <div>
        <p className="font-semibold text-dtl-black">{name || '—'}</p>
        <p className="text-sm text-dtl-charcoal">{country || '—'}</p>
      </div>
    </div>
  )
}

function Timeline({ events, notice }: { events: TrackingEvent[]; notice?: string | null }) {
  const sorted = [...events].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
  const message = (notice ?? '').trim()
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-navy mb-6">Timeline</h3>

      {message && (
        <div role="note" aria-label="Delivery notice" className="mb-6 rounded-xl border border-primary/25 bg-primary-soft p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-navy ring-1 ring-primary/30">
              <Megaphone className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-dark">Delivery notice</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">{message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-0">
        {sorted.map((ev, i) => (
          <div key={ev.id} className="flex gap-4 pb-6 relative">
            <div className="flex flex-col items-center">
              <div className="size-3 rounded-full bg-dtl-yellow ring-2 ring-dtl-yellow/20 z-10" />
              {i < sorted.length - 1 && <div className="w-px flex-1 bg-dtl-border -mt-1" />}
            </div>
            <div className="flex-1 -mt-1">
              <p className="font-semibold text-dtl-black">{statusLabel(ev.status)}</p>
              {ev.location_label && <p className="text-sm text-dtl-charcoal flex items-center gap-1.5 mt-0.5"><MapPin className="size-3.5" />{ev.location_label}</p>}
              {ev.note && <p className="text-sm text-dtl-charcoal mt-1">{ev.note}</p>}
              <p className="text-xs text-dtl-charcoal/50 mt-1">{fmtDateTime(ev.occurred_at)}</p>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm text-dtl-charcoal">No events recorded yet.</p>}
      </div>
    </Card>
  )
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await copyToClipboard(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch { /* ignore */ }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-dark ring-1 ring-border transition hover:bg-primary-soft"
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 py-2 border-b border-border last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
      <span className={`text-right text-sm font-semibold text-navy break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function ProofUpload({
  file,
  uploading,
  error,
  onChange,
  onClear,
  hint,
}: {
  file: { path: string; name: string } | null
  uploading: boolean
  error: string
  onChange: (f: File | null) => void
  onClear: () => void
  hint: string
}) {
  return (
    <div>
      <Label>Proof of payment <span className="font-normal text-text-secondary/70">(optional)</span></Label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={e => onChange(e.target.files?.[0] || null)}
        className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-[14px] file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-dark hover:file:bg-primary/20"
      />
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
      {uploading && (
        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-primary-dark">
          <Spinner className="size-3.5" /> Uploading proof…
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {file && !uploading && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-border">
          <span className="min-w-0 truncate text-xs font-semibold text-navy">{file.name}</span>
          <button type="button" onClick={onClear} className="text-text-secondary hover:text-danger" aria-label="Remove uploaded proof">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function FeesCard({
  fees,
  payments = [],
  paymentMethods = [],
  trackingNumber,
  onPaymentSuccess,
}: {
  fees: Fee[]
  payments?: PublicPayment[]
  paymentMethods?: PaymentMethod[]
  trackingNumber: string
  onPaymentSuccess: () => void
}) {
  const unpaidFees = fees.filter(f => f.status === 'unpaid' || f.status === 'partially_paid')
  const totalDue = unpaidFees.reduce((sum, f) => sum + Number(f.amount || 0), 0)
  const submittedPayments = payments.filter(p => p.status === 'pending')

  const cryptoMethods = paymentMethods.filter(m => m.kind === 'crypto' && m.active !== false)
  const bankMethods = paymentMethods.filter(m => m.kind === 'bank' && m.active !== false)

  const [showPayment, setShowPayment] = useState(false)
  const [method, setMethod] = useState<'gift_card' | 'crypto' | 'bank'>('gift_card')
  const [submitted, setSubmitted] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  // Shared sender details
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [notes, setNotes] = useState('')

  // Gift card
  const [brand, setBrand] = useState('')
  const [customBrand, setCustomBrand] = useState('')
  const [cardValue, setCardValue] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageErr, setImageErr] = useState('')

  // Crypto + bank
  const [cryptoId, setCryptoId] = useState('')
  const [txHash, setTxHash] = useState('')
  const [bankId, setBankId] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null)
  const [proofErr, setProofErr] = useState('')
  const [uploadingProof, setUploadingProof] = useState(false)

  const finalBrand = brand === 'Other' ? customBrand.trim() : brand
  const selectedCrypto = cryptoMethods.find(m => m.id === cryptoId) || null
  const selectedBank = bankMethods.find(m => m.id === bankId) || null

  const submitPaymentMut = useMutation({
    mutationFn: async () => {
      const base = {
        tracking_number: trackingNumber,
        fee_ids: unpaidFees.map(f => f.id),
        amount: totalDue,
        sender_name: senderName,
        sender_email: senderEmail,
        notes: notes.trim() || undefined,
      }

      if (method === 'gift_card') {
        if (!brand) throw new Error('Please choose the gift card type.')
        if (brand === 'Other' && !customBrand.trim()) throw new Error('Please enter the gift card type.')
        if (!cardValue || Number(cardValue) <= 0) throw new Error('Please enter the gift card value.')
        if (!imageDataUrl) throw new Error('Please upload a clear photo of your gift card.')
        return PublicApi.submitPayment({
          ...base,
          currency: 'USD',
          method: 'gift_card',
          card_brand: finalBrand,
          card_number: cardNumber.trim() || undefined,
          card_value: Number(cardValue),
          receipt_url: imageDataUrl,
        })
      }

      if (method === 'crypto') {
        if (!selectedCrypto) throw new Error('Please choose the cryptocurrency and network.')
        if (!txHash.trim()) throw new Error('Please enter the transaction hash for your transfer.')
        return PublicApi.submitPayment({
          ...base,
          currency: selectedCrypto.currency || 'USD',
          method: 'crypto',
          payment_method_id: selectedCrypto.id,
          network: selectedCrypto.network || undefined,
          tx_hash: txHash.trim(),
          receipt_url: proof?.path,
        })
      }

      if (!selectedBank) throw new Error('Please choose the bank account you paid into.')
      if (!bankRef.trim()) throw new Error('Please enter the transfer reference from your bank.')
      return PublicApi.submitPayment({
        ...base,
        currency: selectedBank.currency || 'USD',
        method: 'bank',
        payment_method_id: selectedBank.id,
        reference: bankRef.trim(),
        receipt_url: proof?.path,
      })
    },
    onSuccess: () => { setSubmitted(true); setSubmitMsg(''); onPaymentSuccess() },
    onError: (err: any) => setSubmitMsg(err?.message || 'We couldn\u2019t complete your request. Please try again.'),
  })

  async function handleGiftImage(file: File | null) {
    setSubmitMsg('')
    if (!file) { setImageDataUrl(null); setImageErr(''); return }
    const err = imageFileError(file)
    if (err) { setImageDataUrl(null); setImageErr(err); return }
    setImageErr('')
    try {
      setImageDataUrl(await fileToCompressedDataUrl(file))
    } catch {
      setImageErr('We couldn\u2019t read that image. Please try another photo.')
      setImageDataUrl(null)
    }
  }

  async function handleProof(file: File | null) {
    setProofErr('')
    setSubmitMsg('')
    if (!file) return

    const isImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) return setProofErr('Upload a JPG, PNG or WEBP image, or a PDF document.')
    if (isImage && file.size > 10 * 1024 * 1024) return setProofErr('That image is too large. The maximum is 10 MB.')
    if (isPdf && file.size > 25 * 1024 * 1024) return setProofErr('That PDF is too large. The maximum is 25 MB.')

    setUploadingProof(true)
    try {
      const dataUrl = isImage ? await fileToCompressedDataUrl(file) : await fileToDataUrl(file)
      const res = await PublicApi.uploadProof({ tracking_number: trackingNumber, file: dataUrl })
      setProof({ path: res.path, name: file.name })
    } catch (err: any) {
      setProofErr(err?.message || 'We could not upload that file. Please try again.')
    } finally {
      setUploadingProof(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitMsg('')
    submitPaymentMut.mutate()
  }

  const methodTabs = [
    { id: 'gift_card' as const, label: 'Gift card', icon: <Gift className="size-4" />, available: true },
    {
      id: 'crypto' as const,
      label: 'Cryptocurrency',
      icon: <Bitcoin className="size-4" />,
      available: cryptoMethods.length > 0,
    },
    {
      id: 'bank' as const,
      label: 'Bank wire',
      icon: <Building2 className="size-4" />,
      available: bankMethods.length > 0,
    },
  ]

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-dtl-black mb-4 flex items-center gap-2"><Wallet className="size-5" /> Fees &amp; charges</h3>
      {fees.length === 0 ? (
        <p className="text-sm text-dtl-charcoal">No fees recorded.</p>
      ) : (
        <div className="divide-y divide-dtl-border">
          {fees.map(fee => (
            <div key={fee.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="font-semibold text-dtl-black text-sm">{fee.name}</p>
                {fee.description && <p className="text-xs text-dtl-charcoal">{fee.description}</p>}
                {fee.due_date && <p className="text-xs text-dtl-charcoal/50">Due: {fmtDate(fee.due_date)}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold text-dtl-black">{fmtMoney(fee.amount, fee.currency)}</p>
                <StatusBadge status={fee.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-dtl-charcoal mb-2">Payment submissions</p>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white ring-1 ring-dtl-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dtl-black">
                    {p.card_brand || paymentMethodLabel(p.method)}
                    {p.network ? <span className="font-normal text-dtl-charcoal"> · {p.network}</span> : null}
                    {p.card_value != null && <span className="text-dtl-charcoal font-normal"> · {fmtMoney(p.card_value, p.currency)}</span>}
                  </p>
                  <p className="text-xs text-dtl-charcoal/70">Submitted {fmtDate(p.created_at)}</p>
                  {p.tx_hash && <p className="mt-0.5 break-all font-mono text-[11px] text-dtl-charcoal/70">Tx: {p.tx_hash}</p>}
                  {p.reference && <p className="mt-0.5 break-all font-mono text-[11px] text-dtl-charcoal/70">Ref: {p.reference}</p>}
                </div>
                <StatusBadge status={p.status} label={paymentStatusLabel(p.status)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {unpaidFees.length > 0 && !showPayment && !submitted && submittedPayments.length === 0 && (
        <div className="mt-6 rounded-xl border border-dtl-yellow/30 bg-dtl-yellow/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-primary-dark shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-warning">Payment required</p>
              <p className="text-sm text-dtl-charcoal mt-1">Outstanding balance: <strong>{fmtMoney(totalDue)}</strong></p>
              <p className="text-sm text-dtl-charcoal/70 mt-0.5">
                Pay by gift card, cryptocurrency, or bank wire transfer. Every payment is verified by our finance team before your balance is updated.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {methodTabs.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!t.available}
                    onClick={() => { setMethod(t.id); setShowPayment(true); setSubmitMsg('') }}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-navy ring-1 ring-border transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {unpaidFees.length > 0 && !showPayment && !submitted && submittedPayments.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-dtl-yellow/30 bg-dtl-yellow/10 p-4">
          <AlertCircle className="size-5 text-primary-dark shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning">Awaiting verification</p>
            <p className="text-sm text-dtl-charcoal mt-1">
              Your {submittedPayments.length === 1 ? 'payment is' : 'payments are'} pending verification. Outstanding balance: <strong>{fmtMoney(totalDue)}</strong>.
            </p>
            <p className="text-sm text-dtl-charcoal/70 mt-0.5">Our finance team will review it shortly — no further action is needed right now.</p>
          </div>
        </div>
      )}

      {showPayment && !submitted && (
        <div className="mt-6 rounded-xl border border-dtl-border bg-dtl-light-gray p-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {methodTabs.map(t => (
              <button
                key={t.id}
                type="button"
                disabled={!t.available}
                onClick={() => { setMethod(t.id); setSubmitMsg(''); setProof(null); setProofErr('') }}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  method === t.id ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-border hover:bg-primary-soft'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {method !== 'gift_card' && methodTabs.find(t => t.id === method)?.available === false && (
            <p className="mt-3 rounded-lg bg-white p-3 text-xs text-warning ring-1 ring-border">
              No {method === 'crypto' ? 'cryptocurrency' : 'bank transfer'} options are available right now. Please contact customer support.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pay-name">Your name <span className="text-primary-dark">*</span></Label>
                <Input id="pay-name" placeholder="Full name" value={senderName} onChange={e => setSenderName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="pay-email">Your email <span className="text-primary-dark">*</span></Label>
                <Input id="pay-email" type="email" placeholder="you@example.com" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} required />
              </div>
            </div>

            {method === 'gift_card' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="gc-brand">Gift card type <span className="text-primary-dark">*</span></Label>
                    <Select id="gc-brand" value={brand} onChange={e => setBrand(e.target.value)} required>
                      <option value="">Select a brand</option>
                      {GIFT_CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </Select>
                  </div>

                  {brand === 'Other' && (
                    <div>
                      <Label htmlFor="gc-brand-other">Gift card type <span className="text-primary-dark">*</span></Label>
                      <Input id="gc-brand-other" placeholder="e.g. Nike" value={customBrand} onChange={e => setCustomBrand(e.target.value)} required />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="gc-value">Gift card value (USD) <span className="text-primary-dark">*</span></Label>
                    <Input id="gc-value" type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 50.00"
                      value={cardValue} onChange={e => setCardValue(e.target.value)} required />
                    <p className="mt-1 text-xs text-dtl-charcoal/70">Should cover the outstanding balance of {fmtMoney(totalDue)}.</p>
                  </div>

                  <div>
                    <Label htmlFor="gc-number">Card number or code <span className="font-normal text-dtl-charcoal/60">(optional)</span></Label>
                    <Input id="gc-number" placeholder="e.g. 1234 5678 9012" value={cardNumber} onChange={e => setCardNumber(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="gc-photo">Photo of the gift card <span className="text-primary-dark">*</span></Label>
                  <input id="gc-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleGiftImage(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-dtl-charcoal file:mr-4 file:py-2 file:px-4 file:rounded-[14px] file:border-0 file:text-sm file:font-semibold file:bg-dtl-yellow/20 file:text-dtl-black hover:file:bg-dtl-yellow/40" />
                  {imageErr && <p className="mt-1.5 text-xs text-danger">{imageErr}</p>}
                  {imageDataUrl && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-dtl-border">
                      <img src={imageDataUrl} alt="Gift card preview" className="h-20 max-w-[10rem] w-auto object-contain rounded-lg" />
                      <p className="text-xs text-dtl-charcoal">Photo attached — make sure the card type, value and code are readable.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {method === 'crypto' && (
              <>
                {cryptoMethods.length === 0 ? (
                  <p className="rounded-xl bg-white p-4 text-sm text-text-secondary ring-1 ring-border">
                    No cryptocurrencies are configured yet. Please contact customer support.
                  </p>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="crypto-choice">Cryptocurrency &amp; network <span className="text-primary-dark">*</span></Label>
                      <Select id="crypto-choice" value={cryptoId} onChange={e => setCryptoId(e.target.value)} required>
                        <option value="">Select a cryptocurrency</option>
                        {cryptoMethods.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}{m.network ? ` — ${m.network}` : ''}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {selectedCrypto && (
                      <div className="rounded-xl bg-white p-4 ring-1 ring-border">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-dark">Send exactly {fmtMoney(totalDue, selectedCrypto.currency || 'USD')}</p>
                          {selectedCrypto.network && <span className="rounded-pill bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary-dark">{selectedCrypto.network}</span>}
                        </div>
                        <div className="mt-3 rounded-lg bg-background p-3 ring-1 ring-border">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Wallet address</p>
                          <div className="mt-1 flex items-start gap-2">
                            <code className="min-w-0 flex-1 break-all font-mono text-xs text-navy">{selectedCrypto.wallet_address}</code>
                            <CopyButton value={selectedCrypto.wallet_address || ''} label="Address" />
                          </div>
                        </div>
                        <div className="mt-3">
                          <DetailRow label="Network" value={selectedCrypto.network} />
                          <DetailRow label="Coin" value={selectedCrypto.name} />
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                          {selectedCrypto.instructions || 'Send only the selected coin on the stated network. Transfers on any other network cannot be recovered.'}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-warning">
                          Use tracking number {trackingNumber} as the payment reference where your wallet supports it.
                        </p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="crypto-hash">Transaction hash <span className="text-primary-dark">*</span></Label>
                      <Input id="crypto-hash" placeholder="Paste the transaction hash / TxID" value={txHash} onChange={e => setTxHash(e.target.value)} required />
                      <p className="mt-1 text-xs text-dtl-charcoal/70">You can copy this from your wallet after the transfer is confirmed.</p>
                    </div>
                  </>
                )}
              </>
            )}

            {method === 'bank' && (
              <>
                {bankMethods.length === 0 ? (
                  <p className="rounded-xl bg-white p-4 text-sm text-text-secondary ring-1 ring-border">
                    No bank transfer details are configured yet. Please contact customer support.
                  </p>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="bank-choice">Bank account <span className="text-primary-dark">*</span></Label>
                      <Select id="bank-choice" value={bankId} onChange={e => setBankId(e.target.value)} required>
                        <option value="">Select a bank account</option>
                        {bankMethods.map(m => (
                          <option key={m.id} value={m.id}>{m.name}{m.bank_name && m.bank_name !== m.name ? ` — ${m.bank_name}` : ''}</option>
                        ))}
                      </Select>
                    </div>

                    {selectedBank && (
                      <div className="rounded-xl bg-white p-4 ring-1 ring-border">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-dark">Bank wire instructions</p>
                        <div className="mt-2">
                          <DetailRow label="Beneficiary" value={selectedBank.beneficiary_name} />
                          <DetailRow label="Bank" value={selectedBank.bank_name} />
                          <DetailRow label="Account number" value={selectedBank.account_number} mono />
                          <DetailRow label="IBAN" value={selectedBank.iban} mono />
                          <DetailRow label="SWIFT / BIC" value={selectedBank.swift_bic} mono />
                          <DetailRow label="Routing number" value={selectedBank.routing_number} mono />
                          <DetailRow label="Account type" value={selectedBank.account_type} />
                          <DetailRow label="Bank address" value={selectedBank.bank_address} />
                          <DetailRow label="Amount" value={fmtMoney(totalDue, selectedBank.currency || 'USD')} />
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                          {selectedBank.instructions || 'Include the payment reference below so our finance team can match your transfer to this shipment.'}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="bank-ref">Transfer reference <span className="text-primary-dark">*</span></Label>
                      <Input id="bank-ref" placeholder={`e.g. ${trackingNumber}`} value={bankRef} onChange={e => setBankRef(e.target.value)} required />
                      <p className="mt-1 text-xs text-dtl-charcoal/70">The reference or memo shown on your bank transfer.</p>
                    </div>
                  </>
                )}
              </>
            )}

            {method !== 'gift_card' && <ProofUpload file={proof} uploading={uploadingProof} error={proofErr} onChange={handleProof} onClear={() => setProof(null)} hint="JPG, PNG, WEBP up to 10 MB, or PDF up to 25 MB." />}

            <div>
              <Label htmlFor="pay-notes">Additional information <span className="font-normal text-dtl-charcoal/60">(optional)</span></Label>
              <Textarea id="pay-notes" rows={3}
                placeholder="Anything that helps us verify your payment."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            {submitMsg && (
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="size-4 shrink-0 mt-0.5" /> {submitMsg}
              </p>
            )}

            <Button type="submit" disabled={submitPaymentMut.isPending || uploadingProof} className="w-full">
              {submitPaymentMut.isPending
                ? <><Spinner className="size-4" /> Submitting…</>
                : <><Upload className="size-4" /> Submit payment for verification</>}
            </Button>
            <p className="text-center text-xs text-dtl-charcoal/70">
              Your submission will show as <strong className="text-dtl-black">Pending verification</strong> until our team reviews it.
            </p>
          </form>
        </div>
      )}

      {submitted && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Payment submitted successfully</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-dtl-yellow/30 px-3 py-1 text-xs font-bold text-dtl-black ring-1 ring-dtl-yellow/60">
                <span className="size-1.5 rounded-full bg-dtl-black" /> Pending verification
              </span>
              <p className="mt-2 text-sm text-emerald-800">
                Your payment is awaiting verification. Our finance team reviews every submission before it is applied to your balance
                {senderEmail ? ` — we'll email ${senderEmail} with the result.` : '.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function TrackPage() {
  const params = useParams({ strict: false })
  const location = useLocation()
  const match = location.pathname.match(/^\/track\/(.+)/)
  const rawTn = (params as any).trackingNumber || (match ? decodeURIComponent(match[1]) : undefined)
  const trackingNumber = rawTn ? rawTn.replace(/^#/, '') : undefined
  const navigate = useNavigate()
  const [query, setQuery] = useState(trackingNumber || '')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['track', trackingNumber],
    queryFn: () => PublicApi.track(trackingNumber!),
    enabled: !!trackingNumber,
  })

  const shipment: Shipment | null = data?.shipment ?? null
  const events: TrackingEvent[] = data?.events ?? []
  const fees: Fee[] = data?.fees ?? []
  const images: ShipmentImage[] = data?.images ?? []
  const payments: PublicPayment[] = data?.payments ?? []
  const paymentMethods: PaymentMethod[] = data?.payment_methods ?? []
  const notice: string = data?.notice ?? DEFAULT_TRACKING_NOTICE

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim().replace(/^#/, '')
    if (q) navigate({ to: '/track/$trackingNumber', params: { trackingNumber: q } })
  }

  return (
    <div className="bg-white min-h-screen">
      <section className="relative bg-dtl-charcoal text-white py-20 overflow-hidden">
        <div className="absolute inset-0 grid-overlay opacity-30" />
        <div className="relative mx-auto max-w-[1320px] px-6">
          <SectionLabel>Track shipment</SectionLabel>
          <h1 className="mt-4 text-4xl lg:text-[3.2rem] font-bold leading-[1.08] text-balance">Real-time visibility, end to end.</h1>
          <form onSubmit={handleSearch} className="mt-8 flex gap-3 max-w-lg">
            <input value={query} onChange={e => setQuery(e.target.value)}
              className="flex-1 rounded-[14px] border border-white/20 bg-white/20 px-5 py-3.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-dtl-yellow/60"
              placeholder="Enter tracking number..." />
            <Button type="submit" className="shrink-0"><Search className="size-4" /> Track</Button>
          </form>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/75">
            <Headphones className="size-4 text-dtl-yellow" />
            <span>Questions about a shipment or a hold?</span>
            <ContactSupportButton variant="onDark" size="sm" icon="headset" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-6 py-20">
        {!trackingNumber && (
          <div className="text-center py-20 text-dtl-charcoal">
            <Package className="size-16 mx-auto mb-4 text-dtl-border" />
            <p className="text-xl font-semibold text-dtl-black">Enter a tracking number to get started</p>
            <p className="mx-auto mt-2 max-w-md text-sm">Your tracking number is in your booking confirmation. Need a hand finding it?</p>
            <div className="mt-5 flex justify-center">
              <ContactSupportButton variant="outline" size="sm" icon="headset" />
            </div>
          </div>
        )}

        {isLoading && <div className="text-center py-20"><div className="size-8 border-2 border-dtl-border border-t-dtl-yellow rounded-full animate-spin mx-auto" /></div>}
        {error && (
          <div className="text-center py-20 text-danger">
            {/not found|tracking number/i.test(String((error as any)?.message || ''))
              ? 'No shipment found for that tracking number. Please check and try again.'
              : 'We couldn’t complete your request. Please try again.'}
          </div>
        )}

        {shipment && (
          <motion.div variants={staggerParent} initial="hidden" animate="show" className="space-y-8">
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Pill>{shipment.service || 'Standard'}</Pill>
                <h2 className="text-2xl font-bold text-dtl-black mt-2">#{shipment.tracking_number}</h2>
                <p className="text-sm text-dtl-charcoal">Created {fmtDate(shipment.created_at)}</p>
              </div>
              <StatusBadge status={shipment.status} />
            </motion.div>

            {shipment.origin_lat != null && shipment.origin_lng != null &&
             shipment.destination_lat != null && shipment.destination_lng != null &&
             shipment.current_lat != null && shipment.current_lng != null && (
              <motion.div variants={scaleIn} className="h-[360px] rounded-card overflow-hidden ring-1 ring-dtl-border">
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
              </motion.div>
            )}

            <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-6">
              <RouteRow icon={<MapPin className="size-5" />} name={shipment.origin_name} country={shipment.origin_country} />
              <RouteRow icon={<MapPin className="size-5" />} name={shipment.destination_name} country={shipment.destination_country} />
            </motion.div>

            <motion.div variants={fadeUp}>
              <Timeline events={events} notice={notice} />
            </motion.div>

            <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-6">
              <div>
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-dtl-black mb-4">Shipment details</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between"><dt className="text-dtl-charcoal">Weight</dt><dd className="font-semibold text-dtl-black">{shipment.weight_kg ? `${shipment.weight_kg} kg` : '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-dtl-charcoal">Pieces</dt><dd className="font-semibold text-dtl-black">{shipment.pieces ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-dtl-charcoal">Dimensions</dt><dd className="font-semibold text-dtl-black">{shipment.dimensions || '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-dtl-charcoal">Est. delivery</dt><dd className="font-semibold text-dtl-black">{fmtDate(shipment.estimated_delivery)}</dd></div>
                    {shipment.reference && <div className="flex justify-between"><dt className="text-dtl-charcoal">Reference</dt><dd className="font-semibold text-dtl-black">{shipment.reference}</dd></div>}
                    <div className="flex justify-between"><dt className="text-dtl-charcoal">Sender</dt><dd className="font-semibold text-dtl-black">{shipment.sender_name || '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-dtl-charcoal">Receiver</dt><dd className="font-semibold text-dtl-black">{shipment.receiver_name || '—'}</dd></div>
                  </dl>
                </Card>
                {shipment.current_location_label && (
                  <Card className="p-6 mt-6">
                    <div className="flex items-center gap-3 text-sm">
                      <Truck className="size-5 text-primary-dark shrink-0" />
                      <span className="text-dtl-charcoal">Current: <strong className="text-dtl-black">{shipment.current_location_label}</strong></span>
                    </div>
                  </Card>
                )}
              </div>
              <div className="space-y-6">
                <FeesCard fees={fees} payments={payments} paymentMethods={paymentMethods} trackingNumber={shipment.tracking_number} onPaymentSuccess={() => refetch()} />
              </div>
            </motion.div>

            {images.length > 0 && (
              <motion.div variants={fadeUp}>
                <Card className="p-6">
                  <h3 className="text-lg font-bold text-dtl-black mb-4 flex items-center gap-2"><ImageIcon className="size-5" /> Shipment media</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map(img => {
                      const isVideo = /\.(mp4|webm|mov|ogv|ogg)(\?|#|$)/i.test(img.url)
                      const isPdf = /\.pdf(\?|#|$)/i.test(img.url)
                      return (
                        <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer"
                          className="block rounded-xl overflow-hidden ring-1 ring-dtl-border hover:ring-dtl-yellow/50 transition">
                          {isVideo ? (
                            <div className="relative bg-navy">
                              <video src={img.url} muted playsInline preload="metadata" className="w-full h-32 object-cover opacity-80" />
                              <span className="absolute inset-0 grid place-items-center text-white">
                                <span className="grid size-8 place-items-center rounded-full bg-black/50">▶</span>
                              </span>
                            </div>
                          ) : isPdf ? (
                            <div className="flex h-32 flex-col items-center justify-center gap-1 bg-dtl-light-gray text-dtl-charcoal">
                              <span className="text-2xl font-bold text-primary-dark">PDF</span>
                              <span className="text-[11px] font-semibold uppercase tracking-wide">View document</span>
                            </div>
                          ) : (
                            <img src={img.url} alt={img.caption || ''} className="w-full h-32 object-cover" />
                          )}
                          {img.caption && <p className="text-xs text-dtl-charcoal p-2">{img.caption}</p>}
                        </a>
                      )
                    })}
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}
      </section>
    </div>
  )
}
