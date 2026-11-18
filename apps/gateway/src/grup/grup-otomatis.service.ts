import { randomUUID } from 'crypto'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PesanGateway } from '../pesan/pesan.gateway'

/** Nama grup otomatis yang tetap. Nama grup distrik datang dari superapp (kunci DISTRIK:<id>). */
const NAMA_TETAP: Record<string, string> = {
  PELAYAN: 'Pelayan HKBP',
  'TOHONAN:PENDETA': 'Pendeta',
  'TOHONAN:BIBELVROUW': 'Bibelvrouw',
  'TOHONAN:DIAKONES': 'Diakones',
  'TOHONAN:GURU_HURIA': 'Guru Huria',
  'LPP:LPP_I': 'Calon Pelayan — LPP I',
  'LPP:LPP_II': 'Calon Pelayan — LPP II',
  'LPP:LPP_III': 'Calon Pelayan — LPP III',
  KANTOR_PUSAT: 'Kantor Pusat',
}

export type HasilRekonsiliasi = { grupBaru: number; masuk: number; keluar: number }

/**
 * Grup otomatis: keanggotaan dihitung dari `Anggota.grupOtomatis` (diisi sinkronisasi superapp), bukan diisi tangan.
 * Anggota yang jabatannya pindah otomatis keluar dari grup lama dan masuk grup baru.
 * Hanya anggota berstatus AKTIF yang dimasukkan ke grup (anggota lain masuk setelah disetujui).
 */
@Injectable()
export class GrupOtomatisService {
  private readonly log = new Logger('GrupOtomatis')
  private berjalan: Promise<HasilRekonsiliasi> | null = null
  private ulang = false

  constructor(private readonly prisma: PrismaService, private readonly relay: PesanGateway) {}

  /** Satu putaran pada satu waktu; permintaan yang datang saat berjalan memicu satu putaran lagi setelahnya. */
  rekonsiliasi(namaBaru: Map<string, string> = new Map()): Promise<HasilRekonsiliasi> {
    if (this.berjalan) {
      this.ulang = true
      return this.berjalan
    }
    this.berjalan = (async () => {
      try {
        let hasil = await this.putaran(namaBaru)
        while (this.ulang) {
          this.ulang = false
          hasil = await this.putaran(namaBaru)
        }
        return hasil
      } finally {
        this.berjalan = null
      }
    })()
    return this.berjalan
  }

  private async putaran(namaBaru: Map<string, string>): Promise<HasilRekonsiliasi> {
    const hasil: HasilRekonsiliasi = { grupBaru: 0, masuk: 0, keluar: 0 }
    const dipakai = new Set<string>()
    const baris = await this.prisma.anggota.findMany({ where: { NOT: { grupOtomatis: { isEmpty: true } } }, select: { grupOtomatis: true } })
    for (const b of baris) for (const k of b.grupOtomatis) dipakai.add(k)

    const ada = await this.prisma.grup.findMany({ where: { kunci: { not: null } }, select: { id: true, kunci: true, nama: true } })
    const peta = new Map(ada.map((g) => [g.kunci as string, g]))

    for (const kunci of dipakai) {
      const nama = NAMA_TETAP[kunci] ?? namaBaru.get(kunci)
      const g = peta.get(kunci)
      if (!g) {
        const baru = await this.prisma.grup.create({
          data: { kunci, nama: nama ?? kunci, dibuatOleh: 'sistem' },
          select: { id: true, kunci: true, nama: true },
        })
        peta.set(kunci, baru)
        hasil.grupBaru++
      } else if (nama && nama !== g.nama && kunci.startsWith('DISTRIK:')) {
        // nama distrik bisa berubah di superapp; grup mengikuti
        await this.prisma.grup.update({ where: { id: g.id }, data: { nama } })
      }
    }

    for (const [kunci, g] of peta) {
      const diinginkan = new Set(
        (await this.prisma.anggota.findMany({ where: { status: 'AKTIF', grupOtomatis: { has: kunci } }, select: { id: true } })).map((a) => a.id),
      )
      const sekarang = new Set((await this.prisma.anggotaGrup.findMany({ where: { grupId: g.id }, select: { anggotaId: true } })).map((a) => a.anggotaId))
      const tambah = [...diinginkan].filter((id) => !sekarang.has(id))
      const keluar = [...sekarang].filter((id) => !diinginkan.has(id))
      if (!tambah.length && !keluar.length) continue
      if (tambah.length) await this.prisma.anggotaGrup.createMany({ data: tambah.map((anggotaId) => ({ grupId: g.id, anggotaId })), skipDuplicates: true })
      if (keluar.length) {
        // kunci grup diganti supaya yang keluar tidak bisa membaca pesan berikutnya
        await this.prisma.$transaction([
          this.prisma.anggotaGrup.deleteMany({ where: { grupId: g.id, anggotaId: { in: keluar } } }),
          this.prisma.grup.update({ where: { id: g.id }, data: { idDistribusi: randomUUID() } }),
        ])
      }
      hasil.masuk += tambah.length
      hasil.keluar += keluar.length
      const sisa = await this.prisma.anggotaGrup.findMany({ where: { grupId: g.id }, select: { anggotaId: true } })
      this.relay.beritahu([...sisa.map((x) => x.anggotaId), ...keluar], { t: 'grupBerubah', grupId: g.id })
    }
    if (hasil.grupBaru || hasil.masuk || hasil.keluar) this.log.log(`Grup otomatis: ${hasil.grupBaru} baru, ${hasil.masuk} masuk, ${hasil.keluar} keluar`)
    return hasil
  }
}
