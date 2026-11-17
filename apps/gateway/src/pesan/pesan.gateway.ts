import { IncomingMessage } from 'http'
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { WebSocket } from 'ws'
import { AuthService } from '../auth/auth.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'

const TTL_ANTREAN_MS = 30 * 24 * 3600 * 1000
const MAKS_ISI = 256 * 1024 // karakter base64 (pesan lampiran membawa hingga 10 thumbnail kecil)
const MAKS_PESAN_PER_MENIT = 2500 // termasuk pembagian kunci grup (maks. satu per anggota, jadi harus > MAKS_ANGGOTA_GRUP)

interface Koneksi extends WebSocket {
  anggotaId?: string
  siap?: Promise<void> // selesai setelah autentikasi; pesan yang datang lebih awal menunggu ini
  jendela?: { mulai: number; jumlah: number }
}

/**
 * Relay ciphertext. Server hanya meneruskan dan mengantre byte terenkripsi;
 * tidak pernah memiliki kunci sehingga tidak bisa membaca isi pesan.
 *
 * Klien → server:  {event:'kirim', data:{untuk, jenis, isi, idKlien}} | {event:'ack', data:{id}}
 * Server → klien:  {t:'masuk', id, dari, jenis, isi, waktu} | {t:'terkirim', idKlien, id} | {t:'galat', pesan} | {t:'siap'}
 */
@WebSocketGateway({ path: '/ws' })
export class PesanGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Relay')
  private readonly online = new Map<string, Koneksi>()
  private pembersih?: NodeJS.Timeout

  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService, private readonly push: PushService) {}

  onModuleInit() {
    this.pembersih = setInterval(() => {
      this.prisma.pesanAntrean.deleteMany({ where: { kedaluwarsa: { lt: new Date() } } }).catch(() => undefined)
    }, 3600_000)
  }
  onModuleDestroy() {
    if (this.pembersih) clearInterval(this.pembersih)
  }

  handleConnection(ws: Koneksi, req: IncomingMessage) {
    ws.siap = this.sambut(ws, req)
    ws.siap.catch(() => undefined)
  }

  private async sambut(ws: Koneksi, req: IncomingMessage) {
    try {
      const token = new URL(req.url ?? '', 'http://x').searchParams.get('token') ?? ''
      const payload = this.auth.verifikasiToken(token)
      const pengguna = await this.auth.periksaSesi(payload)
      // Satu perangkat per anggota: koneksi lama (bila ada) ditutup.
      this.online.get(pengguna.id)?.close(4001, 'Digantikan koneksi baru')
      ws.anggotaId = pengguna.id
      this.online.set(pengguna.id, ws)
      this.kirimKe(ws, { t: 'siap' })
      await this.kosongkanAntrean(ws)
    } catch {
      ws.close(4401, 'Tidak berwenang')
      throw new Error('tidak berwenang')
    }
  }

  handleDisconnect(ws: Koneksi) {
    if (ws.anggotaId && this.online.get(ws.anggotaId) === ws) this.online.delete(ws.anggotaId)
  }

  private kirimKe(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
  }

  private async kosongkanAntrean(ws: Koneksi) {
    if (!ws.anggotaId) return
    const antre = await this.prisma.pesanAntrean.findMany({
      where: { penerimaId: ws.anggotaId, diterima: false, kedaluwarsa: { gt: new Date() } },
      orderBy: { dibuatPada: 'asc' },
      take: 500,
      select: { id: true, pengirimId: true, grupId: true, jenis: true, isi: true, idKlien: true, dibuatPada: true },
    })
    for (const p of antre) {
      this.kirimKe(ws, { t: 'masuk', id: p.id, dari: p.pengirimId, grupId: p.grupId ?? undefined, jenis: p.jenis, isi: p.isi, idKlien: p.idKlien, waktu: p.dibuatPada.getTime() })
    }
  }

  @SubscribeMessage('kirim')
  async kirim(ws: Koneksi, d: { untuk?: string; jenis?: number; isi?: string; idKlien?: string }) {
    await ws.siap?.catch(() => undefined)
    if (!ws.anggotaId) return
    const sekarang = Date.now()
    if (!ws.jendela || sekarang - ws.jendela.mulai > 60_000) ws.jendela = { mulai: sekarang, jumlah: 0 }
    if (++ws.jendela.jumlah > MAKS_PESAN_PER_MENIT) return this.kirimKe(ws, { t: 'galat', pesan: 'Terlalu banyak pesan, coba sebentar lagi' })

    if (!d?.untuk || !d.idKlien || typeof d.isi !== 'string' || ![2, 3].includes(d.jenis ?? -1) || d.isi.length > MAKS_ISI) {
      return this.kirimKe(ws, { t: 'galat', pesan: 'Format pesan tidak valid' })
    }
    const penerima = await this.prisma.anggota.findFirst({
      where: { id: d.untuk, status: 'AKTIF', perangkat: { isNot: null } },
      select: { id: true },
    })
    if (!penerima) return this.kirimKe(ws, { t: 'galat', pesan: 'Penerima tidak ditemukan' })

    let id: string
    let dibuat: Date
    try {
      const p = await this.prisma.pesanAntrean.create({
        data: {
          penerimaId: penerima.id,
          pengirimId: ws.anggotaId,
          jenis: d.jenis!,
          isi: d.isi,
          idKlien: d.idKlien,
          kedaluwarsa: new Date(Date.now() + TTL_ANTREAN_MS),
        },
        select: { id: true, dibuatPada: true },
      })
      id = p.id
      dibuat = p.dibuatPada
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        // pesan yang sama terkirim ulang (koneksi putus sebelum tanda terima) — cukup konfirmasi lagi
        const ada = await this.prisma.pesanAntrean.findUnique({
          where: { pengirimId_idKlien_penerimaId: { pengirimId: ws.anggotaId, idKlien: d.idKlien, penerimaId: penerima.id } },
          select: { id: true },
        })
        return this.kirimKe(ws, { t: 'terkirim', idKlien: d.idKlien, id: ada?.id })
      }
      this.log.error(`Gagal menyimpan pesan: ${(e as Error).message}`)
      return this.kirimKe(ws, { t: 'galat', pesan: 'Pesan belum bisa dikirim' })
    }

    this.kirimKe(ws, { t: 'terkirim', idKlien: d.idKlien, id })
    const tujuan = this.online.get(penerima.id)
    if (tujuan) this.kirimKe(tujuan, { t: 'masuk', id, dari: ws.anggotaId, jenis: d.jenis, isi: d.isi, idKlien: d.idKlien, waktu: dibuat.getTime() })
    else this.push.kabari(penerima.id).catch(() => undefined) // penerima luring → bangunkan lewat push
  }

  /** Kirim ciphertext grup (Sender Key). Server menggandakan ke setiap anggota aktif lain; isinya tetap tak terbaca. */
  @SubscribeMessage('kirimGrup')
  async kirimGrup(ws: Koneksi, d: { grupId?: string; isi?: string; idKlien?: string }) {
    await ws.siap?.catch(() => undefined)
    if (!ws.anggotaId) return
    const sekarang = Date.now()
    if (!ws.jendela || sekarang - ws.jendela.mulai > 60_000) ws.jendela = { mulai: sekarang, jumlah: 0 }
    if (++ws.jendela.jumlah > MAKS_PESAN_PER_MENIT) return this.kirimKe(ws, { t: 'galat', pesan: 'Terlalu banyak pesan, coba sebentar lagi' })
    if (!d?.grupId || !d.idKlien || typeof d.isi !== 'string' || d.isi.length > MAKS_ISI) {
      return this.kirimKe(ws, { t: 'galat', pesan: 'Format pesan tidak valid' })
    }
    const penerima = await this.prisma.anggotaGrup.findMany({
      where: { grupId: d.grupId, anggota: { status: 'AKTIF', perangkat: { isNot: null } } },
      select: { anggotaId: true },
    })
    if (!penerima.some((a) => a.anggotaId === ws.anggotaId)) return this.kirimKe(ws, { t: 'galat', pesan: 'Anda bukan anggota grup ini' })

    const tujuan = penerima.map((a) => a.anggotaId).filter((id) => id !== ws.anggotaId)
    let baru: { id: string; penerimaId: string; dibuatPada: Date }[] = []
    try {
      baru = await this.prisma.pesanAntrean.createManyAndReturn({
        data: tujuan.map((penerimaId) => ({
          penerimaId,
          pengirimId: ws.anggotaId!,
          grupId: d.grupId,
          jenis: 4,
          isi: d.isi!,
          idKlien: d.idKlien!,
          kedaluwarsa: new Date(Date.now() + TTL_ANTREAN_MS),
        })),
        skipDuplicates: true, // terkirim ulang → baris lama dipertahankan, tidak digandakan
        select: { id: true, penerimaId: true, dibuatPada: true },
      })
    } catch (e) {
      this.log.error(`Gagal menyimpan pesan grup: ${(e as Error).message}`)
      return this.kirimKe(ws, { t: 'galat', pesan: 'Pesan belum bisa dikirim' })
    }
    this.kirimKe(ws, { t: 'terkirim', idKlien: d.idKlien })
    for (const b of baru) {
      const ke = this.online.get(b.penerimaId)
      if (ke) this.kirimKe(ke, { t: 'masuk', id: b.id, dari: ws.anggotaId, grupId: d.grupId, jenis: 4, isi: d.isi, idKlien: d.idKlien, waktu: b.dibuatPada.getTime() })
      else this.push.kabari(b.penerimaId).catch(() => undefined)
    }
  }

  /**
   * Menghapus satu pesan grup untuk semua anggota. Boleh oleh pengirimnya sendiri, admin grup, atau admin aplikasi.
   * Server tak bisa membaca isi pesan; ia hanya menandai pesan (pengirim + idKlien) sebagai dihapus.
   * Salinan yang belum diterima dibuang, dan anggota luring menerima pesan kontrol (jenis 5) saat tersambung lagi.
   */
  @SubscribeMessage('hapusPesan')
  async hapusPesan(ws: Koneksi, d: { grupId?: string; untukId?: string; pengirimId?: string; idKlien?: string }) {
    await ws.siap?.catch(() => undefined)
    if (!ws.anggotaId) return
    if (!d?.grupId && d?.untukId && d.idKlien && d.idKlien.length <= 100) return this.hapusPribadi(ws, d.untukId, d.idKlien)
    if (!d?.grupId || !d.pengirimId || !d.idKlien || d.idKlien.length > 100) {
      return this.kirimKe(ws, { t: 'galat', pesan: 'Format permintaan tidak valid' })
    }
    const [saya, anggotaGrup] = await Promise.all([
      this.prisma.anggota.findUnique({ where: { id: ws.anggotaId }, select: { peran: true } }),
      this.prisma.anggotaGrup.findMany({
        where: { grupId: d.grupId, anggota: { status: 'AKTIF', perangkat: { isNot: null } } },
        select: { anggotaId: true, peran: true },
      }),
    ])
    const sayaDiGrup = anggotaGrup.find((a) => a.anggotaId === ws.anggotaId)
    if (!sayaDiGrup) return this.kirimKe(ws, { t: 'galat', pesan: 'Anda bukan anggota grup ini' })
    const berwenang = d.pengirimId === ws.anggotaId || sayaDiGrup.peran === 'ADMIN_GRUP' || saya?.peran === 'ADMIN' || saya?.peran === 'ADMIN_UTAMA'
    if (!berwenang) return this.kirimKe(ws, { t: 'galat', pesan: 'Hanya admin yang dapat menghapus pesan orang lain' })

    // pesan asli yang belum sempat diterima anggota luring dibuang agar tak pernah tampil
    await this.prisma.pesanAntrean.deleteMany({
      where: { grupId: d.grupId, pengirimId: d.pengirimId, idKlien: d.idKlien, jenis: 4, diterima: false },
    })
    const isi = JSON.stringify({ pengirimId: d.pengirimId, idKlien: d.idKlien })
    const tujuan = anggotaGrup.map((a) => a.anggotaId) // termasuk penghapus: perangkat lain/riwayatnya ikut diperbarui
    const baru = await this.prisma.pesanAntrean.createManyAndReturn({
      data: tujuan.map((penerimaId) => ({
        penerimaId,
        pengirimId: ws.anggotaId!,
        grupId: d.grupId,
        jenis: 5,
        isi,
        idKlien: `hapus:${d.pengirimId}:${d.idKlien}`,
        kedaluwarsa: new Date(Date.now() + TTL_ANTREAN_MS),
      })),
      skipDuplicates: true,
      select: { id: true, penerimaId: true, dibuatPada: true },
    })
    for (const b of baru) {
      const ke = this.online.get(b.penerimaId)
      if (ke) this.kirimKe(ke, { t: 'masuk', id: b.id, dari: ws.anggotaId, grupId: d.grupId, jenis: 5, isi, idKlien: `hapus:${d.pengirimId}:${d.idKlien}`, waktu: b.dibuatPada.getTime() })
    }
  }

  /** Hapus untuk semua pada percakapan 1:1: hanya pengirim asli yang boleh menghapus pesannya sendiri. */
  private async hapusPribadi(ws: Koneksi, untukId: string, idKlien: string) {
    // jenis 3 (prekey) tidak dibuang karena memuat pembentukan sesi; jenis 2 yang belum diterima aman dibuang
    await this.prisma.pesanAntrean.deleteMany({
      where: { pengirimId: ws.anggotaId!, penerimaId: untukId, idKlien, jenis: 2, diterima: false },
    })
    const isi = JSON.stringify({ pengirimId: ws.anggotaId, idKlien })
    const kunci = `hapus:${ws.anggotaId}:${idKlien}`
    const baru = await this.prisma.pesanAntrean.createManyAndReturn({
      data: [{ penerimaId: untukId, pengirimId: ws.anggotaId!, jenis: 5, isi, idKlien: kunci, kedaluwarsa: new Date(Date.now() + TTL_ANTREAN_MS) }],
      skipDuplicates: true,
      select: { id: true, penerimaId: true, dibuatPada: true },
    })
    for (const b of baru) {
      const ke = this.online.get(b.penerimaId)
      if (ke) this.kirimKe(ke, { t: 'masuk', id: b.id, dari: ws.anggotaId, jenis: 5, isi, idKlien: kunci, waktu: b.dibuatPada.getTime() })
    }
  }

  /** Dipakai modul lain untuk mengabari anggota yang sedang online (mis. grup berubah). */
  beritahu(anggotaIds: string[], data: unknown) {
    for (const id of new Set(anggotaIds)) {
      const ws = this.online.get(id)
      if (ws) this.kirimKe(ws, data)
    }
  }

  /** Menutup koneksi live seorang anggota (diblokir/dikeluarkan). */
  putuskan(anggotaId: string) {
    this.online.get(anggotaId)?.close(4401, 'Akses dicabut')
  }

  @SubscribeMessage('ack')
  async ack(ws: Koneksi, d: { id?: string }) {
    await ws.siap?.catch(() => undefined)
    if (!ws.anggotaId || !d?.id) return
    const baris = await this.prisma.pesanAntrean.findFirst({
      where: { id: d.id, penerimaId: ws.anggotaId },
      select: { pengirimId: true, grupId: true, jenis: true, idKlien: true, diterima: true },
    })
    // isi (ciphertext) langsung dibuang; barisnya disimpan 1 hari hanya sebagai penanda dedup
    await this.prisma.pesanAntrean.updateMany({
      where: { id: d.id, penerimaId: ws.anggotaId },
      data: { diterima: true, isi: '', kedaluwarsa: new Date(Date.now() + 24 * 3600 * 1000) },
    })
    // Tanda "sampai" (✓✓) hanya untuk pesan sungguhan, bukan pesan kontrol; hanya sekali per pesan.
    if (baris && !baris.diterima && [2, 3, 4].includes(baris.jenis)) {
      await this.kirimTanda(ws.anggotaId, baris.pengirimId, baris.grupId, 'sampai', baris.idKlien)
    }
  }

  /** Penerima melaporkan pesan sudah dibaca → pengirim diberi tahu (pesan kontrol jenis 6; tahan offline). */
  @SubscribeMessage('baca')
  async baca(ws: Koneksi, d: { pengirimId?: string; idKlien?: string[] }) {
    await ws.siap?.catch(() => undefined)
    if (!ws.anggotaId || !d?.pengirimId || !Array.isArray(d.idKlien)) return
    const ids = d.idKlien.filter(x => typeof x === 'string' && x.length <= 100).slice(0, 100)
    if (!ids.length) return
    // hanya pesan yang benar-benar dikirim ke pembaca ini yang boleh ditandai
    const sah = await this.prisma.pesanAntrean.findMany({
      where: { penerimaId: ws.anggotaId, pengirimId: d.pengirimId, idKlien: { in: ids }, jenis: { in: [2, 3, 4] } },
      select: { idKlien: true, grupId: true },
    })
    for (const b of sah) await this.kirimTanda(ws.anggotaId, d.pengirimId, b.grupId, 'baca', b.idKlien)
  }

  private async kirimTanda(oleh: string, kepada: string, grupId: string | null, t: 'sampai' | 'baca', idKlienAsli: string) {
    const isi = JSON.stringify({ t, idKlien: idKlienAsli, waktu: Date.now() })
    const kunci = `${t}:${idKlienAsli}`
    const baru = await this.prisma.pesanAntrean.createManyAndReturn({
      data: [{ penerimaId: kepada, pengirimId: oleh, jenis: 6, grupId, isi, idKlien: kunci, kedaluwarsa: new Date(Date.now() + TTL_ANTREAN_MS) }],
      skipDuplicates: true,
      select: { id: true, dibuatPada: true },
    })
    const ke = this.online.get(kepada)
    for (const b of baru) if (ke) this.kirimKe(ke, { t: 'masuk', id: b.id, dari: oleh, grupId: grupId ?? undefined, jenis: 6, isi, idKlien: kunci, waktu: b.dibuatPada.getTime() })
  }
}
