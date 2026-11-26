/**
 * Isi pesan yang dienkripsi. Pesan biasa tetap berupa teks polos; pesan berisi tautan dibungkus
 * dengan awalan \u0002 + JSON agar bisa membawa pratinjau (judul, deskripsi, gambar kecil).
 * Pesan lama yang berupa teks polos tetap terbaca.
 */
const AWALAN = '\u0002'
/** Pesan berlampiran: awalan \u0003 + JSON {t, l:[...]}. */
const AWALAN_LAMPIRAN = '\u0003'
/** Pesan balasan/terusan: awalan \u0004 + JSON {t, p?, l?, b?, f?}. */
const AWALAN_LENGKAP = '\u0004'

/** Kutipan pesan yang dibalas: r = idKlien pesan asli, d = id pengirim aslinya, c = cuplikan teks. */
export type Balasan = { r: string; d: string; c: string }

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
  /** durasi (detik) untuk pesan suara */
  d?: number
}

export const adalahFoto = (l: Lampiran) => l.m.startsWith('image/')
export const adalahVideo = (l: Lampiran) => l.m.startsWith('video/')
export const adalahAudio = (l: Lampiran) => l.m.startsWith('audio/')

export type Pratinjau = {
  url: string
  judul: string
  deskripsi?: string
  situs?: string
  /** Gambar kecil sebagai data URI; diunduh oleh pengirim sehingga penerima tak perlu menghubungi situs. */
  gambar?: string
}

export type Konten = { teks: string; pratinjau?: Pratinjau; lampiran?: Lampiran[]; balas?: Balasan; diteruskan?: boolean }

export function bungkus(teks: string, pratinjau?: Pratinjau): string {
  return pratinjau ? AWALAN + JSON.stringify({ t: teks, p: pratinjau }) : teks
}

export function bungkusLampiran(teks: string, lampiran: Lampiran[]): string {
  return AWALAN_LAMPIRAN + JSON.stringify({ t: teks, l: lampiran })
}

/** Membungkus isi dengan kutipan balasan dan/atau tanda "Diteruskan". Pesan lama tetap terbaca. */
export function bungkusLengkap(k: Konten): string {
  if (!k.balas && !k.diteruskan) {
    if (k.lampiran?.length) return bungkusLampiran(k.teks, k.lampiran)
    return bungkus(k.teks, k.pratinjau)
  }
  return AWALAN_LENGKAP + JSON.stringify({ t: k.teks, p: k.pratinjau, l: k.lampiran, b: k.balas, f: k.diteruskan ? 1 : undefined })
}

/** Menambahkan kutipan balasan ke isi yang sudah siap kirim. */
export const denganBalasan = (mentah: string, balas: Balasan): string => bungkusLengkap({ ...buka(mentah), balas })

/** Isi untuk diteruskan: kutipan balasan dibuang, ditandai "Diteruskan". */
export const untukDiteruskan = (mentah: string): string => bungkusLengkap({ ...buka(mentah), balas: undefined, diteruskan: true })

/** Mengganti teks pada isi yang sudah terbungkus (pratinjau, lampiran, kutipan balasan tetap). */
export const gantiTeks = (mentah: string, teksBaru: string): string => bungkusLengkap({ ...buka(mentah), teks: teksBaru })

/** Cuplikan pendek untuk kutipan balasan. */
export const cuplikanBalas = (mentah: string): string => ringkas(mentah).replace(/\s+/g, ' ').slice(0, 140)

export function buka(mentah: string): Konten {
  if (mentah.startsWith(AWALAN_LENGKAP)) {
    try {
      const o = JSON.parse(mentah.slice(AWALAN_LENGKAP.length)) as { t?: string; p?: Pratinjau; l?: Lampiran[]; b?: Balasan; f?: number }
      const l = (Array.isArray(o.l) ? o.l : []).filter(x => x && typeof x.id === 'string' && typeof x.k === 'string' && typeof x.iv === 'string').slice(0, 10)
      const b = o.b && typeof o.b.r === 'string' && typeof o.b.d === 'string' ? { r: o.b.r, d: o.b.d, c: String(o.b.c ?? '').slice(0, 200) } : undefined
      return {
        teks: typeof o.t === 'string' ? o.t : '',
        pratinjau: o.p?.url && o.p.judul ? o.p : undefined,
        lampiran: l.length ? l : undefined,
        balas: b,
        diteruskan: o.f === 1,
      }
    } catch {
      return { teks: '' }
    }
  }
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
    const ikon = adalahFoto(l) ? '📷 Foto' : adalahVideo(l) ? '🎥 Video' : adalahAudio(l) ? '🎤 Pesan suara' : '📎 ' + l.n
    return (k.teks || (k.lampiran.length > 1 ? `${ikon} +${k.lampiran.length - 1}` : ikon))
  }
  return k.teks || (k.pratinjau ? k.pratinjau.judul : '')
}
