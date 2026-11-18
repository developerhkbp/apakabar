import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Pengguna } from '../auth/jwt-auth.guard'
import { KontakService } from '../kontak/kontak.service'
import { PrismaService } from '../prisma/prisma.service'

const MASA_BERLAKU_MS = 24 * 3600_000
const MAKS_KOMENTAR_PER_STATUS = 300

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
export class StatusService {
  constructor(private readonly prisma: PrismaService, private readonly kontak: KontakService) {}

  /** Syarat status terlihat oleh `saya`: milik sendiri, atau pemiliknya satu grup buatan manual (bukan grup otomatis) dengan saya. */
  private bolehLihat(saya: string, terblokir: string[]) {
    return {
      kedaluwarsa: { gt: new Date() },
      OR: [
        { anggotaId: saya },
        {
          anggotaId: { notIn: terblokir },
          anggota: {
            status: 'AKTIF' as const,
            keanggotaanGrup: { some: { grup: { kunci: null, anggota: { some: { anggotaId: saya } } } } },
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
      jumlahKomentar: s._count.komentar,
      saya: s.anggotaId === saya,
    }
  }

  /** Status aktif milik saya dan teman satu grup manual; milik saya paling depan, lalu yang terbaru. */
  async daftar(p: Pengguna) {
    const rows = await this.prisma.statusHarian.findMany({
      where: this.bolehLihat(p.id, await this.kontak.terblokirDenganSaya(p.id)),
      select: pilihStatus,
      orderBy: { dibuatPada: 'desc' },
      take: 200,
    })
    return rows.map((r) => this.bentuk(r, p.id)).sort((a, b) => Number(b.saya) - Number(a.saya))
  }

  /** Membuat atau mengganti status saya (komentar status lama ikut hilang). */
  async simpan(p: Pengguna, teks: string, suasana?: string) {
    const kedaluwarsa = new Date(Date.now() + MASA_BERLAKU_MS)
    const dibuatPada = new Date()
    const [, s] = await this.prisma.$transaction([
      this.prisma.statusKomentar.deleteMany({ where: { status: { anggotaId: p.id } } }),
      this.prisma.statusHarian.upsert({
        where: { anggotaId: p.id },
        create: { anggotaId: p.id, teks, suasana: suasana || null, kedaluwarsa },
        update: { teks, suasana: suasana || null, dibuatPada, kedaluwarsa },
        select: pilihStatus,
      }),
    ])
    return this.bentuk(s, p.id)
  }

  async hapusSaya(p: Pengguna) {
    await this.prisma.statusHarian.deleteMany({ where: { anggotaId: p.id } })
    return { ok: true }
  }

  async komentar(id: string, p: Pengguna) {
    await this.ambilTerlihat(id, p)
    const rows = await this.prisma.statusKomentar.findMany({
      where: { statusId: id },
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
