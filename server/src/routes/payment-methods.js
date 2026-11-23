import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authUser, requireAdmin } from '../middleware/auth.js'
import { requireUUID } from '../middleware/validate.js'

const router = Router()

const FIELDS = [
  'kind', 'name', 'currency', 'network', 'wallet_address',
  'beneficiary_name', 'bank_name', 'account_number', 'swift_bic', 'iban',
  'routing_number', 'account_type', 'bank_address', 'instructions',
  'reference_label', 'sort_order', 'active',
]

const KINDS = ['crypto', 'bank']

function normalize(body = {}) {
  const out = {}
  for (const key of FIELDS) if (key in body) out[key] = body[key]

  if ('kind' in out) {
    out.kind = String(out.kind || '').trim().toLowerCase()
    if (!KINDS.includes(out.kind)) throw Object.assign(new Error('kind must be crypto or bank'), { status: 400 })
  }
  for (const key of ['name', 'currency', 'network', 'wallet_address', 'beneficiary_name',
    'bank_name', 'account_number', 'swift_bic', 'iban', 'routing_number',
    'account_type', 'bank_address', 'instructions', 'reference_label']) {
    if (key in out) out[key] = out[key] == null ? null : String(out[key]).trim() || null
  }
  if ('sort_order' in out) out.sort_order = Number(out.sort_order) || 0
  if ('active' in out) out.active = Boolean(out.active)
  return out
}

function validate(kind, row) {
  if (kind === 'crypto') {
    if (!row.name) return 'A cryptocurrency name is required.'
    if (!row.wallet_address) return 'A wallet address is required.'
  }
  if (kind === 'bank') {
    if (!row.name) return 'A bank / method name is required.'
    if (!row.beneficiary_name) return 'A beneficiary name is required.'
    if (!row.bank_name) return 'A bank name is required.'
    if (!row.account_number && !row.iban) return 'An account number or IBAN is required.'
  }
  return null
}

// Admin: list every configured method (active and inactive).
router.get('/', authUser, requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('payment_methods')
      .select('*').order('kind', { ascending: true }).order('sort_order', { ascending: true })
    if (error) throw error
    res.json({ methods: data })
  } catch (e) { next(e) }
})

router.post('/', authUser, requireAdmin, async (req, res, next) => {
  try {
    const payload = normalize(req.body)
    if (!payload.kind) return res.status(400).json({ error: 'kind is required' })
    const problem = validate(payload.kind, payload)
    if (problem) return res.status(400).json({ error: problem })
    const { data, error } = await supabaseAdmin.from('payment_methods')
      .insert(payload).select().single()
    if (error) throw error
    res.json({ method: data })
  } catch (e) { next(e) }
})

router.patch('/:id', authUser, requireAdmin, requireUUID('id'), async (req, res, next) => {
  try {
    const payload = normalize(req.body)
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'nothing to update' })

    const { data: existing, error: readErr } = await supabaseAdmin.from('payment_methods')
      .select('*').eq('id', req.params.id).single()
    if (readErr) throw readErr

    const merged = { ...existing, ...payload }
    const problem = validate(merged.kind, merged)
    if (problem) return res.status(400).json({ error: problem })

    const { data, error } = await supabaseAdmin.from('payment_methods')
      .update(payload).eq('id', req.params.id).select().single()
    if (error) throw error
    res.json({ method: data })
  } catch (e) { next(e) }
})

router.delete('/:id', authUser, requireAdmin, requireUUID('id'), async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('payment_methods').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
