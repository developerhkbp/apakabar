import type { Pratinjau } from './konten'

const MAKS_HTML = 1_500_000 // byte
const MAKS_GAMBAR = 60_000 // byte; lebih besar dari ini gambar dilewati agar pesan tetap ringan
const BATAS_WAKTU_MS = 4000

/** Tautan http(s) pertama di dalam teks, atau undefined. */
export function cariTautan(teks: string): string | undefined {
  const m = teks.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : undefined
}

const entitas = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

/** Isi atribut `content` dari <meta property|name="..."> (urutan atribut bebas). */
function meta(html: string, nama: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const id = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (id !== nama) continue
    const c = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1]
    if (c) return entitas(c)
  }
  return undefined
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function keBase64(b: Uint8Array): string {
  let o = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=')
  }
  return o
}

async function ambil(url: string, sinyal: AbortSignal) {
  return fetch(url, { signal: sinyal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ApaKabaR link preview)', Accept: 'text/html,image/*;q=0.8' } })
}

/**
 * Mengambil metadata tautan di perangkat pengirim (bukan di server), lalu menyertakannya di pesan terenkripsi.
 * Mengembalikan undefined bila situs tak bisa dijangkau atau tak punya metadata; pesan tetap terkirim sebagai teks.
 */
export async function ambilPratinjau(url: string): Promise<Pratinjau | undefined> {
  const kendali = new AbortController()
  const t = setTimeout(() => kendali.abort(), BATAS_WAKTU_MS)
  try {
    const res = await ambil(url, kendali.signal)
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return undefined
    if (Number(res.headers.get('content-length') ?? 0) > MAKS_HTML) return undefined
    const html = (await res.text()).slice(0, MAKS_HTML)

    const judul = meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? entitas(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    if (!judul) return undefined
    const p: Pratinjau = {
      url,
      judul: judul.slice(0, 160),
      deskripsi: (meta(html, 'og:description') ?? meta(html, 'twitter:description') ?? meta(html, 'description'))?.slice(0, 240),
      situs: (meta(html, 'og:site_name') ?? new URL(url).hostname.replace(/^www\./, '')).slice(0, 80),
    }

    const g = meta(html, 'og:image') ?? meta(html, 'twitter:image')
    if (g) {
      try {
        const alamat = new URL(g, url).toString()
        const r = await ambil(alamat, kendali.signal)
        const tipe = (r.headers.get('content-type') ?? '').split(';')[0]
        if (r.ok && /^image\/(jpeg|png|webp|gif)$/.test(tipe) && Number(r.headers.get('content-length') ?? 0) <= MAKS_GAMBAR) {
          const b = new Uint8Array(await r.arrayBuffer())
          if (b.length <= MAKS_GAMBAR) p.gambar = `data:${tipe};base64,${keBase64(b)}`
        }
      } catch {
        // gambar opsional
      }
    }
    return p
  } catch {
    return undefined
  } finally {
    clearTimeout(t)
  }
}
