import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PeristiwaService } from '../common/peristiwa.service'
import { PrismaService } from '../prisma/prisma.service'

export type StatusKontak = 'IZIN' | 'BELUM' | 'SAYA_MINTA' | 'DIA_MINTA' | 'DIBLOKIR_SAYA'

/** Pasangan diurutkan agar satu baris mewakili kedua arah. */
const pasangan = (x: string, y: string) => (x < y ? { aId: x, bId: y } : { aId: y, bId: x })

@Injectable()
export class KontakService {
  constructor(private readonly prisma: PrismaService, private readonly peristiwa: PeristiwaService) {}

  private wajibIzinCache: { nilai: boolean; sampai: number } | null = null

  /** Apakah pengguna harus minta izin dulu sebelum memulai percakapan 1:1 (default: ya). Disimpan 10 detik di memori. */
  async wajibIzin(): Promise<boolean> {
    if (this.wajibIzinCache && this.wajibIzinCache.sampai > Date.now()) return this.wajibIzinCache.nilai
    const p = await this.prisma.pengaturan.findUnique({ where: { kunci: 'wajibIzin' }, select: { nilai: true } })
    const nilai = p?.nilai !== '0'
    this.wajibIzinCache = { nilai, sampai: Date.now() + 10_000 }
    return nilai
  }

  async aturWajibIzin(nilai: boolean) {
    await this.prisma.pengaturan.upsert({
      where: { kunci: 'wajibIzin' },
      create: { kunci: 'wajibIzin', nilai: nilai ? '1' : '0' },
      update: { nilai: nilai ? '1' : '0' },
    })
    this.wajibIzinCache = { nilai, sampai: Date.now() + 10_000 }
    // semua perangkat yang sedang online memuat ulang status izinnya
    const ids = (await this.prisma.anggota.findMany({ where: { status: 'AKTIF' }, select: { id: true } })).map((a) => a.id)
    this.beritahu(ids, { t: 'izinBerubah' })
    return { wajibIzin: nilai }
  }

  private beritahu(ids: string[], data: unknown) {
    this.peristiwa.emit('beritahu', ids, data)
  }

  /** Id anggota yang memblokir saya atau saya blokir (dua arah), untuk menyaring status dsb. */
  async terblokirDenganSaya(saya: string): Promise<string[]> {
    const rows = await this.prisma.blokir.findMany({
      where: { OR: [{ pemblokirId: saya }, { diblokirId: saya }] },
      select: { pemblokirId: true, diblokirId: true },
    })
    return rows.map((r) => (r.pemblokirId === saya ? r.diblokirId : r.pemblokirId))
  }

  /**
   * Menentukan apakah `dari` boleh mengirim pesan 1:1 ke `ke`.
   * `kunciGrup` = pesan pembagian kunci grup: cukup bila keduanya satu grup (bukan percakapan sungguhan).
   */
  async boleh(dari: string, ke: string, kunciGrup = false): Promise<'ya' | 'diam' | 'izin'> {
    const blokir = await this.prisma.blokir.findFirst({
      where: { OR: [{ pemblokirId: dari, diblokirId: ke }, { pemblokirId: ke, diblokirId: dari }] },
      select: { pemblokirId: true },
    })
    if (blokir) return 'diam'
    const izin = await this.prisma.izinObrolan.findUnique({ where: { aId_bId: pasangan(dari, ke) }, select: { status: true } })
    if (izin?.status === 'DITERIMA') return 'ya'
    if (!(await this.wajibIzin())) return 'ya'
    if (kunciGrup) {
      const bersama = await this.prisma.anggotaGrup.findFirst({
        where: { anggotaId: dari, grup: { anggota: { some: { anggotaId: ke } } } },
        select: { grupId: true },
      })
      if (bersama) return 'ya'
    }
    return 'izin'
  }

  async status(saya: string, id: string): Promise<{ status: StatusKontak }> {
    if (saya === id) throw new BadRequestException('Tidak valid')
    const [sayaBlokir, izin] = await Promise.all([
      this.prisma.blokir.findUnique({ where: { pemblokirId_diblokirId: { pemblokirId: saya, diblokirId: id } }, select: { pemblokirId: true } }),
      this.prisma.izinObrolan.findUnique({ where: { aId_bId: pasangan(saya, id) }, select: { status: true, pemintaId: true } }),
    ])
    if (sayaBlokir) return { status: 'DIBLOKIR_SAYA' }
    if (izin?.status === 'DITERIMA') return { status: 'IZIN' }
    if (!(await this.wajibIzin())) return { status: 'IZIN' }
    if (!izin) return { status: 'BELUM' }
    // ditolak atau diblokir lawan tidak diberitahukan: pemohon hanya melihat "menunggu"
    if (izin.pemintaId === saya) return { status: 'SAYA_MINTA' }
    return { status: izin.status === 'MENUNGGU' ? 'DIA_MINTA' : 'BELUM' }
  }

  private async pastikanAda(id: string) {
    const a = await this.prisma.anggota.findFirst({ where: { id, status: 'AKTIF' }, select: { id: true } })
    if (!a) throw new BadRequestException('Anggota tidak ditemukan')
  }

  async minta(saya: string, id: string) {
    if (saya === id) throw new BadRequestException('Tidak valid')
    await this.pastikanAda(id)
    const lawanBlokir = await this.prisma.blokir.findUnique({ where: { pemblokirId_diblokirId: { pemblokirId: id, diblokirId: saya } }, select: { pemblokirId: true } })
    const p = pasangan(saya, id)
    const ada = await this.prisma.izinObrolan.findUnique({ where: { aId_bId: p }, select: { status: true, pemintaId: true } })
    if (ada?.status === 'DITERIMA') return this.status(saya, id)
    if (ada && ada.pemintaId === saya) return this.status(saya, id) // sudah pernah meminta (atau ditolak): tidak diulang
    if (ada?.status === 'MENUNGGU' && !lawanBlokir) {
      // lawan sudah meminta lebih dulu → saling setuju
      await this.prisma.izinObrolan.update({ where: { aId_bId: p }, data: { status: 'DITERIMA' } })
      this.beritahu([id], { t: 'izinBerubah' })
      return { status: 'IZIN' as StatusKontak }
    }
    await this.prisma.izinObrolan.upsert({
      where: { aId_bId: p },
      create: { ...p, pemintaId: saya, status: 'MENUNGGU' },
      update: { pemintaId: saya, status: 'MENUNGGU' },
    })
    if (!lawanBlokir) this.beritahu([id], { t: 'izinBerubah' })
    return { status: 'SAYA_MINTA' as StatusKontak }
  }

  async terima(saya: string, id: string) {
    const p = pasangan(saya, id)
    const ada = await this.prisma.izinObrolan.findUnique({ where: { aId_bId: p }, select: { pemintaId: true } })
    if (!ada || ada.pemintaId === saya) throw new BadRequestException('Tidak ada permintaan dari orang ini')
    await this.prisma.blokir.deleteMany({ where: { pemblokirId: saya, diblokirId: id } })
    await this.prisma.izinObrolan.update({ where: { aId_bId: p }, data: { status: 'DITERIMA' } })
    this.beritahu([id], { t: 'izinBerubah' })
    return { status: 'IZIN' as StatusKontak }
  }

  async tolak(saya: string, id: string) {
    const p = pasangan(saya, id)
    await this.prisma.izinObrolan.updateMany({ where: { ...p, pemintaId: id, status: 'MENUNGGU' }, data: { status: 'DITOLAK' } })
    return { ok: true }
  }

  async blokir(saya: string, id: string) {
    if (saya === id) throw new BadRequestException('Tidak valid')
    await this.pastikanAda(id)
    const sasaran = await this.prisma.anggota.findUnique({ where: { id }, select: { peran: true } })
    if (sasaran?.peran === 'ADMIN_UTAMA') throw new ForbiddenException('Admin utama tidak dapat diblokir')
    await this.prisma.blokir.upsert({
      where: { pemblokirId_diblokirId: { pemblokirId: saya, diblokirId: id } },
      create: { pemblokirId: saya, diblokirId: id },
      update: {},
    })
    // permintaan dari orang itu tidak perlu muncul lagi
    await this.prisma.izinObrolan.updateMany({ where: { ...pasangan(saya, id), pemintaId: id, status: 'MENUNGGU' }, data: { status: 'DITOLAK' } })
    return { status: 'DIBLOKIR_SAYA' as StatusKontak }
  }

  async bukaBlokir(saya: string, id: string) {
    await this.prisma.blokir.deleteMany({ where: { pemblokirId: saya, diblokirId: id } })
    return this.status(saya, id)
  }

  /**
   * Percakapan lama: perangkat saya mengaku sudah pernah berbincang dengan `ids`. Bila pihak lawan juga sudah mengaku,
   * pasangan itu diterima otomatis (kecuali ada blokir).
   */
  async klaimRiwayat(saya: string, ids: string[]) {
    const unik = [...new Set(ids)].filter((i) => i && i !== saya).slice(0, 300)
    const diblokir = new Set(await this.terblokirDenganSaya(saya))
    let diterima = 0
    for (const id of unik) {
      const p = pasangan(saya, id)
      const sayaA = p.aId === saya
      const baris = await this.prisma.riwayatObrolan.upsert({
        where: { aId_bId: p },
        create: { ...p, aKlaim: sayaA, bKlaim: !sayaA },
        update: sayaA ? { aKlaim: true } : { bKlaim: true },
        select: { aKlaim: true, bKlaim: true },
      })
      if (!(baris.aKlaim && baris.bKlaim) || diblokir.has(id)) continue
      const ada = await this.prisma.izinObrolan.findUnique({ where: { aId_bId: p }, select: { status: true } })
      if (ada?.status === 'DITERIMA') continue
      await this.prisma.izinObrolan.upsert({
        where: { aId_bId: p },
        create: { ...p, pemintaId: saya, status: 'DITERIMA' },
        update: { status: 'DITERIMA' },
      })
      this.beritahu([id], { t: 'izinBerubah' })
      diterima++
    }
    return { diterima }
  }

  /** Permintaan yang menunggu jawaban saya + daftar orang yang saya blokir. */
  async ringkasan(saya: string) {
    const [masuk, blokir] = await Promise.all([
      this.prisma.izinObrolan.findMany({
        where: { OR: [{ aId: saya }, { bId: saya }], status: 'MENUNGGU', pemintaId: { not: saya } },
        select: { pemintaId: true, dibuatPada: true },
        orderBy: { dibuatPada: 'desc' },
        take: 100,
      }),
      this.prisma.blokir.findMany({ where: { pemblokirId: saya }, select: { diblokirId: true } }),
    ])
    const diblokir = new Set(blokir.map((b) => b.diblokirId))
    const ids = masuk.map((m) => m.pemintaId).filter((id) => !diblokir.has(id))
    const orang = await this.prisma.anggota.findMany({ where: { id: { in: ids }, status: 'AKTIF' }, select: { id: true, nama: true, fotoV: true } })
    const peta = new Map(orang.map((o) => [o.id, o]))
    return {
      masuk: masuk.flatMap((m) => {
        const o = peta.get(m.pemintaId)
        return o ? [{ id: o.id, nama: o.nama, fotoV: o.fotoV, waktu: m.dibuatPada.toISOString() }] : []
      }),
      diblokir: [...diblokir],
    }
  }
}
