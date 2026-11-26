import { randomUUID } from 'crypto'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Pengguna } from '../auth/jwt-auth.guard'
import { PesanGateway } from '../pesan/pesan.gateway'

export const MAKS_ANGGOTA_GRUP = 2000 // kunci grup dibagikan satu per satu lewat sesi 1:1; pengiriman pertama ke grup besar butuh beberapa menit

@Injectable()
export class GrupService {
  constructor(private readonly prisma: PrismaService, private readonly relay: PesanGateway) {}

  private adalahAdminAplikasi(p: Pengguna) {
    return p.peran !== 'USER'
  }

  /** Admin aplikasi boleh mengelola grup mana pun; selain itu harus admin grup tersebut. */
  private async pastikanPengelola(grupId: string, p: Pengguna) {
    const grup = await this.prisma.grup.findUnique({ where: { id: grupId }, select: { id: true } })
    if (!grup) throw new NotFoundException('Grup tidak ditemukan')
    if (this.adalahAdminAplikasi(p)) return
    const k = await this.prisma.anggotaGrup.findUnique({
      where: { grupId_anggotaId: { grupId, anggotaId: p.id } },
      select: { peran: true },
    })
    if (k?.peran !== 'ADMIN_GRUP') throw new ForbiddenException('Hanya admin grup yang boleh melakukan ini')
  }

  private async idAktif(ids: string[]) {
    const unik = [...new Set(ids)]
    const aktif = await this.prisma.anggota.findMany({
      where: { id: { in: unik }, status: 'AKTIF' },
      select: { id: true },
    })
    if (aktif.length !== unik.length) throw new BadRequestException('Ada anggota yang tidak ditemukan atau belum aktif')
    return unik
  }

  /** Memberi tahu anggota yang sedang online agar memuat ulang grup. */
  private async kabari(grupId: string, tambahan: string[] = []) {
    const a = await this.prisma.anggotaGrup.findMany({ where: { grupId }, select: { anggotaId: true } })
    this.relay.beritahu([...a.map((x) => x.anggotaId), ...tambahan], { t: 'grupBerubah', grupId })
  }

  async buat(pembuat: Pengguna, nama: string, anggotaIds: string[], adminIds: string[]) {
    if (!this.adalahAdminAplikasi(pembuat)) throw new ForbiddenException('Hanya admin yang boleh membuat grup')
    const semua = await this.idAktif([pembuat.id, ...anggotaIds, ...adminIds]) // grup buatan: admin utama tidak ikut otomatis
    if (semua.length > MAKS_ANGGOTA_GRUP) throw new BadRequestException(`Anggota grup maksimal ${MAKS_ANGGOTA_GRUP}`)
    const admin = new Set([pembuat.id, ...adminIds])
    const g = await this.prisma.grup.create({
      data: {
        nama: nama.trim(),
        dibuatOleh: pembuat.id,
        anggota: { create: semua.map((id) => ({ anggotaId: id, peran: admin.has(id) ? 'ADMIN_GRUP' : 'ANGGOTA' })) },
      },
      select: { id: true },
    })
    await this.kabari(g.id)
    return this.detail(g.id, pembuat)
  }

  async daftarSaya(p: Pengguna) {
    const k = await this.prisma.anggotaGrup.findMany({
      where: { anggotaId: p.id },
      select: { peran: true, grup: { select: { id: true, nama: true, idDistribusi: true, fotoV: true, _count: { select: { anggota: true } } } } },
      orderBy: { grup: { nama: 'asc' } },
    })
    return k.map((x) => ({
      id: x.grup.id,
      nama: x.grup.nama,
      idDistribusi: x.grup.idDistribusi,
      fotoV: x.grup.fotoV,
      jumlah: x.grup._count.anggota,
      peranSaya: x.peran,
    }))
  }

  async detail(grupId: string, p: Pengguna) {
    const g = await this.prisma.grup.findUnique({
      where: { id: grupId },
      select: {
        id: true, nama: true, idDistribusi: true, fotoV: true,
        anggota: { where: { anggota: { status: 'AKTIF' } }, select: { peran: true, anggota: { select: { id: true, nama: true, fotoV: true } } } },
      },
    })
    if (!g) throw new NotFoundException('Grup tidak ditemukan')
    const saya = g.anggota.find((a) => a.anggota.id === p.id)
    if (!saya && !this.adalahAdminAplikasi(p)) throw new ForbiddenException('Anda bukan anggota grup ini')
    return {
      id: g.id,
      nama: g.nama,
      idDistribusi: g.idDistribusi,
      fotoV: g.fotoV,
      peranSaya: saya?.peran ?? null,
      anggota: g.anggota
        .map((a) => ({ id: a.anggota.id, nama: a.anggota.nama, fotoV: a.anggota.fotoV, peran: a.peran }))
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    }
  }

  async ubahNama(grupId: string, p: Pengguna, nama: string) {
    await this.pastikanPengelola(grupId, p)
    await this.prisma.grup.update({ where: { id: grupId }, data: { nama: nama.trim() } })
    await this.kabari(grupId)
    return { ok: true }
  }

  /** Foto grup (JPEG yang sudah diperkecil di perangkat); null = hapus foto. */
  async ubahFoto(grupId: string, p: Pengguna, foto: Uint8Array<ArrayBuffer> | null) {
    await this.pastikanPengelola(grupId, p)
    const g = await this.prisma.grup.update({ where: { id: grupId }, data: { foto, fotoV: { increment: 1 } }, select: { fotoV: true } })
    await this.kabari(grupId)
    return { fotoV: g.fotoV }
  }

  async tambahAnggota(grupId: string, p: Pengguna, ids: string[]) {
    await this.pastikanPengelola(grupId, p)
    const baru = await this.idAktif(ids)
    const sekarang = await this.prisma.anggotaGrup.count({ where: { grupId } })
    if (sekarang + baru.length > MAKS_ANGGOTA_GRUP) throw new BadRequestException(`Anggota grup maksimal ${MAKS_ANGGOTA_GRUP}`)
    const r = await this.prisma.anggotaGrup.createMany({
      data: baru.map((anggotaId) => ({ grupId, anggotaId })),
      skipDuplicates: true,
    })
    await this.kabari(grupId)
    return { ditambahkan: r.count }
  }

  private async pastikanAdaAdminLain(grupId: string, kecuali: string) {
    const n = await this.prisma.anggotaGrup.count({ where: { grupId, peran: 'ADMIN_GRUP', anggotaId: { not: kecuali } } })
    if (n === 0) throw new BadRequestException('Grup harus punya minimal satu admin')
  }

  /** Mengeluarkan anggota = kunci grup diganti, supaya yang keluar tidak bisa membaca pesan berikutnya. */
  async keluarkan(grupId: string, p: Pengguna, anggotaId: string) {
    if (anggotaId !== p.id) await this.pastikanPengelola(grupId, p)
    const k = await this.prisma.anggotaGrup.findUnique({ where: { grupId_anggotaId: { grupId, anggotaId } } })
    if (!k) throw new NotFoundException('Anggota tidak ada di grup ini')
    // Hanya di grup otomatis (berkunci) admin utama tidak bisa dikeluarkan; di grup buatan boleh
    const [sasaran, grup] = await Promise.all([
      this.prisma.anggota.findUnique({ where: { id: anggotaId }, select: { peran: true } }),
      this.prisma.grup.findUnique({ where: { id: grupId }, select: { kunci: true } }),
    ])
    if (sasaran?.peran === 'ADMIN_UTAMA' && grup?.kunci) throw new ForbiddenException('Admin utama selalu menjadi anggota grup otomatis')
    if (k.peran === 'ADMIN_GRUP') await this.pastikanAdaAdminLain(grupId, anggotaId)
    await this.prisma.$transaction([
      this.prisma.anggotaGrup.delete({ where: { grupId_anggotaId: { grupId, anggotaId } } }),
      this.prisma.grup.update({ where: { id: grupId }, data: { idDistribusi: randomUUID() } }),
    ])
    await this.kabari(grupId, [anggotaId])
    return { ok: true }
  }

  async ubahPeran(grupId: string, p: Pengguna, anggotaId: string, peran: 'ANGGOTA' | 'ADMIN_GRUP') {
    await this.pastikanPengelola(grupId, p)
    const k = await this.prisma.anggotaGrup.findUnique({ where: { grupId_anggotaId: { grupId, anggotaId } } })
    if (!k) throw new NotFoundException('Anggota tidak ada di grup ini')
    if (k.peran === 'ADMIN_GRUP' && peran === 'ANGGOTA') await this.pastikanAdaAdminLain(grupId, anggotaId)
    await this.prisma.anggotaGrup.update({ where: { grupId_anggotaId: { grupId, anggotaId } }, data: { peran } })
    await this.kabari(grupId)
    return { ok: true }
  }

  async hapus(grupId: string, p: Pengguna) {
    await this.pastikanPengelola(grupId, p)
    const a = await this.prisma.anggotaGrup.findMany({ where: { grupId }, select: { anggotaId: true } })
    await this.prisma.grup.delete({ where: { id: grupId } })
    this.relay.beritahu(a.map((x) => x.anggotaId), { t: 'grupBerubah', grupId })
    return { ok: true }
  }

  /** Dipakai saat anggota diblokir/dikeluarkan: keluar dari semua grup dan kunci setiap grup diganti. */
  async keluarkanDariSemuaGrup(anggotaId: string) {
    const k = await this.prisma.anggotaGrup.findMany({ where: { anggotaId }, select: { grupId: true, peran: true } })
    for (const { grupId } of k) {
      await this.prisma.$transaction([
        this.prisma.anggotaGrup.delete({ where: { grupId_anggotaId: { grupId, anggotaId } } }),
        this.prisma.grup.update({ where: { id: grupId }, data: { idDistribusi: randomUUID() } }),
      ])
      await this.kabari(grupId)
    }
  }
}
