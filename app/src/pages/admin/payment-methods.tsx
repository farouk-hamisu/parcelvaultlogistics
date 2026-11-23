import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PaymentMethodsApi } from '../../lib/api'
import { Button, Card, Input, Label, Select, Spinner, Textarea } from '../../components/ui/primitives'
import {
  Bitcoin, Building2, Plus, Trash2, Edit3, X, CheckCircle2, AlertCircle, Save, Power,
} from 'lucide-react'
import type { PaymentMethod, PaymentMethodKind } from '../../lib/types'

const EMPTY_CRYPTO = {
  kind: 'crypto' as PaymentMethodKind,
  name: '',
  currency: '',
  network: '',
  wallet_address: '',
  instructions: '',
  reference_label: '',
  sort_order: 0,
  active: true,
}

const EMPTY_BANK = {
  kind: 'bank' as PaymentMethodKind,
  name: '',
  currency: 'USD',
  beneficiary_name: '',
  bank_name: '',
  account_number: '',
  swift_bic: '',
  iban: '',
  routing_number: '',
  account_type: '',
  bank_address: '',
  instructions: '',
  reference_label: '',
  sort_order: 0,
  active: true,
}

type Draft = typeof EMPTY_CRYPTO | typeof EMPTY_BANK

function Field({
  label, value, onChange, placeholder, type = 'text', required, hint, className,
}: {
  label: string
  value: any
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  hint?: string
  className?: string
}) {
  return (
    <div className={className}>
      <Label>{label}{required && <span className="text-primary-dark"> *</span>}</Label>
      <Input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  )
}

export function AdminPaymentMethods() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<PaymentMethod | 'new-crypto' | 'new-bank' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_CRYPTO)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: () => PaymentMethodsApi.list(),
  })

  const methods: PaymentMethod[] = (data as any)?.methods ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] })
    queryClient.invalidateQueries({ queryKey: ['track'] })
    queryClient.invalidateQueries({ queryKey: ['public-payment-methods'] })
  }

  const saveMut = useMutation({
    mutationFn: () => {
      if (editing === 'new-crypto' || editing === 'new-bank') return PaymentMethodsApi.create(draft)
      if (editing && typeof editing !== 'string') return PaymentMethodsApi.update(editing.id, draft)
      throw new Error('Nothing to save')
    },
    onSuccess: () => {
      setFeedback({ kind: 'success', text: 'Payment option saved. Customers see the change immediately.' })
      setEditing(null)
      invalidate()
    },
    onError: (err: any) => setFeedback({ kind: 'error', text: err?.message || 'Could not save this payment option.' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => PaymentMethodsApi.remove(id),
    onSuccess: () => {
      setFeedback({ kind: 'success', text: 'Payment option removed.' })
      setEditing(null)
      invalidate()
    },
    onError: (err: any) => setFeedback({ kind: 'error', text: err?.message || 'Could not remove this payment option.' }),
  })

  const toggleMut = useMutation({
    mutationFn: (m: PaymentMethod) => PaymentMethodsApi.update(m.id, { active: !m.active }),
    onSuccess: () => invalidate(),
    onError: (err: any) => setFeedback({ kind: 'error', text: err?.message || 'Could not update this payment option.' }),
  })

  useEffect(() => {
    if (editing === 'new-crypto') setDraft({ ...EMPTY_CRYPTO })
    else if (editing === 'new-bank') setDraft({ ...EMPTY_BANK })
    else if (editing && typeof editing !== 'string') setDraft({ ...(EMPTY_CRYPTO as any), ...editing })
    setFeedback(null)
  }, [editing])

  const set = (key: string, value: any) => setDraft(prev => ({ ...prev, [key]: value }))

  const crypto = methods.filter(m => m.kind === 'crypto')
  const bank = methods.filter(m => m.kind === 'bank')
  const isCrypto = draft.kind === 'crypto'

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Payment methods</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Manage the cryptocurrency wallets and bank accounts customers can pay with. Everything here is stored in the
            database and appears on the tracking page immediately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditing('new-crypto')}><Bitcoin className="size-4" /> Add cryptocurrency</Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing('new-bank')}><Building2 className="size-4" /> Add bank account</Button>
        </div>
      </div>

      {isLoading && <Spinner />}
      {error && <p className="text-sm text-danger">{(error as any)?.message || 'Could not load payment methods.'}</p>}

      {feedback && (
        <div className={`mb-6 flex items-start gap-2 rounded-xl p-4 text-sm ${
          feedback.kind === 'success' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
        }`}>
          {feedback.kind === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {feedback.text}
        </div>
      )}

      {editing && (
        <Card className="mb-8 p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-navy">
                {editing === 'new-crypto' && 'New cryptocurrency'}
                {editing === 'new-bank' && 'New bank account'}
                {editing !== 'new-crypto' && editing !== 'new-bank' && 'Edit payment option'}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {isCrypto ? 'Wallet details customers use to send crypto.' : 'Bank details customers use for wire transfers.'}
              </p>
            </div>
            <button onClick={() => setEditing(null)} className="rounded-lg p-2 text-text-secondary hover:bg-background" aria-label="Close form">
              <X className="size-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); setFeedback(null); saveMut.mutate() }}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={isCrypto ? 'Cryptocurrency name' : 'Display name'}
                value={draft.name}
                onChange={v => set('name', v)}
                placeholder={isCrypto ? 'e.g. Bitcoin' : 'e.g. Chase USD account'}
                required
              />
              <Field
                label="Currency"
                value={draft.currency}
                onChange={v => set('currency', v)}
                placeholder={isCrypto ? 'e.g. BTC' : 'e.g. USD'}
                hint={isCrypto ? 'Shown to customers next to the amount.' : 'Currency of the account.'}
              />

              {isCrypto ? (
                <>
                  <Field label="Network" value={(draft as any).network} onChange={v => set('network', v)} placeholder="e.g. Bitcoin, ERC20, TRC20" hint="Customers must send on this network." />
                  <Field label="Wallet address" value={(draft as any).wallet_address} onChange={v => set('wallet_address', v)} placeholder="Destination wallet address" required className="sm:col-span-2" />
                </>
              ) : (
                <>
                  <Field label="Beneficiary name" value={(draft as any).beneficiary_name} onChange={v => set('beneficiary_name', v)} placeholder="Account holder" required />
                  <Field label="Bank name" value={(draft as any).bank_name} onChange={v => set('bank_name', v)} placeholder="Bank" required />
                  <Field label="Account number" value={(draft as any).account_number} onChange={v => set('account_number', v)} placeholder="Account number" />
                  <Field label="IBAN" value={(draft as any).iban} onChange={v => set('iban', v)} placeholder="IBAN" />
                  <Field label="SWIFT / BIC" value={(draft as any).swift_bic} onChange={v => set('swift_bic', v)} placeholder="SWIFT / BIC" />
                  <Field label="Routing number" value={(draft as any).routing_number} onChange={v => set('routing_number', v)} placeholder="Routing / sort code" />
                  <Field label="Account type" value={(draft as any).account_type} onChange={v => set('account_type', v)} placeholder="e.g. Business checking" />
                  <Field label="Bank address" value={(draft as any).bank_address} onChange={v => set('bank_address', v)} placeholder="Bank branch address" />
                  <Field
                    label="Reference label"
                    value={(draft as any).reference_label}
                    onChange={v => set('reference_label', v)}
                    placeholder="e.g. Transfer reference"
                    hint="What customers should put on the transfer."
                    className="sm:col-span-2"
                  />
                </>
              )}
            </div>

            <div>
              <Label>Instructions for customers</Label>
              <Textarea
                rows={3}
                value={(draft as any).instructions ?? ''}
                onChange={e => set('instructions', e.target.value)}
                placeholder={isCrypto
                  ? 'Send only the selected coin on the stated network. Include your tracking number where possible.'
                  : 'Include your tracking number as the payment reference so we can match the transfer.'}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sort order" type="number" value={(draft as any).sort_order ?? 0} onChange={v => set('sort_order', Number(v) || 0)} hint="Lower numbers appear first." />
              <div>
                <Label>Availability</Label>
                <Select value={draft.active ? 'active' : 'inactive'} onChange={e => set('active', e.target.value === 'active')}>
                  <option value="active">Active — visible to customers</option>
                  <option value="inactive">Inactive — hidden</option>
                </Select>
              </div>
            </div>

            {feedback?.kind === 'error' && (
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {feedback.text}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveMut.isPending}>
                <Save className="size-4" /> {saveMut.isPending ? 'Saving…' : 'Save payment option'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <MethodSection
        title="Cryptocurrencies"
        icon={<Bitcoin className="size-5 text-primary-dark" />}
        empty="No cryptocurrencies configured yet. Add one so customers can pay with crypto."
        methods={crypto}
        onEdit={setEditing}
        onDelete={(m) => { if (window.confirm(`Remove ${m.name}? Customers will no longer see this option.`)) deleteMut.mutate(m.id) }}
        onToggle={(m) => toggleMut.mutate(m)}
        busy={deleteMut.isPending || toggleMut.isPending}
      />

      <MethodSection
        title="Bank wire accounts"
        icon={<Building2 className="size-5 text-primary-dark" />}
        empty="No bank accounts configured yet. Add one so customers can pay by wire transfer."
        methods={bank}
        onEdit={setEditing}
        onDelete={(m) => { if (window.confirm(`Remove ${m.name}? Customers will no longer see this option.`)) deleteMut.mutate(m.id) }}
        onToggle={(m) => toggleMut.mutate(m)}
        busy={deleteMut.isPending || toggleMut.isPending}
      />
    </div>
  )
}

function MethodSection({
  title, icon, empty, methods, onEdit, onDelete, onToggle, busy,
}: {
  title: string
  icon: React.ReactNode
  empty: string
  methods: PaymentMethod[]
  onEdit: (m: PaymentMethod) => void
  onDelete: (m: PaymentMethod) => void
  onToggle: (m: PaymentMethod) => void
  busy: boolean
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-navy">{icon} {title}</h2>
      {methods.length === 0 ? (
        <div className="rounded-card bg-background p-6 text-center text-sm text-text-secondary ring-1 ring-border">{empty}</div>
      ) : (
        <div className="space-y-3">
          {methods.map(m => (
            <Card key={m.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-navy">{m.name}</p>
                    {m.network && <span className="rounded-pill bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-primary-dark">{m.network}</span>}
                    <span className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${m.active ? 'bg-success-bg text-success' : 'bg-background text-text-secondary ring-1 ring-border'}`}>
                      {m.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-text-secondary">
                    {m.kind === 'crypto'
                      ? m.wallet_address
                      : [m.beneficiary_name, m.bank_name, m.account_number && `Acct ${m.account_number}`, m.iban && `IBAN ${m.iban}`, m.swift_bic && `SWIFT ${m.swift_bic}`].filter(Boolean).join(' · ')}
                  </p>
                  {m.instructions && <p className="mt-2 line-clamp-2 text-xs text-text-secondary">{m.instructions}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => onToggle(m)} disabled={busy} title={m.active ? 'Hide from customers' : 'Show to customers'}
                    className="rounded-lg p-2 text-text-secondary transition hover:bg-background disabled:opacity-50">
                    <Power className="size-4" />
                  </button>
                  <button onClick={() => onEdit(m)} className="rounded-lg p-2 text-primary-dark transition hover:bg-primary-soft" title="Edit">
                    <Edit3 className="size-4" />
                  </button>
                  <button onClick={() => onDelete(m)} disabled={busy} className="rounded-lg p-2 text-danger transition hover:bg-danger-bg disabled:opacity-50" title="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
