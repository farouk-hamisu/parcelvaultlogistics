import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authUser, requireAdmin } from '../middleware/auth.js'

const router = Router()

const BUCKETS = [
  'shipment-images', 'shipment-media', 'gallery', 'brand-logos',
  'homepage', 'documents', 'payment-receipts',
]

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
const DOC_TYPES = ['application/pdf']

const MB = 1024 * 1024
const LIMITS = {
  image: 10 * MB,
  video: 100 * MB,
  document: 25 * MB,
}

function classify(mime) {
  if (IMAGE_TYPES.includes(mime)) return 'image'
  if (VIDEO_TYPES.includes(mime)) return 'video'
  if (DOC_TYPES.includes(mime)) return 'document'
  return null
}

function checkFile(mime, bytes) {
  const kind = classify(mime)
  if (!kind) {
    return 'Unsupported file type. Upload a JPG, PNG or WEBP image, an MP4 or WEBM video, or a PDF document.'
  }
  if (bytes > LIMITS[kind]) {
    const mb = Math.round(LIMITS[kind] / MB)
    return `That ${kind} is too large. The maximum size is ${mb} MB.`
  }
  return null
}

router.post('/sign', authUser, requireAdmin, async (req, res, next) => {
  try {
    const { bucket, path, contentType } = req.body || {}
    if (!BUCKETS.includes(bucket)) return res.status(400).json({ error: 'unknown bucket' })

    const mime = contentType || 'application/octet-stream'
    if (!classify(mime)) {
      return res.status(400).json({ error: 'Unsupported file type. Upload a JPG, PNG or WEBP image, an MP4 or WEBM video, or a PDF document.' })
    }

    const safePath = sanitizePath(path || `${req.user.id}/${Date.now()}-${randomSuffix()}`)
    const { data, error } = await supabaseAdmin.storage.from(bucket)
      .createSignedUploadUrl(safePath, { upsert: false })
    if (error) throw error

    res.json({
      bucket,
      path: safePath,
      signedUrl: data.signedUrl,
      token: data.token ?? null,
      publicUrl: `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${safePath}`,
    })
  } catch (e) { next(e) }
})

router.post('/direct', authUser, requireAdmin, async (req, res, next) => {
  try {
    const { bucket, path, contentType, file } = req.body || {}
    if (!BUCKETS.includes(bucket)) return res.status(400).json({ error: 'unknown bucket' })

    if (!file || !file.startsWith('data:')) return res.status(400).json({ error: 'file must be a data URL' })
    const [meta, b64] = file.split(',')
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || contentType || 'application/octet-stream'
    const buffer = Buffer.from(b64 ?? '', 'base64')

    const problem = checkFile(mime, buffer.length)
    if (problem) return res.status(400).json({ error: problem })

    const safePath = sanitizePath(path || `${req.user.id}/${Date.now()}-${randomSuffix()}`)
    const { error } = await supabaseAdmin.storage.from(bucket).upload(safePath, buffer, { contentType: mime, upsert: false })
    if (error) throw error

    const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${safePath}`
    res.json({ bucket, path: safePath, url, contentType: mime, kind: classify(mime) })
  } catch (e) { next(e) }
})

router.get('/list/:bucket', authUser, requireAdmin, async (req, res, next) => {
  try {
    if (!BUCKETS.includes(req.params.bucket)) return res.status(400).json({ error: 'unknown bucket' })
    const { data, error } = await supabaseAdmin.storage.from(req.params.bucket)
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) throw error
    res.json({ files: data })
  } catch (e) { next(e) }
})

// Admins need a short-lived link for private buckets (documents, payment receipts).
router.get('/view/:bucket/*', authUser, requireAdmin, async (req, res, next) => {
  try {
    const { bucket } = req.params
    if (!BUCKETS.includes(bucket)) return res.status(400).json({ error: 'unknown bucket' })
    const objectPath = Array.isArray(req.params[0]) ? req.params[0].join('/') : req.params[0]
    if (!objectPath) return res.status(400).json({ error: 'path required' })

    const { data, error } = await supabaseAdmin.storage.from(bucket)
      .createSignedUrl(decodeURIComponent(objectPath), 60 * 60)
    if (error) throw error
    res.json({ url: data.signedUrl })
  } catch (e) { next(e) }
})

router.delete('/delete/:bucket/:path', authUser, requireAdmin, async (req, res, next) => {
  try {
    if (!BUCKETS.includes(req.params.bucket)) return res.status(400).json({ error: 'unknown bucket' })
    const { error } = await supabaseAdmin.storage.from(req.params.bucket).remove([decodeURIComponent(req.params.path)])
    if (error) throw error
    res.json({ ok: true })
  } catch (e) { next(e) }
})

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function sanitizePath(p) {
  return String(p).replace(/[^a-zA-Z0-9_\-./]/g, '_').replace(/^\/+/, '')
}

export default router
