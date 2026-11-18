import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { AdminGuard, JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { GrupService } from '../grup/grup.service'
import { PesanGateway } from '../pesan/pesan.gateway'
import { normalisasiNomor } from '../common/nomor'
import { GrupOtomatisService } from '../grup/grup-otomatis.service'
import { SinkronService } from '../sinkron/sinkron.service'

type StatusAnggota = 'DIUNDANG' | 'MENUNGGU' | 'AKTIF' | 'DITANGGUHKAN'
const STATUS: StatusAnggota[] = ['DIUNDANG', 'MENUNGGU', 'AKTIF', 'DITANGGUHKAN']

class TambahAnggotaDto {
  @IsString({ message: 'Nomor HP wajib diisi' }) nomorHp: string
  @IsString({ message: 'Nama wajib diisi' }) @MinLength(2, { message: 'Nama terlalu pendek' }) @MaxLength(120, { message: 'Nama terlalu panjang' })
  nama: string
}
class UbahAnggotaDto {
  @IsOptional() @IsString() @MinLength(2, { message: 'Nama terlalu pendek' }) @MaxLength(120, { message: 'Nama terlalu panjang' })
  nama?: string
  @IsOptional() @IsString({ message: 'Nomor HP tidak valid' })
  nomorHp?: string
}
class DaftarIdDto {
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true })
  ids: string[]
}
class PeranDto {
  @IsIn(['USER', 'ADMIN'], { message: 'Peran tidak valid' })
  peran: 'USER' | 'ADMIN'
}
class QueryDto {
  @IsOptional() @IsIn(STATUS) status?: StatusAnggota
  @IsOptional() @IsString() q?: string
  @IsOptional() @IsString() halaman?: string
}

const SELEKSI = { id: true, nama: true, nomorHp: true, status: true, peran: true, dibuatPada: true } as const
const PER_HALAMAN = 50

/** Pengelolaan keanggotaan: hanya admin aplikasi. Mengangkat admin dan menambah anggota baru khusus ADMIN_UTAMA. */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grup: GrupService,
    private readonly relay: PesanGateway,
    private readonly otomatis: GrupOtomatisService,
    private readonly sinkron: SinkronService,
  ) {}

  /** Anggota yang baru aktif langsung dimasukkan ke grup otomatis yang berhak diikutinya. */
  private selaraskanGrup() {
    this.otomatis.rekonsiliasi().catch(() => undefined)
  }

  private hanyaUtama(p: Pengguna) {
    if (p.peran !== 'ADMIN_UTAMA') throw new ForbiddenException('Hanya admin utama yang boleh melakukan ini')
  }

  /** Hasil sinkronisasi superapp terakhir (terjadwal tiap hari pukul 04:00 WIB). */
  @Get('sinkron')
  statusSinkron() {
    return { sedangBerjalan: this.sinkron.berjalan, terakhir: this.sinkron.terakhir }
  }

  /** Menjalankan sinkronisasi sekarang juga (di latar belakang). Hanya admin utama. */
  @Post('sinkron')
  @HttpCode(202)
  jalankanSinkron(@PenggunaIni() p: Pengguna) {
    this.hanyaUtama(p)
    if (this.sinkron.berjalan) throw new BadRequestException('Sinkronisasi sedang berjalan')
    void this.sinkron.jalankan()
    return { dimulai: true }
  }

  @Get('ringkasan')
  async ringkasan() {
    const g = await this.prisma.anggota.groupBy({ by: ['status'], _count: { _all: true } })
    const hasil: Record<string, number> = { DIUNDANG: 0, MENUNGGU: 0, AKTIF: 0, DITANGGUHKAN: 0 }
    g.forEach((x) => (hasil[x.status] = x._count._all))
    return hasil
  }

  @Get('anggota')
  async daftar(@Query() q: QueryDto) {
    const halaman = Math.max(1, parseInt(q.halaman ?? '1', 10) || 1)
    const cari = q.q?.trim()
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(cari ? { OR: [{ nama: { contains: cari, mode: 'insensitive' as const } }, { nomorHp: { contains: cari.replace(/\D/g, '') || cari } }] } : {}),
    }
    const [total, data] = await Promise.all([
      this.prisma.anggota.count({ where }),
      this.prisma.anggota.findMany({ where, select: SELEKSI, orderBy: { nama: 'asc' }, skip: (halaman - 1) * PER_HALAMAN, take: PER_HALAMAN }),
    ])
    return { total, halaman, perHalaman: PER_HALAMAN, data }
  }

  /** Menambah orang yang belum ada di daftar pelayan. Karena admin utama yang menambah, langsung berstatus AKTIF. */
  @Post('anggota')
  async tambah(@PenggunaIni() p: Pengguna, @Body() d: TambahAnggotaDto) {
    this.hanyaUtama(p)
    const nomorHp = normalisasiNomor(d.nomorHp)
    if (!nomorHp) throw new BadRequestException('Format nomor HP tidak valid')
    if (await this.prisma.anggota.findUnique({ where: { nomorHp }, select: { id: true } })) {
      throw new BadRequestException('Nomor HP ini sudah terdaftar')
    }
    return this.prisma.anggota.create({ data: { nomorHp, nama: d.nama.trim(), status: 'AKTIF' }, select: SELEKSI })
  }

  /**
   * Detail satu anggota untuk admin: data ApaKabaR + (bila terhubung) jabatan, tempat bertugas, dan foto dari superapp,
   * supaya admin tidak salah mengenali orangnya. Gangguan di superapp tidak menggagalkan detail ini.
   */
  @Get('anggota/:id')
  async detail(@Param('id') id: string) {
    const a = await this.prisma.anggota.findUnique({ where: { id }, select: { ...SELEKSI, sumberPelayanId: true, sumberCalonId: true, fotoV: true } })
    if (!a) throw new NotFoundException('Anggota tidak ditemukan')
    const { sumberPelayanId, sumberCalonId, ...anggota } = a
    const dasar = { anggota, sumberPelayanId }
    const jalur = sumberPelayanId ? `pelayan/${encodeURIComponent(sumberPelayanId)}` : sumberCalonId ? `calon/${encodeURIComponent(sumberCalonId)}` : null
    if (!jalur) return { ...dasar, superapp: null, superappGalat: 'Anggota ini tidak terhubung ke data pelayan di superapp.' }
    const kunci = process.env.SUPERAPP_SERVICE_KEY
    if (!kunci) return { ...dasar, superapp: null, superappGalat: 'Sambungan ke superapp belum dikonfigurasi di server.' }
    const url = (process.env.SUPERAPP_URL ?? 'https://api.hkbp.or.id/api/v1').replace(/\/$/, '')
    try {
      const res = await fetch(`${url}/integrasi/apakabar/${jalur}`, {
        headers: { 'X-Service-Key': kunci },
        signal: AbortSignal.timeout(8000),
      })
      if (res.status === 404) return { ...dasar, superapp: null, superappGalat: 'Data ini tidak ditemukan di superapp.' }
      if (!res.ok) return { ...dasar, superapp: null, superappGalat: 'Data superapp sedang tidak dapat diambil.' }
      const s = (await res.json()) as { hp?: string[] } & Record<string, unknown>
      const nomorSuperapp = (s.hp ?? []).map((n) => normalisasiNomor(n)).filter((n): n is string => !!n)
      return { ...dasar, superapp: { ...s, nomorCocok: nomorSuperapp.length ? nomorSuperapp.includes(a.nomorHp) : null }, superappGalat: null }
    } catch {
      return { ...dasar, superapp: null, superappGalat: 'Data superapp sedang tidak dapat diambil.' }
    }
  }

  /** Mengubah nama dan/atau nomor HP. Admin biasa hanya boleh pada anggota biasa; admin ditangani admin utama. */
  @Patch('anggota/:id')
  async ubah(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Body() d: UbahAnggotaDto) {
    const a = await this.cari(id)
    if (a.peran === 'ADMIN_UTAMA' && a.id !== p.id) throw new ForbiddenException('Data admin utama hanya bisa diubah oleh yang bersangkutan')
    if (a.peran === 'ADMIN' && a.id !== p.id && p.peran !== 'ADMIN_UTAMA') throw new ForbiddenException('Hanya admin utama yang boleh mengubah data admin')
    const data: { nama?: string; nomorHp?: string } = {}
    if (d.nama !== undefined) {
      const nama = d.nama.trim()
      if (nama.length < 2) throw new BadRequestException('Nama terlalu pendek')
      data.nama = nama
    }
    if (d.nomorHp !== undefined) {
      const nomorHp = normalisasiNomor(d.nomorHp)
      if (!nomorHp) throw new BadRequestException('Format nomor HP tidak valid')
      const dipakai = await this.prisma.anggota.findUnique({ where: { nomorHp }, select: { id: true } })
      if (dipakai && dipakai.id !== id) throw new BadRequestException('Nomor HP ini sudah dipakai anggota lain')
      data.nomorHp = nomorHp
    }
    if (!Object.keys(data).length) throw new BadRequestException('Tidak ada data yang diubah')
    const baru = await this.prisma.anggota.update({ where: { id }, data, select: SELEKSI })
    this.relay.beritahu([id], { t: 'statusBerubah' })
    return baru
  }

  @Post('anggota/setujui')
  @HttpCode(200)
  async setujuiBanyak(@Body() d: DaftarIdDto) {
    const r = await this.prisma.anggota.updateMany({
      where: { id: { in: d.ids }, status: { in: ['DIUNDANG', 'MENUNGGU'] } },
      data: { status: 'AKTIF' },
    })
    this.relay.beritahu(d.ids, { t: 'statusBerubah' })
    this.selaraskanGrup()
    return { disetujui: r.count }
  }

  @Post('anggota/:id/setujui')
  @HttpCode(200)
  async setujui(@Param('id') id: string) {
    const a = await this.cari(id)
    if (a.status === 'DITANGGUHKAN') throw new BadRequestException('Anggota ini diblokir. Buka blokir terlebih dahulu')
    await this.prisma.anggota.update({ where: { id }, data: { status: 'AKTIF' } })
    this.relay.beritahu([id], { t: 'statusBerubah' })
    this.selaraskanGrup()
    return { ok: true }
  }

  @Post('anggota/:id/blokir')
  @HttpCode(200)
  async blokir(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    const a = await this.cari(id)
    this.pastikanBolehDiperlakukan(p, a)
    await this.putusAkses(id, 'DITANGGUHKAN')
    this.selaraskanGrup()
    return { ok: true }
  }

  /** Membuka blokir mengembalikan anggota ke AKTIF; yang bersangkutan perlu masuk lagi dengan kode WhatsApp. */
  @Post('anggota/:id/buka-blokir')
  @HttpCode(200)
  async bukaBlokir(@Param('id') id: string) {
    const a = await this.cari(id)
    if (a.status !== 'DITANGGUHKAN') throw new BadRequestException('Anggota ini tidak sedang diblokir')
    await this.prisma.anggota.update({ where: { id }, data: { status: 'AKTIF' } })
    this.selaraskanGrup()
    return { ok: true }
  }

  /** Mengeluarkan = menghapus permanen akun beserta perangkat, antrean pesan, dan keanggotaan grupnya. */
  @Delete('anggota/:id')
  async keluarkan(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    this.hanyaUtama(p)
    const a = await this.cari(id)
    this.pastikanBolehDiperlakukan(p, a)
    await this.putusAkses(id, null)
    await this.prisma.anggota.delete({ where: { id } })
    return { ok: true }
  }

  @Put('anggota/:id/peran')
  async ubahPeran(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Body() d: PeranDto) {
    this.hanyaUtama(p)
    const a = await this.cari(id)
    if (a.peran === 'ADMIN_UTAMA') throw new ForbiddenException('Peran admin utama tidak bisa diubah')
    if (a.status !== 'AKTIF') throw new BadRequestException('Hanya anggota aktif yang bisa dijadikan admin')
    await this.prisma.anggota.update({ where: { id }, data: { peran: d.peran } })
    this.relay.beritahu([id], { t: 'statusBerubah' })
    return { ok: true }
  }

  private async cari(id: string) {
    const a = await this.prisma.anggota.findUnique({ where: { id }, select: { id: true, status: true, peran: true } })
    if (!a) throw new NotFoundException('Anggota tidak ditemukan')
    return a
  }

  private pastikanBolehDiperlakukan(p: Pengguna, a: { id: string; peran: string }) {
    if (a.id === p.id) throw new BadRequestException('Tidak bisa dilakukan pada akun sendiri')
    if (a.peran === 'ADMIN_UTAMA') throw new ForbiddenException('Admin utama tidak bisa diblokir atau dikeluarkan')
    if (a.peran === 'ADMIN' && p.peran !== 'ADMIN_UTAMA') throw new ForbiddenException('Hanya admin utama yang boleh menindak admin')
  }

  /** Sesi diputus (versi token naik), koneksi live ditutup, dan anggota dikeluarkan dari semua grup. */
  private async putusAkses(id: string, statusBaru: 'DITANGGUHKAN' | null) {
    if (statusBaru) await this.prisma.anggota.update({ where: { id }, data: { status: statusBaru } })
    await this.prisma.perangkat.updateMany({ where: { anggotaId: id }, data: { versiToken: { increment: 1 }, pushToken: null } })
    await this.prisma.pesanAntrean.deleteMany({ where: { penerimaId: id } })
    await this.grup.keluarkanDariSemuaGrup(id)
    this.relay.putuskan(id)
  }
}
