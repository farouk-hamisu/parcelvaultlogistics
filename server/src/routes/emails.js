import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authUser, requireAdmin } from '../middleware/auth.js'

const router = Router()

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@parcelvaultlogistics.com'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || SUPPORT_EMAIL
const FROM_NAME = process.env.RESEND_FROM_NAME || 'ParcelVault Logistics'
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.parcelvaultlogistics.com').replace(/\/$/, '')

const MAX_SUBJECT = 200
const MAX_BODY = 20000

// Very small in-memory guard so a stuck UI cannot spam the provider.
const sendHits = new Map()
function rateLimited(userId) {
  const now = Date.now()
  const cutoff = now - 60_000
  const hits = (sendHits.get(userId) || []).filter((t) => t > cutoff)
  hits.push(now)
  sendHits.set(userId, hits)
  if (sendHits.size > 2000) sendHits.clear()
  return hits.length > 30
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyVariables(text, vars) {
  return String(text ?? '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const value = vars[key.toLowerCase()]
    return value == null ? match : String(value)
  })
}

function bodyToHtml(body) {
  const chunks = String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return chunks
    .map((block) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#243746;">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('')
}

/**
 * Shared responsive email shell. Inline styles are used deliberately so the
 * layout survives Gmail, Outlook, Apple Mail and mobile clients.
 */
function buildEmailHtml({ subject, body, vars }) {
  const customerName = vars.customer_name && vars.customer_name !== 'there' ? vars.customer_name : null
  const tracking = vars.tracking_number && vars.tracking_number !== 'your shipment' ? vars.tracking_number : null
  const trackingUrl = tracking ? `${SITE_URL}/track/${encodeURIComponent(tracking)}` : `${SITE_URL}/track`
  // Most templates already open with their own greeting. Only add the shell
  // greeting for messages that do not, so the customer never sees two hellos.
  const bodyText = String(body ?? '')
  const hasGreeting = /^(hi|hello|dear|good\s+(morning|afternoon|evening))\b/i.test(bodyText.trim())

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef3f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3f6;padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe6ee;box-shadow:0 18px 50px -30px rgba(5,45,75,0.35);">
        <tr>
          <td style="background-color:#052d4b;padding:26px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                  <span style="display:inline-block;font-size:20px;letter-spacing:0.14em;font-weight:800;color:#ffffff;">PARCEL<span style="color:#05a3aa;">VAULT</span></span>
                  <span style="display:block;margin-top:4px;font-size:10px;letter-spacing:0.32em;color:#9fc6d8;font-weight:600;">LOGISTICS</span>
                </td>
                <td align="right" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9fc6d8;font-weight:700;">Global freight</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:5px;background-color:#05a3aa;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:34px 32px 26px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            ${customerName && !hasGreeting ? `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.5;color:#052d4b;font-weight:700;">Hello ${escapeHtml(customerName)},</p>` : ''}
            ${bodyToHtml(body)}
            ${
              tracking
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px 0;">
                    <tr>
                      <td style="border-radius:12px;background-color:#05a3aa;">
                        <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:13px 24px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#052d4b;text-decoration:none;border-radius:12px;">Track shipment ${escapeHtml(tracking)}</a>
                      </td>
                    </tr>
                  </table>`
                : ''
            }
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-top:1px solid #e4edf3;">
              <tr>
                <td style="padding-top:22px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#5b7284;">
                  Need a hand? Our customer support team is available through live chat on our website, or by replying directly to this email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f5f9fb;border-top:1px solid #e4edf3;padding:22px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:1.7;color:#7a8f9e;">
              <strong style="color:#052d4b;">ParcelVault Logistics</strong><br />
              Premium international shipping &amp; logistics<br />
              <a href="mailto:${SUPPORT_EMAIL}" style="color:#06718a;text-decoration:none;">${SUPPORT_EMAIL}</a>
            </p>
            <p style="margin:14px 0 0 0;font-size:11px;line-height:1.6;color:#9aacb8;">
              This message was sent to you because you have an account with ParcelVault Logistics.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#9aacb8;">© ${new Date().getFullYear()} ParcelVault Logistics. All rights reserved.</p>
    </td>
  </tr>
</table>
</body>
</html>`
}

function buildVars({ customer, trackingNumber }) {
  return {
    customer_name: customer?.full_name?.trim() || customer?.email?.split('@')[0] || 'there',
    customer_email: customer?.email || '',
    tracking_number: trackingNumber ? String(trackingNumber).trim().toUpperCase() : 'your shipment',
    company_name: 'ParcelVault Logistics',
  }
}

function resolveContent({ subject, body, customer, trackingNumber }) {
  const vars = buildVars({ customer, trackingNumber })
  const resolvedSubject = applyVariables(subject, vars).replace(/[\r\n]+/g, ' ').trim()
  const resolvedBody = applyVariables(body, vars)
  return {
    vars,
    subject: resolvedSubject,
    body: resolvedBody,
    html: buildEmailHtml({ subject: resolvedSubject, body: resolvedBody, vars }),
  }
}

async function findCustomer({ customerId, email }) {
  if (customerId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, company, is_active')
      .eq('id', customerId)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }
  if (email) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, company, is_active')
      .ilike('email', String(email).trim())
      .maybeSingle()
    if (error) throw error
    return data ?? null
  }
  return null
}

function validatePayload(body = {}) {
  const subject = String(body.subject ?? '').trim()
  const content = String(body.body ?? '').trim()
  if (!subject) return 'Please add an email subject.'
  if (subject.length > MAX_SUBJECT) return `The subject must be ${MAX_SUBJECT} characters or fewer.`
  if (!content) return 'Please write the email body.'
  if (content.length > MAX_BODY) return `The email body must be ${MAX_BODY} characters or fewer.`
  if (!body.customer_id && !body.email) return 'Please choose a recipient.'
  return null
}

/** Templates + provider status for the composer. */
router.get('/templates', authUser, requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    res.json({
      templates: data ?? [],
      configured: Boolean(process.env.RESEND_API_KEY),
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      support_email: SUPPORT_EMAIL,
    })
  } catch (e) { next(e) }
})

/** Registered customers available as recipients. */
router.get('/customers', authUser, requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, company, role, is_active, created_at')
      .not('email', 'is', null)
      .eq('is_active', true)
      .in('role', ['customer', 'manager', 'staff', 'admin'])
      .order('full_name', { ascending: true })
      .limit(1000)
    if (error) throw error
    res.json({ customers: data ?? [] })
  } catch (e) { next(e) }
})

/** Render the exact branded HTML that would be sent. */
router.post('/preview', authUser, requireAdmin, async (req, res, next) => {
  try {
    const problem = validatePayload(req.body)
    if (problem) return res.status(400).json({ error: problem })

    const customer = await findCustomer({ customerId: req.body.customer_id, email: req.body.email })
    if (!customer) return res.status(404).json({ error: 'That customer could not be found.' })

    const resolved = resolveContent({
      subject: req.body.subject,
      body: req.body.body,
      customer,
      trackingNumber: req.body.tracking_number,
    })

    res.json({
      html: resolved.html,
      subject: resolved.subject,
      recipient: { name: customer.full_name, email: customer.email },
    })
  } catch (e) { next(e) }
})

/** Send the email through Resend and record the delivery attempt. */
router.post('/send', authUser, requireAdmin, async (req, res, next) => {
  let logRow = null
  try {
    if (rateLimited(req.user.id)) {
      return res.status(429).json({ error: 'Too many emails sent in a short period. Please wait a minute and try again.' })
    }

    const problem = validatePayload(req.body)
    if (problem) return res.status(400).json({ error: problem })

    const customer = await findCustomer({ customerId: req.body.customer_id, email: req.body.email })
    if (!customer) return res.status(404).json({ error: 'That customer could not be found.' })
    if (!customer.email) return res.status(400).json({ error: 'That customer has no email address on file.' })

    const resolved = resolveContent({
      subject: req.body.subject,
      body: req.body.body,
      customer,
      trackingNumber: req.body.tracking_number,
    })

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return res.status(503).json({
        error: 'Email sending is not configured on the server yet. Add RESEND_API_KEY to the API environment and restart.',
      })
    }

    const baseLog = {
      customer_id: customer.id,
      recipient_email: customer.email,
      recipient_name: customer.full_name ?? null,
      subject: resolved.subject,
      template_key: req.body.template_key ? String(req.body.template_key).slice(0, 80) : null,
      body_text: resolved.body,
      html: resolved.html,
      sent_by: req.user.id,
    }

    let providerResponse
    try {
      providerResponse = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [customer.email],
          subject: resolved.subject,
          html: resolved.html,
          text: resolved.body,
          reply_to: SUPPORT_EMAIL,
        }),
      })
    } catch (networkError) {
      logRow = { ...baseLog, status: 'failed', error: `Network error: ${networkError.message}` }
      const { data } = await supabaseAdmin.from('email_messages').insert(logRow).select().single()
      console.error('[email] network error:', networkError.message)
      return res.status(502).json({ error: 'Could not reach the email provider. Check the server connection and try again.' })
    }

    const payload = await providerResponse.json().catch(() => ({}))
    if (!providerResponse.ok) {
      const message = payload?.message || payload?.error?.message || `Email provider rejected the message (${providerResponse.status}).`
      logRow = { ...baseLog, status: 'failed', error: message }
      await supabaseAdmin.from('email_messages').insert(logRow)
      console.error('[email] resend rejected:', providerResponse.status, message)
      return res.status(502).json({ error: message })
    }

    const { data: saved } = await supabaseAdmin
      .from('email_messages')
      .insert({ ...baseLog, status: 'sent', provider_id: payload?.id ?? null })
      .select()
      .single()

    res.json({
      ok: true,
      id: payload?.id ?? null,
      message: saved ?? null,
      recipient: { name: customer.full_name, email: customer.email },
    })
  } catch (e) {
    if (logRow) {
      try { await supabaseAdmin.from('email_messages').insert({ ...logRow, status: 'failed', error: e.message }) } catch {}
    }
    next(e)
  }
})

/** Recent delivery attempts for the admin audit panel. */
router.get('/messages', authUser, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    const { data, error } = await supabaseAdmin
      .from('email_messages')
      .select('id, customer_id, recipient_email, recipient_name, subject, template_key, status, provider_id, error, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    res.json({ messages: data ?? [] })
  } catch (e) { next(e) }
})

export default router
