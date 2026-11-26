import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Pengguna } from '../auth/jwt-auth.guard'
import { KontakService } from '../kontak/kontak.service'
import { PrismaService } from '../prisma/prisma.service'

/** Grup bawaan seluruh pelayan; berada di grup ini saja tidak membuat status saling terlihat. */
const KUNCI_GRUP_PELAYAN = 'PELAYAN'
const MASA_BERLAKU_MS = 24 * 3600_000
const MAKS_KOMENTAR_PER_STATUS = 300
const MAKS_STATUS_AKTIF = 10
/** Batas status teman yang dikirim per permintaan; milik sendiri selalu lengkap. */
const MAKS_STATUS_TEMAN = 300
/** Status kedaluwarsa dibuang dari server setelah jeda ini; salinan milik sendiri tersimpan di HP pemiliknya. */
const JEDA_BUANG_MS = 3600_000

const pilihStatus = {
  id: true, anggotaId: true, teks: true, suasana: true, dibuatPada: true, kedaluwarsa: true,
  anggota: { select: { nama: true } },
  _count: { select: { komentar: true } },
} as const

type BarisStatus = {
  id: string; anggotaId: string; teks: string; suasana: string | null; dibuatPada: Date; kedaluwarsa: Date
  anggota: { nama: string }; _count: { komentar: number }
}

@Injectable()
export class StatusService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Status')
  private timer?: NodeJS.Timeout

  constructor(private readonly prisma: PrismaService, private readonly kontak: KontakService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.buang().catch((e) => this.log.error(e)), 3600_000)
    this.timer.unref()
    this.buang().catch(() => {})
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  /** Menghapus status yang sudah lewat 24 jam (komentarnya ikut terhapus lewat cascade). */
  private async buang() {
    const r = await this.prisma.statusHarian.deleteMany({ where: { kedaluwarsa: { lt: new Date(Date.now() - JEDA_BUANG_MS) } } })
    if (r.count) this.log.log(`${r.count} status kedaluwarsa dibuang`)
  }

  /**
   * Syarat status terlihat oleh `saya`: milik sendiri; milik admin utama (terlihat semua orang); atau pemiliknya satu grup dengan saya.
   * Grup bawaan PELAYAN tidak dihitung (isinya terlalu banyak orang); grup lain, otomatis maupun buatan, dihitung.
   */
  private bolehLihat(saya: string, terblokir: string[]) {
    return {
      kedaluwarsa: { gt: new Date() },
      OR: [
        { anggotaId: saya },
        { anggotaId: { notIn: terblokir }, anggota: { status: 'AKTIF' as const, peran: 'ADMIN_UTAMA' as const } },
        {
          anggotaId: { notIn: terblokir },
          anggota: {
            status: 'AKTIF' as const,
            keanggotaanGrup: {
              some: { grup: { OR: [{ kunci: null }, { kunci: { not: KUNCI_GRUP_PELAYAN } }], anggota: { some: { anggotaId: saya } } } },
            },
          },
        },
      ],
    }
  }

  private async ambilTerlihat(id: string, p: Pengguna) {
    const s = await this.prisma.statusHarian.findFirst({ where: { id, ...this.bolehLihat(p.id, await this.kontak.terblokirDenganSaya(p.id)) }, select: { id: true, anggotaId: true } })
    if (!s) throw new NotFoundException('Status tidak ditemukan atau sudah berakhir')
    return s
  }

  private bentuk(s: BarisStatus, saya: string) {
    return {
      id: s.id,
      anggotaId: s.anggotaId,
      nama: s.anggota.nama,
      teks: s.teks,
      suasana: s.suasana,
      dibuatPada: s.dibuatPada.toISOString(),
      kedaluwarsa: s.kedaluwarsa.toISOString(),
      // Komentar hanya terlihat pemilik status; orang lain tidak diberi jumlahnya.
      jumlahKomentar: s.anggotaId === saya ? s._count.komentar : 0,
      saya: s.anggotaId === saya,
    }
  }

  /** Status aktif milik saya, admin utama, dan teman satu grup (kecuali grup PELAYAN); milik saya paling depan, lalu yang terbaru. */
  async daftar(p: Pengguna) {
    const aktif = { kedaluwarsa: { gt: new Date() } }
    const terblokir = await this.kontak.terblokirDenganSaya(p.id)
    const [milik, teman] = await Promise.all([
      this.prisma.statusHarian.findMany({ where: { anggotaId: p.id, ...aktif }, select: pilihStatus, orderBy: { dibuatPada: 'desc' }, take: MAKS_STATUS_AKTIF }),
      this.prisma.statusHarian.findMany({
        where: { ...this.bolehLihat(p.id, terblokir), anggotaId: { not: p.id, notIn: terblokir } },
        select: pilihStatus,
        orderBy: { dibuatPada: 'desc' },
        take: MAKS_STATUS_TEMAN,
      }),
    ])
    return [...milik, ...teman].map((r) => this.bentuk(r, p.id))
  }

  /** Menambah satu status baru (boleh beberapa sekaligus, maksimal MAKS_STATUS_AKTIF yang masih tayang). */
  async simpan(p: Pengguna, teks: string, suasana?: string) {
    const aktif = await this.prisma.statusHarian.count({ where: { anggotaId: p.id, kedaluwarsa: { gt: new Date() } } })
    if (aktif >= MAKS_STATUS_AKTIF) throw new ForbiddenException(`Maksimal ${MAKS_STATUS_AKTIF} status aktif. Hapus salah satu dulu.`)
    const s = await this.prisma.statusHarian.create({
      data: { anggotaId: p.id, teks, suasana: suasana || null, kedaluwarsa: new Date(Date.now() + MASA_BERLAKU_MS) },
      select: pilihStatus,
    })
    return this.bentuk(s, p.id)
  }

  /** Menghapus semua status saya (dipakai aplikasi versi lama). */
  async hapusSaya(p: Pengguna) {
    await this.prisma.statusHarian.deleteMany({ where: { anggotaId: p.id } })
    return { ok: true }
  }

  /** Menghapus satu status saya beserta komentarnya. */
  async hapus(id: string, p: Pengguna) {
    const r = await this.prisma.statusHarian.deleteMany({ where: { id, anggotaId: p.id } })
    if (!r.count) throw new NotFoundException('Status tidak ditemukan')
    return { ok: true }
  }

  async komentar(id: string, p: Pengguna) {
    const s = await this.ambilTerlihat(id, p)
    // Pemilik status melihat semua komentar; orang lain hanya melihat komentarnya sendiri.
    const rows = await this.prisma.statusKomentar.findMany({
      where: { statusId: id, ...(s.anggotaId === p.id ? {} : { anggotaId: p.id }) },
      orderBy: { dibuatPada: 'asc' },
      take: MAKS_KOMENTAR_PER_STATUS,
      select: { id: true, anggotaId: true, teks: true, dibuatPada: true, anggota: { select: { nama: true } } },
    })
    return rows.map((k) => ({ id: k.id, anggotaId: k.anggotaId, nama: k.anggota.nama, teks: k.teks, dibuatPada: k.dibuatPada.toISOString() }))
  }

  async komentari(id: string, p: Pengguna, teks: string) {
    await this.ambilTerlihat(id, p)
    const jumlah = await this.prisma.statusKomentar.count({ where: { statusId: id } })
    if (jumlah >= MAKS_KOMENTAR_PER_STATUS) throw new ForbiddenException('Komentar pada status ini sudah penuh')
    const k = await this.prisma.statusKomentar.create({
      data: { statusId: id, anggotaId: p.id, teks },
      select: { id: true, anggotaId: true, teks: true, dibuatPada: true, anggota: { select: { nama: true } } },
    })
    return { id: k.id, anggotaId: k.anggotaId, nama: k.anggota.nama, teks: k.teks, dibuatPada: k.dibuatPada.toISOString() }
  }

  /** Komentar dihapus oleh penulisnya, pemilik status, atau admin aplikasi. */
  async hapusKomentar(id: string, komentarId: string, p: Pengguna) {
    const s = await this.ambilTerlihat(id, p)
    const k = await this.prisma.statusKomentar.findFirst({ where: { id: komentarId, statusId: id }, select: { anggotaId: true } })
    if (!k) throw new NotFoundException('Komentar tidak ditemukan')
    if (k.anggotaId !== p.id && s.anggotaId !== p.id && p.peran === 'USER') throw new ForbiddenException('Tidak berwenang menghapus komentar ini')
    await this.prisma.statusKomentar.delete({ where: { id: komentarId } })
    return { ok: true }
  }
}
