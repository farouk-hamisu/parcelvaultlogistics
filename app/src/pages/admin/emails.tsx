import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmailsApi } from '../../lib/api'
import { Button, Card, Input, Label, Spinner, Textarea } from '../../components/ui/primitives'
import { fmtDateTime } from '../../lib/utils'
import type { EmailCustomer, EmailMessage, EmailTemplate } from '../../lib/types'
import {
  Mail, Send, Search, X, CheckCircle2, AlertCircle, Eye, RefreshCw, UserRound, Inbox,
} from 'lucide-react'

type PreviewPayload = {
  customer_id: string
  email: string
  subject: string
  body: string
  tracking_number: string
  template_key: string
  force?: number
}

const EMPTY_FORM = {
  subject: '',
  body: '',
  tracking_number: '',
  template_key: '',
}

export function AdminEmails() {
  const queryClient = useQueryClient()

  const templatesQuery = useQuery({ queryKey: ['email-templates'], queryFn: () => EmailsApi.templates() })
  const customersQuery = useQuery({ queryKey: ['email-customers'], queryFn: () => EmailsApi.customers() })
  const messagesQuery = useQuery({ queryKey: ['email-messages'], queryFn: () => EmailsApi.messages(15) })

  const templates: EmailTemplate[] = (templatesQuery.data as any)?.templates ?? []
  const customers: EmailCustomer[] = (customersQuery.data as any)?.customers ?? []
  const messages: EmailMessage[] = (messagesQuery.data as any)?.messages ?? []
  const configured: boolean = Boolean((templatesQuery.data as any)?.configured)
  const senderAddress: string = (templatesQuery.data as any)?.from ?? 'ParcelVault Logistics <support@parcelvaultlogistics.com>'

  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedCustomer, setSelectedCustomer] = useState<EmailCustomer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [previewInput, setPreviewInput] = useState<PreviewPayload | null>(null)
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string; id?: string | null } | null>(null)

  const set = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const chooseTemplate = (template: EmailTemplate | null) => {
    setResult(null)
    if (!template) {
      setForm(EMPTY_FORM)
      return
    }
    setForm({
      subject: template.subject,
      body: template.body,
      tracking_number: form.tracking_number,
      template_key: template.key,
    })
  }

  const chooseCustomer = (customer: EmailCustomer) => {
    setSelectedCustomer(customer)
    setCustomerSearch('')
    setCustomerOpen(false)
    setResult(null)
  }

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    const list = q
      ? customers.filter(c =>
          (c.full_name || '').toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q))
      : customers
    return list.slice(0, 40)
  }, [customers, customerSearch])

  // Debounce the preview so typing is smooth and we do not hammer the API.
  useEffect(() => {
    if (!selectedCustomer || !form.subject.trim() || !form.body.trim()) {
      setPreviewInput(null)
      return
    }
    const timer = setTimeout(() => {
      setPreviewInput({
        customer_id: selectedCustomer.id,
        email: selectedCustomer.email,
        subject: form.subject,
        body: form.body,
        tracking_number: form.tracking_number,
        template_key: form.template_key,
      })
    }, 450)
    return () => clearTimeout(timer)
  }, [selectedCustomer, form.subject, form.body, form.tracking_number, form.template_key])

  const previewQuery = useQuery({
    queryKey: ['email-preview', previewInput],
    enabled: !!previewInput,
    queryFn: () => EmailsApi.preview(previewInput),
    retry: false,
  })

  const sendMut = useMutation({
    mutationFn: () => {
      if (!selectedCustomer) throw new Error('Please choose a recipient.')
      if (!form.subject.trim()) throw new Error('Please add an email subject.')
      if (!form.body.trim()) throw new Error('Please write the email body.')
      return EmailsApi.send({
        customer_id: selectedCustomer.id,
        email: selectedCustomer.email,
        subject: form.subject.trim(),
        body: form.body,
        tracking_number: form.tracking_number.trim() || undefined,
        template_key: form.template_key || undefined,
      })
    },
    onSuccess: (data: any) => {
      setResult({
        kind: 'success',
        text: `Email sent to ${data?.recipient?.email || selectedCustomer?.email}.`,
        id: data?.id ?? null,
      })
      queryClient.invalidateQueries({ queryKey: ['email-messages'] })
    },
    onError: (err: any) => setResult({
      kind: 'error',
      text: err?.message || 'The email could not be sent. Please try again.',
    }),
  })

  const canSend = Boolean(selectedCustomer) && !!form.subject.trim() && !!form.body.trim() && configured && !sendMut.isPending
  const previewHtml: string | undefined = (previewQuery.data as any)?.html
  const previewError: string | undefined = previewQuery.error
    ? (previewQuery.error as any)?.message || 'Preview unavailable.'
    : undefined

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Email templates</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Compose a branded email, choose a professionally designed template, and send it straight to a registered
            customer. Messages are delivered through Resend from <strong className="text-navy">{senderAddress}</strong>.
          </p>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 text-xs text-text-secondary ring-1 ring-border">
          <p className="font-semibold text-navy">Sender address</p>
          <p className="mt-0.5 break-all">{senderAddress}</p>
        </div>
      </div>

      {!templatesQuery.isLoading && !configured && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-warning/30 bg-dtl-yellow/10 p-4 text-sm text-warning">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Email sending is not configured</p>
            <p className="mt-1 text-text-secondary">
              Add <code className="rounded bg-white px-1 py-0.5 text-xs">RESEND_API_KEY</code> to the API environment and
              restart the server. You can still preview messages in the meantime.
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className={`mb-6 flex items-start gap-3 rounded-card p-4 text-sm ${
          result.kind === 'success' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
        }`}>
          {result.kind === 'success'
            ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            : <AlertCircle className="mt-0.5 size-5 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold">{result.kind === 'success' ? 'Email sent successfully' : 'Email not sent'}</p>
            <p className="mt-0.5 break-words">{result.text}</p>
            {result.id && <p className="mt-1 break-all font-mono text-xs opacity-80">Provider ID: {result.id}</p>}
          </div>
          <button onClick={() => setResult(null)} className="ml-auto rounded-lg p-1 hover:bg-black/5" aria-label="Dismiss message">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Composer */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
                <Mail className="size-5 text-primary-dark" /> Choose a template
              </h2>
              <button
                type="button"
                onClick={() => chooseTemplate(null)}
                className="text-xs font-semibold text-text-secondary hover:text-navy"
              >
                Start blank
              </button>
            </div>

            {templatesQuery.isLoading && <Spinner />}
            {templatesQuery.error && (
              <p className="text-sm text-danger">{(templatesQuery.error as any)?.message || 'Could not load templates.'}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map(template => {
                const active = form.template_key === template.key
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => chooseTemplate(template)}
                    className={`rounded-xl p-4 text-left ring-1 transition ${
                      active
                        ? 'bg-primary-soft ring-primary'
                        : 'bg-white ring-border hover:bg-background'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-navy">{template.name}</p>
                      {active && <CheckCircle2 className="size-4 shrink-0 text-primary-dark" />}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                      {template.description || template.subject}
                    </p>
                    <span className="mt-2 inline-block rounded-pill bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-dark ring-1 ring-border">
                      {template.category}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-navy">
              <UserRound className="size-5 text-primary-dark" /> Recipient
            </h2>

            {selectedCustomer ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft p-4 ring-1 ring-primary/20">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy">
                    {selectedCustomer.full_name || selectedCustomer.email}
                  </p>
                  <p className="truncate text-xs text-text-secondary">{selectedCustomer.email}</p>
                  {selectedCustomer.company && (
                    <p className="truncate text-xs text-text-secondary">{selectedCustomer.company}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedCustomer(null); setResult(null) }}
                >
                  <X className="size-4" /> Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerOpen(true) }}
                    onFocus={() => setCustomerOpen(true)}
                    onBlur={(e) => {
                      const next = e.relatedTarget as Node | null
                      if (!e.currentTarget.parentElement?.parentElement?.contains(next)) setCustomerOpen(false)
                    }}
                    placeholder="Search registered customers by name, email or company…"
                    className="pl-10"
                    aria-label="Search customers"
                    autoComplete="off"
                  />
                </div>

                {customerOpen && (
                  <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-border">
                    {customersQuery.isLoading && <p className="p-3 text-sm text-text-secondary">Loading customers…</p>}
                    {customersQuery.error && (
                      <p className="p-3 text-sm text-danger">{(customersQuery.error as any)?.message || 'Could not load customers.'}</p>
                    )}
                    {!customersQuery.isLoading && !customersQuery.error && filteredCustomers.length === 0 && (
                      <p className="p-3 text-sm text-text-secondary">No matching customers.</p>
                    )}
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chooseCustomer(customer)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-background"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-navy">
                            {customer.full_name || customer.email}
                          </span>
                          <span className="block truncate text-xs text-text-secondary">
                            {customer.email}{customer.company ? ` · ${customer.company}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-pill bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary ring-1 ring-border">
                          {customer.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email-tracking">Tracking number <span className="font-normal text-text-secondary">(optional)</span></Label>
                <Input
                  id="email-tracking"
                  value={form.tracking_number}
                  onChange={(e) => set('tracking_number', e.target.value)}
                  placeholder="e.g. PVL-DEMO-0001"
                />
                <p className="mt-1 text-xs text-text-secondary">
                  Fills <code>{'{{tracking_number}}'}</code> and adds a “Track shipment” button.
                </p>
              </div>
              <div>
                <Label htmlFor="email-subject">Subject line <span className="text-primary-dark">*</span></Label>
                <Input
                  id="email-subject"
                  value={form.subject}
                  onChange={(e) => { set('subject', e.target.value); setResult(null) }}
                  placeholder="What is this email about?"
                  maxLength={200}
                />
                <p className="mt-1 text-right text-xs text-text-secondary">{form.subject.length}/200</p>
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="email-body">Message <span className="text-primary-dark">*</span></Label>
              <Textarea
                id="email-body"
                rows={14}
                value={form.body}
                onChange={(e) => { set('body', e.target.value); setResult(null) }}
                placeholder="Write your message. Leave a blank line between paragraphs."
                maxLength={20000}
                className="resize-y font-[inherit] leading-relaxed"
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                <span>
                  Variables: <code className="rounded bg-background px-1">{'{{customer_name}}'}</code>{' '}
                  <code className="rounded bg-background px-1">{'{{customer_email}}'}</code>{' '}
                  <code className="rounded bg-background px-1">{'{{tracking_number}}'}</code>
                </span>
                <span>{form.body.length}/20000</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => { setResult(null); sendMut.mutate() }}
                disabled={!canSend}
              >
                {sendMut.isPending
                  ? <><Spinner className="size-4 border-white/40 border-t-white" /> Sending…</>
                  : <><Send className="size-4" /> Send email</>}
              </Button>
              <span className="text-xs text-text-secondary">
                {configured
                  ? `Sends from ${senderAddress}`
                  : 'Configure RESEND_API_KEY to enable sending'}
              </span>
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
                <Eye className="size-4 text-primary-dark" /> Live preview
              </h2>
              {previewQuery.isFetching && <Spinner className="size-4" />}
            </div>

            {!selectedCustomer || !form.subject.trim() || !form.body.trim() ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-8 text-center">
                <Mail className="size-10 text-border" />
                <p className="text-sm font-semibold text-navy">Your preview will appear here</p>
                <p className="max-w-xs text-xs text-text-secondary">
                  Choose a recipient and add a subject and message to see exactly what the customer will receive.
                </p>
              </div>
            ) : previewError ? (
              <div className="p-5 text-sm text-danger">
                <AlertCircle className="mb-2 size-4" /> {previewError}
              </div>
            ) : previewHtml ? (
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[620px] w-full border-0 bg-white"
              />
            ) : (
              <div className="grid min-h-[320px] place-items-center p-8"><Spinner /></div>
            )}
          </Card>
        </div>
      </div>

      {/* Delivery history */}
      <Card className="mt-8 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
            <Inbox className="size-5 text-primary-dark" /> Recent emails
          </h2>
          <button
            type="button"
            onClick={() => messagesQuery.refetch()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-navy"
          >
            <RefreshCw className={`size-3.5 ${messagesQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {messagesQuery.isLoading && <div className="p-5"><Spinner /></div>}
        {messagesQuery.error && (
          <p className="p-5 text-sm text-danger">{(messagesQuery.error as any)?.message || 'Could not load sent emails.'}</p>
        )}
        {!messagesQuery.isLoading && !messagesQuery.error && messages.length === 0 && (
          <p className="p-5 text-sm text-text-secondary">No emails have been sent yet.</p>
        )}

        {messages.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-5 py-3 font-semibold">Recipient</th>
                  <th className="px-5 py-3 font-semibold">Subject</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {messages.map(message => (
                  <tr key={message.id} className="align-top">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-navy">{message.recipient_name || message.recipient_email}</p>
                      {message.recipient_name && <p className="text-xs text-text-secondary">{message.recipient_email}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="max-w-xs truncate text-text-primary" title={message.subject}>{message.subject}</p>
                      {message.template_key && <p className="text-xs text-text-secondary">{message.template_key}</p>}
                      {message.status === 'failed' && message.error && (
                        <p className="mt-1 max-w-xs text-xs text-danger">{message.error}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-bold ${
                        message.status === 'sent' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {message.status === 'sent' ? 'Delivered' : 'Failed'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-text-secondary">
                      {fmtDateTime(message.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
