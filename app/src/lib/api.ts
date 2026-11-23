import {supabase} from './supabase'

const base =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : ' https://parcelvaultlogistics.onrender.com')

type FetchInit = RequestInit & {auth?: boolean; raw?: boolean}

export async function api<T = any>(path: string, init: FetchInit = {}): Promise<T> {
  const {auth = true, raw = false, headers, ...rest} = init
  const h: Record<string, string> = {'Content-Type': 'application/json', ...(headers as any)}
  if (auth) {
    const {data} = await supabase.auth.getSession()
    if (data?.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`
  }
  const res = await fetch(base + path, {...rest, headers: h})
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {const j = await res.json(); msg = j.error ?? msg} catch {}
    throw new Error(msg)
  }
  return raw ? (res as any) : res.json()
}

export const PublicApi = {
  track: (t: string) => api(`/public/track/${encodeURIComponent(t)}`, {auth: false}),
  settings: () => api(`/public/site-settings`, {auth: false}),
  services: () => api(`/public/services`, {auth: false}),
  partners: () => api(`/public/partners`, {auth: false}),
  gallery: () => api(`/public/gallery`, {auth: false}),
  testimonials: () => api(`/public/testimonials`, {auth: false}),
  paymentMethods: () => api(`/public/payment-methods`, {auth: false}),
  contact: (b: any) => api(`/public/contact`, {method: 'POST', body: JSON.stringify(b), auth: false}),
  newsletter: (b: any) => api(`/public/newsletter`, {method: 'POST', body: JSON.stringify(b), auth: false}),
  submitPayment: (b: any) => api(`/public/payment`, {method: 'POST', body: JSON.stringify(b), auth: false}),
  uploadProof: (b: {tracking_number: string; file: string}) =>
    api(`/public/payment-proof`, {method: 'POST', body: JSON.stringify(b), auth: false}),
}

export const AuthApi = {
  profiles: () => api(`/auth/profiles`),
  patchProfile: (id: string, b: any) => api(`/auth/profiles/${id}`, {method: 'PATCH', body: JSON.stringify(b)}),
}

export const ShipmentsApi = {
  get: (id: string) => api(`/shipments/${id}`),
  create: (b: any) => api(`/shipments`, {method: 'POST', body: JSON.stringify(b)}),
  update: (id: string, b: any) => api(`/shipments/${id}`, {method: 'PATCH', body: JSON.stringify(b)}),
  remove: (id: string) => api(`/shipments/${id}`, {method: 'DELETE'}),
  addEvent: (id: string, b: any) => api(`/shipments/${id}/events`, {method: 'POST', body: JSON.stringify(b)}),
  delEvent: (id: string, evId: string) => api(`/shipments/${id}/events/${evId}`, {method: 'DELETE'}),
  addFee: (id: string, b: any) => api(`/shipments/${id}/fees`, {method: 'POST', body: JSON.stringify(b)}),
  updFee: (id: string, feeId: string, b: any) => api(`/shipments/${id}/fees/${feeId}`, {method: 'PATCH', body: JSON.stringify(b)}),
  delFee: (id: string, feeId: string) => api(`/shipments/${id}/fees/${feeId}`, {method: 'DELETE'}),
  addImage: (id: string, b: any) => api(`/shipments/${id}/images`, {method: 'POST', body: JSON.stringify(b)}),
  delImage: (id: string, imgId: string) => api(`/shipments/${id}/images/${imgId}`, {method: 'DELETE'}),
  listAll: () => api(`/shipments`),
}

export const PaymentsApi = {
  listAll: () => api(`/payments`),
  verify: (id: string, status: 'verified' | 'rejected', note?: string) =>
    api(`/payments/${id}/verify`, {method: 'PATCH', body: JSON.stringify({status, note})}),
}

export const ContentApi = {
  list: (resource: string) => api(`/content/${resource}`),
  create: (resource: string, body: any) => api(`/content/${resource}`, {method: 'POST', body: JSON.stringify(body)}),
  update: (resource: string, id: string, body: any) => api(`/content/${resource}/${id}`, {method: 'PATCH', body: JSON.stringify(body)}),
  remove: (resource: string, id: string) => api(`/content/${resource}/${id}`, {method: 'DELETE'}),
  getSettings: () => api(`/content/settings/site`),
  patchSettings: (b: any) => api(`/content/settings/site`, {method: 'PATCH', body: JSON.stringify(b)}),
  analytics: () => api(`/content/analytics/overview`),
}

export const UploadsApi = {
  direct: (b: {bucket: string; path?: string; contentType?: string; file: string; public?: boolean}) =>
    api(`/uploads/direct`, {method: 'POST', body: JSON.stringify(b)}),
  sign: (b: {bucket: string; path?: string; contentType?: string}) =>
    api(`/uploads/sign`, {method: 'POST', body: JSON.stringify(b)}),
  list: (bucket: string) => api(`/uploads/list/${bucket}`),
  view: (bucket: string, path: string) =>
    api(`/uploads/view/${bucket}/${encodeURIComponent(path)}`),
  remove: (bucket: string, path: string) => api(`/uploads/delete/${bucket}/${encodeURIComponent(path)}`, {method: 'DELETE'}),
}

export const PaymentMethodsApi = {
  list: () => api(`/payment-methods`),
  create: (b: any) => api(`/payment-methods`, {method: 'POST', body: JSON.stringify(b)}),
  update: (id: string, b: any) => api(`/payment-methods/${id}`, {method: 'PATCH', body: JSON.stringify(b)}),
  remove: (id: string) => api(`/payment-methods/${id}`, {method: 'DELETE'}),
}

/**
 * Upload a file straight to Supabase Storage using a signed URL, reporting
 * real progress. Falls back to a normal PUT if the browser lacks XHR upload.
 */
export async function uploadWithProgress(
  bucket: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{bucket: string; path: string; url: string}> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const signed = await UploadsApi.sign({bucket, path, contentType: file.type})

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', signed.signedUrl)
    xhr.setRequestHeader('x-upsert', 'false')
    if (signed.token) xhr.setRequestHeader('x-up-token', signed.token)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error(`Upload failed (${xhr.status}). Please try again.`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(file)
  })

  return {bucket, path, url: signed.publicUrl}
}

export type Api = typeof api
