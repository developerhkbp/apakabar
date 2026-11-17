/**
 * Isi pesan yang dienkripsi. Pesan biasa tetap berupa teks polos; pesan berisi tautan dibungkus
 * dengan awalan \u0002 + JSON agar bisa membawa pratinjau (judul, deskripsi, gambar kecil).
 * Pesan lama yang berupa teks polos tetap terbaca.
 */
const AWALAN = '\u0002'
/** Pesan berlampiran: awalan \u0003 + JSON {t, l:[...]}. */
const AWALAN_LAMPIRAN = '\u0003'

/** Satu lampiran. Berkasnya terenkripsi di server; kunci `k` dan `iv` hanya ada di dalam pesan E2EE ini. */
export type Lampiran = {
  /** id blob di gateway */
  id: string
  /** kunci AES-256 (base64) */
  k: string
  /** awalan nonce (base64) */
  iv: string
  /** nama berkas */
  n: string
  /** jenis MIME */
  m: string
  /** ukuran asli (byte) */
  u: number
  /** thumbnail JPEG kecil (data URI) untuk foto/video */
  th?: string
}

export const adalahFoto = (l: Lampiran) => l.m.startsWith('image/')
export const adalahVideo = (l: Lampiran) => l.m.startsWith('video/')

export type Pratinjau = {
  url: string
  judul: string
  deskripsi?: string
  situs?: string
  /** Gambar kecil sebagai data URI; diunduh oleh pengirim sehingga penerima tak perlu menghubungi situs. */
  gambar?: string
}

export type Konten = { teks: string; pratinjau?: Pratinjau; lampiran?: Lampiran[] }

export function bungkus(teks: string, pratinjau?: Pratinjau): string {
  return pratinjau ? AWALAN + JSON.stringify({ t: teks, p: pratinjau }) : teks
}

export function bungkusLampiran(teks: string, lampiran: Lampiran[]): string {
  return AWALAN_LAMPIRAN + JSON.stringify({ t: teks, l: lampiran })
}

export function buka(mentah: string): Konten {
  if (mentah.startsWith(AWALAN_LAMPIRAN)) {
    try {
      const o = JSON.parse(mentah.slice(AWALAN_LAMPIRAN.length)) as { t?: string; l?: Lampiran[] }
      const l = (Array.isArray(o.l) ? o.l : []).filter(x => x && typeof x.id === 'string' && typeof x.k === 'string' && typeof x.iv === 'string').slice(0, 10)
      return { teks: typeof o.t === 'string' ? o.t : '', lampiran: l }
    } catch {
      return { teks: '' }
    }
  }
  if (!mentah.startsWith(AWALAN)) return { teks: mentah }
  try {
    const o = JSON.parse(mentah.slice(AWALAN.length)) as { t?: string; p?: Pratinjau }
    return { teks: typeof o.t === 'string' ? o.t : '', pratinjau: o.p?.url && o.p.judul ? o.p : undefined }
  } catch {
    return { teks: mentah }
  }
}

/** Teks ringkas untuk daftar obrolan. */
export const ringkas = (mentah: string): string => {
  const k = buka(mentah)
  if (k.lampiran?.length) {
    const l = k.lampiran[0]
    const ikon = adalahFoto(l) ? '📷 Foto' : adalahVideo(l) ? '🎥 Video' : '📎 ' + l.n
    return (k.teks || (k.lampiran.length > 1 ? `${ikon} +${k.lampiran.length - 1}` : ikon))
  }
  return k.teks || (k.pratinjau ? k.pratinjau.judul : '')
}
