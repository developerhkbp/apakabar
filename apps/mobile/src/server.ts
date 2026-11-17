import { PermissionsAndroid, Platform } from 'react-native'
import Signal, { type BundleLawan } from '../modules/signal-protocol/src'
import type { Lampiran } from './konten'

// Produksi: https://apakabar.hkbp.or.id. Untuk pengembangan di emulator, jalankan `adb reverse tcp:3101 tcp:3101`
// dan mulai dengan EXPO_PUBLIC_API_URL=http://localhost:3101 (bundel memakai nilai ini saat build).
export const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://apakabar.hkbp.or.id'

export type Anggota = { id: string; nama: string; fotoV?: number }
/** `ref` = id pesan buatan pengirim (sama untuk semua penerima grup); dipakai untuk menghapus pesan. */
export type Pesan = { id: string; dari: string; teks: string; waktu: number; saya: boolean; status?: 'terkirim' | 'dikirim' | 'gagal'; ref?: string; dihapus?: boolean
  /** Tanda terima per penerima (id anggota → waktu): sampai di perangkatnya / sudah dibaca. */
  terima?: Record<string, number>; baca?: Record<string, number>
  /** Pesan masuk yang sudah dilaporkan dibaca ke pengirim. */
  dilapor?: boolean }
export type StatusAnggota = 'DIUNDANG' | 'MENUNGGU' | 'AKTIF' | 'DITANGGUHKAN'
export type PeranAnggota = 'USER' | 'ADMIN' | 'ADMIN_UTAMA'
export type Sesi = { id: string; nama: string; token: string; refresh: string; status?: StatusAnggota; peran?: PeranAnggota }
export type Riwayat = Record<string, Pesan[]>

export type PeranGrup = 'ANGGOTA' | 'ADMIN_GRUP'
export type RingkasGrup = { id: string; nama: string; idDistribusi: string; jumlah: number; peranSaya: PeranGrup; fotoV?: number }
export type DetailGrup = {
  id: string
  nama: string
  idDistribusi: string
  peranSaya: PeranGrup | null
  fotoV?: number
  anggota: { id: string; nama: string; peran: PeranGrup; fotoV?: number }[]
}
export type AnggotaAdmin = { id: string; nama: string; nomorHp: string; status: StatusAnggota; peran: PeranAnggota; dibuatPada: string }

/** Kunci riwayat untuk percakapan grup (dibedakan dari id anggota). */
export const kunciGrup = (grupId: string) => `g:${grupId}`

/** Galat dari server; `status` dipakai untuk membedakan sesi berakhir (401) dari gangguan jaringan. */
export class GalatApi extends Error {
  constructor(pesan: string, readonly status: number) {
    super(pesan)
  }
}

async function api<T>(metode: string, jalur: string, badan?: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + jalur, {
      method: metode,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: badan ? JSON.stringify(badan) : undefined,
    })
  } catch {
    throw new GalatApi('Tidak dapat terhubung ke server', 0)
  }
  const teks = await res.text()
  const data = teks ? JSON.parse(teks) : null
  if (!res.ok) {
    throw new GalatApi(Array.isArray(data?.message) ? data.message[0] : (data?.message ?? 'Terjadi kesalahan'), res.status)
  }
  return data as T
}

export const mintaOtp = (nomorHp: string) =>
  api<{ pesan: string; kodeDev?: string }>('POST', '/auth/otp/minta', { nomorHp })

type Token = { aksesToken: string; refreshToken: string }

export async function verifikasi(nomorHp: string, kode: string): Promise<Sesi> {
  const p = await Signal.daftar(20) // identitas baru; yang lama (bila ada) diganti
  const r = await api<Token & { anggota: { id: string; nama: string; peran: PeranAnggota; status: StatusAnggota } }>('POST', '/auth/otp/verifikasi', {
    nomorHp,
    kode,
    perangkat: { regId: p.regId, identitas: p.identitas, signedPreKey: p.signedPreKey, kyber: p.kyber, oneTime: p.oneTime },
  })
  const sesi: Sesi = {
    id: r.anggota.id, nama: r.anggota.nama, token: r.aksesToken, refresh: r.refreshToken,
    status: r.anggota.status, peran: r.anggota.peran,
  }
  await simpanSesi(sesi)
  return sesi
}

/**
 * Memperbarui token lalu menanyakan status keanggotaan (dipakai halaman "menunggu persetujuan").
 * Melempar GalatApi 401 bila perangkat ini sudah tidak sah.
 */
export async function segarkanStatus(sesi: Sesi): Promise<Sesi> {
  const t = await api<Token>('POST', '/auth/refresh', { refreshToken: sesi.refresh })
  const baru = await api<{ status: StatusAnggota; peran: PeranAnggota }>('GET', '/auth/saya', undefined, t.aksesToken)
  const hasil: Sesi = { ...sesi, token: t.aksesToken, refresh: t.refreshToken, status: baru.status, peran: baru.peran }
  await simpanSesi(hasil)
  return hasil
}

// --- Penyimpanan lokal terenkripsi (Android Keystore) ---

export async function muatSesi(): Promise<Sesi | null> {
  try {
    if (!Signal.ada()) return null
    const t = await Signal.baca('sesi')
    return t ? (JSON.parse(t) as Sesi) : null
  } catch {
    return null
  }
}
export const simpanSesi = (s: Sesi) => Signal.simpan('sesi', JSON.stringify(s))

export async function muatRiwayat(): Promise<Riwayat> {
  try {
    const t = await Signal.baca('riwayat')
    return t ? (JSON.parse(t) as Riwayat) : {}
  } catch {
    return {}
  }
}
export const simpanRiwayat = (r: Riwayat) => Signal.simpan('riwayat', JSON.stringify(r))

/** Keluar: hapus seluruh kunci, sesi, dan riwayat dari perangkat ini. */
export async function sudahOnboarding(): Promise<boolean> {
  try { return Signal.ada() ? (await Signal.baca('onboarding')) === '1' : false } catch { return false }
}
export const tandaiOnboarding = () => Signal.simpan('onboarding', '1').catch(() => {})

export const keluar = () => Signal.hapusSemua()

/** Foto profil/grup (JPEG kecil dalam base64). null = hapus. Mengembalikan versi foto yang baru. */
export const ubahFotoSaya = (t: string, data: string | null) => api<{ fotoV: number }>('PUT', '/foto/saya', { data }, t)
export const ubahFotoGrup = (t: string, grupId: string, data: string | null) => api<{ fotoV: number }>('PUT', `/grup/${grupId}/foto`, { data }, t)
export const versiFotoSaya = (t: string) => api<{ fotoV: number }>('GET', '/foto/saya/versi', undefined, t)
export const daftarAnggota = (token: string) => api<Anggota[]>('GET', '/anggota', undefined, token)

// --- Admin aplikasi ---
export const adminRingkasan = (t: string) => api<Record<StatusAnggota, number>>('GET', '/admin/ringkasan', undefined, t)
export const adminDaftar = (t: string, status?: StatusAnggota, q?: string, halaman = 1) =>
  api<{ total: number; halaman: number; perHalaman: number; data: AnggotaAdmin[] }>(
    'GET',
    `/admin/anggota?halaman=${halaman}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    undefined,
    t,
  )
export const adminSetujui = (t: string, id: string) => api('POST', `/admin/anggota/${id}/setujui`, undefined, t)
export const adminSetujuiBanyak = (t: string, ids: string[]) => api<{ disetujui: number }>('POST', '/admin/anggota/setujui', { ids }, t)
export const adminBlokir = (t: string, id: string) => api('POST', `/admin/anggota/${id}/blokir`, undefined, t)
export const adminBukaBlokir = (t: string, id: string) => api('POST', `/admin/anggota/${id}/buka-blokir`, undefined, t)
export const adminKeluarkan = (t: string, id: string) => api('DELETE', `/admin/anggota/${id}`, undefined, t)
export const adminUbahPeran = (t: string, id: string, peran: 'USER' | 'ADMIN') => api('PUT', `/admin/anggota/${id}/peran`, { peran }, t)
export const adminTambah = (t: string, nomorHp: string, nama: string) => api<AnggotaAdmin>('POST', '/admin/anggota', { nomorHp, nama }, t)

// --- Grup ---
export const daftarGrup = (t: string) => api<RingkasGrup[]>('GET', '/grup', undefined, t)
export const detailGrup = (t: string, id: string) => api<DetailGrup>('GET', `/grup/${id}`, undefined, t)
export const buatGrup = (t: string, nama: string, anggotaIds: string[]) => api<DetailGrup>('POST', '/grup', { nama, anggotaIds }, t)
export const ubahNamaGrup = (t: string, id: string, nama: string) => api('PATCH', `/grup/${id}`, { nama }, t)
export const hapusGrup = (t: string, id: string) => api('DELETE', `/grup/${id}`, undefined, t)
export const tambahAnggotaGrup = (t: string, id: string, anggotaIds: string[]) => api('POST', `/grup/${id}/anggota`, { anggotaIds }, t)
export const keluarkanDariGrup = (t: string, id: string, anggotaId: string) => api('DELETE', `/grup/${id}/anggota/${anggotaId}`, undefined, t)
export const ubahPeranGrup = (t: string, id: string, anggotaId: string, peran: PeranGrup) =>
  api('PUT', `/grup/${id}/anggota/${anggotaId}/peran`, { peran }, t)

/** Pesan kontrol di dalam sesi 1:1: membagikan kunci pengirim grup (Sender Key). Tidak ditampilkan sebagai pesan. */
const AWALAN_KUNCI = '\u0001SKDM:'

type TerbagiGrup = Record<string, { dist: string; ke: string[] }>

/** Koneksi relay + enkripsi. Kunci hanya ada di perangkat; server hanya melihat ciphertext. */
export class Obrolan {
  private ws?: WebSocket
  private nomor = 0
  private tutup = false
  private pewaktu?: ReturnType<typeof setTimeout>
  private antrean: Promise<void> = Promise.resolve() // pesan masuk diproses berurutan (kunci grup harus lebih dulu dari pesannya)
  private menungguTerkirim = new Map<string, () => void>()
  onPesan: (p: Pesan) => void = () => {}
  onPesanGrup: (grupId: string, p: Pesan) => void = () => {}
  onHapus: (kunci: string, pengirimId: string, ref: string) => void = () => {}
  /** Tanda terima dari penerima: kunci obrolan, id pesan (ref), penerima, jenis tanda, waktu. */
  onTanda: (kunci: string, ref: string, oleh: string, t: 'sampai' | 'baca', waktu: number) => void = () => {}
  onStatus: (idKlien: string, status: 'terkirim' | 'gagal') => void = () => {}
  onKoneksi: (tersambung: boolean) => void = () => {}
  onSesiBerakhir: () => void = () => {}
  onGrupBerubah: () => void = () => {}
  onStatusBerubah: () => void = () => {}
  onPeran: (peran: PeranAnggota) => void = () => {}

  constructor(public sesi: Sesi) {}

  /** Menukar refresh token dengan token baru. 401 berarti perangkat ini sudah tidak sah. */
  private async segarkan() {
    try {
      const r = await api<Token>('POST', '/auth/refresh', { refreshToken: this.sesi.refresh })
      this.sesi = { ...this.sesi, token: r.aksesToken, refresh: r.refreshToken }
      await simpanSesi(this.sesi)
    } catch (e) {
      if (e instanceof GalatApi && e.status === 401) {
        this.tutup = true
        this.onSesiBerakhir()
      }
      throw e
    }
  }

  /** Mengambil peran terbaru (admin/bukan) dari server. */
  async muatProfil() {
    try {
      const r = await api<{ status: StatusAnggota; peran: PeranAnggota }>('GET', '/auth/saya', undefined, this.sesi.token)
      this.sesi = { ...this.sesi, peran: r.peran, status: r.status }
      this.onPeran(r.peran)
    } catch {
      // gangguan jaringan: peran lama dipakai
    }
  }

  /** Menjaga persediaan prekey sekali-pakai di server (dihabiskan setiap ada yang memulai percakapan). */
  private async isiUlangPrekey() {
    const { jumlah } = await api<{ jumlah: number }>('GET', '/prekey/sisa', undefined, this.sesi.token)
    if (jumlah < 10) {
      const baru = await Signal.buatPrekeyBaru(30)
      await api('PUT', '/prekey/isi-ulang', { oneTime: baru }, this.sesi.token)
    }
  }

  /** Meminta izin notifikasi lalu mendaftarkan token FCM ke gateway. Gagal diam-diam: chat tetap jalan tanpa push. */
  private async daftarkanPush() {
    try {
      if (Platform.OS !== 'android') return
      if (Number(Platform.Version) >= 33) {
        const izin = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS')
        if (izin !== PermissionsAndroid.RESULTS.GRANTED) return
      }
      const token = await Signal.tokenPush()
      await api('PUT', '/perangkat/push', { token }, this.sesi.token)
    } catch (e) {
      console.warn('push tidak aktif:', String(e))
    }
  }

  async sambung() {
    this.tutup = false
    try {
      await this.segarkan()
    } catch {
      if (!this.tutup) this.pewaktu = setTimeout(() => this.sambung(), 3000)
      return
    }
    this.muatProfil()
    this.isiUlangPrekey().catch(() => {})
    this.daftarkanPush()
    const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws?token=${this.sesi.token}`)
    this.ws = ws
    ws.onopen = () => this.onKoneksi(true)
    ws.onclose = () => {
      this.onKoneksi(false)
      if (!this.tutup) this.pewaktu = setTimeout(() => this.sambung(), 2000)
    }
    ws.onmessage = e => {
      const m = JSON.parse(String(e.data))
      if (m.t === 'terkirim') {
        this.onStatus(m.idKlien, 'terkirim')
        this.menungguTerkirim.get(m.idKlien)?.()
      } else if (m.t === 'galat') console.warn('relay:', m.pesan)
      else if (m.t === 'grupBerubah') this.onGrupBerubah()
      else if (m.t === 'statusBerubah') { this.muatProfil(); this.onStatusBerubah() }
      else if (m.t === 'masuk') this.antrean = this.antrean.then(() => this.tangani(ws, m))
    }
  }

  private async tangani(ws: WebSocket, m: { id: string; dari: string; grupId?: string; jenis: number; isi: string; idKlien?: string; waktu: number }) {
    try {
      if (m.jenis === 5) {
        // pesan kontrol dari server: satu pesan dihapus untuk semua (tanpa isi pesan, hanya penanda)
        const h = JSON.parse(m.isi) as { pengirimId: string; idKlien: string }
        this.onHapus(m.grupId ? kunciGrup(m.grupId) : m.dari, h.pengirimId, h.idKlien)
      } else if (m.jenis === 6) {
        const h = JSON.parse(m.isi) as { t: 'sampai' | 'baca'; idKlien: string; waktu: number }
        if (h.t === 'sampai' || h.t === 'baca') this.onTanda(m.grupId ? kunciGrup(m.grupId) : m.dari, h.idKlien, m.dari, h.t, h.waktu)
      } else if (m.grupId) {
        const teks = await Signal.dekripsiGrup(m.dari, m.isi)
        this.onPesanGrup(m.grupId, { id: m.id, dari: m.dari, teks, waktu: m.waktu, saya: false, ref: m.idKlien })
      } else {
        const teks = await Signal.dekripsi(m.dari, m.jenis, m.isi)
        if (teks.startsWith(AWALAN_KUNCI)) await Signal.terimaKunciGrup(m.dari, teks.slice(AWALAN_KUNCI.length))
        else this.onPesan({ id: m.id, dari: m.dari, teks, waktu: m.waktu, saya: false, ref: m.idKlien })
      }
    } catch (err) {
      console.warn('gagal dekripsi', String(err))
    }
    // Tetap di-ack: pesan yang tak bisa didekripsi (mis. terkirim ganda) tidak akan pernah bisa dibaca.
    if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'ack', data: { id: m.id } }))
  }

  putus() {
    this.tutup = true
    if (this.pewaktu) clearTimeout(this.pewaktu)
    this.ws?.close()
  }

  private async pastikanSesi(untuk: string) {
    if (!Signal.punyaSesi(untuk)) {
      const bundle = await api<BundleLawan>('POST', `/prekey/ambil/${untuk}`, undefined, this.sesi.token)
      await Signal.mulaiSesi(bundle)
    }
  }

  private kirimCipher(untuk: string, c: { jenis: number; isi: string }) {
    const idKlien = `${Date.now()}-${++this.nomor}`
    this.ws?.send(JSON.stringify({ event: 'kirim', data: { untuk, jenis: c.jenis, isi: c.isi, idKlien } }))
    return idKlien
  }

  async kirim(untuk: string, teks: string): Promise<Pesan> {
    await this.pastikanSesi(untuk)
    const idKlien = this.kirimCipher(untuk, await Signal.enkripsi(untuk, teks))
    return { id: idKlien, dari: this.sesi.id, teks, waktu: Date.now(), saya: true, status: 'dikirim', ref: idKlien }
  }

  // --- Grup (Sender Key) ---

  private async muatTerbagi(): Promise<TerbagiGrup> {
    try {
      const t = await Signal.baca('kunci-grup')
      return t ? (JSON.parse(t) as TerbagiGrup) : {}
    } catch {
      return {}
    }
  }

  /** Menunggu server mengonfirmasi satu pesan sudah tersimpan (supaya urutan kunci → pesan terjaga). */
  private tungguTerkirim(idKlien: string, ms = 15000) {
    return new Promise<void>((selesai, gagal) => {
      const t = setTimeout(() => { this.menungguTerkirim.delete(idKlien); gagal(new Error('Server tidak menjawab')) }, ms)
      this.menungguTerkirim.set(idKlien, () => { clearTimeout(t); this.menungguTerkirim.delete(idKlien); selesai() })
    })
  }

  /** Membagikan kunci pengirim saya kepada anggota yang belum menerimanya untuk kunci grup saat ini. */
  private async bagikanKunciGrup(grupId: string, dist: string, anggotaIds: string[]) {
    const terbagi = await this.muatTerbagi()
    const catatan = terbagi[grupId]?.dist === dist ? terbagi[grupId] : { dist, ke: [] as string[] }
    const belum = anggotaIds.filter(id => id !== this.sesi.id && !catatan.ke.includes(id))
    if (!belum.length) return
    const skdm = await Signal.buatKunciGrup(dist)
    const isi = AWALAN_KUNCI + skdm
    for (let i = 0; i < belum.length; i += 10) {
      await Promise.all(belum.slice(i, i + 10).map(async id => {
        await this.pastikanSesi(id)
        const idKlien = this.kirimCipher(id, await Signal.enkripsi(id, isi))
        await this.tungguTerkirim(idKlien)
        catatan.ke.push(id)
      }))
    }
    terbagi[grupId] = catatan
    await Signal.simpan('kunci-grup', JSON.stringify(terbagi))
  }

  async kirimGrup(grup: { id: string; idDistribusi: string; anggotaIds: string[] }, teks: string): Promise<Pesan> {
    await this.bagikanKunciGrup(grup.id, grup.idDistribusi, grup.anggotaIds)
    const isi = await Signal.enkripsiGrup(grup.idDistribusi, teks)
    const idKlien = `${Date.now()}-${++this.nomor}`
    this.ws?.send(JSON.stringify({ event: 'kirimGrup', data: { grupId: grup.id, isi, idKlien } }))
    return { id: idKlien, dari: this.sesi.id, teks, waktu: Date.now(), saya: true, status: 'dikirim', ref: idKlien }
  }

  /** Menghapus satu pesan grup untuk semua anggota (server memeriksa wewenang: pengirim, admin grup, atau admin aplikasi). */
  /** Menjalankan operasi berkas; bila token kedaluwarsa (401) sekali coba lagi setelah menyegarkan token. */
  private async denganToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
    try {
      return await fn(this.sesi.token)
    } catch (e) {
      if (!String((e as Error)?.message).includes('(401)')) throw e
      await this.segarkan()
      return fn(this.sesi.token)
    }
  }

  /** Mengenkripsi berkas di perangkat ini lalu mengunggah blob-nya; kunci tidak pernah dikirim ke server. */
  unggahBerkas(sumber: string) {
    return this.denganToken(t => Signal.unggahBerkas(sumber, `${BASE}/berkas`, t))
  }

  /** Mengunduh dan mendekripsi lampiran; hasilnya disimpan di penyimpanan privat aplikasi dan dipakai ulang. */
  ambilBerkas(l: Lampiran): Promise<string> {
    const ekstensi = (l.n.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '').toLowerCase()
    return this.denganToken(t => Signal.unduhBerkas(`${BASE}/berkas/${l.id}`, t, l.k, l.iv, `${l.id}${ekstensi}`))
  }

  /** Memberi tahu pengirim bahwa pesan-pesannya sudah dibaca (✓✓ biru). */
  laporBaca(pengirimId: string, refs: string[]) {
    if (refs.length) this.ws?.send(JSON.stringify({ event: 'baca', data: { pengirimId, idKlien: refs.slice(0, 100) } }))
  }

  hapusPesanPribadi(untukId: string, ref: string) {
    this.ws?.send(JSON.stringify({ event: 'hapusPesan', data: { untukId, idKlien: ref } }))
  }

  hapusPesanGrup(grupId: string, pengirimId: string, ref: string) {
    this.ws?.send(JSON.stringify({ event: 'hapusPesan', data: { grupId, pengirimId, idKlien: ref } }))
  }
}
