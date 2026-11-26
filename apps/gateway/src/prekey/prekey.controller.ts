import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { PrekeySekaliPakaiDto } from '../common/dto-perangkat'

class IsiUlangDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PrekeySekaliPakaiDto)
  oneTime: PrekeySekaliPakaiDto[]
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PrekeyController {
  constructor(private readonly prisma: PrismaService) {}

  /** Daftar anggota aktif (direktori tertutup — hanya bisa dilihat sesama anggota aktif). */
  @Get('anggota')
  async direktori(@PenggunaIni() saya: Pengguna) {
    const daftar = await this.prisma.anggota.findMany({
      where: { status: 'AKTIF', perangkat: { isNot: null }, id: { not: saya.id } },
      orderBy: { nama: 'asc' },
      select: { id: true, nama: true, fotoV: true, fotoSuperapp: true, peran: true },
    })
    return daftar.map(({ fotoSuperapp, peran, ...a }) => ({ ...a, fotoUrl: fotoSuperapp, adminUtama: peran === 'ADMIN_UTAMA' }))
  }

  /** Profil lengkap satu anggota + grup yang diikuti bersama pemanggil (direktori tertutup, sesama anggota aktif). */
  @Get('anggota/:id/profil')
  async profil(@PenggunaIni() saya: Pengguna, @Param('id') id: string) {
    const a = await this.prisma.anggota.findFirst({
      where: { id, status: 'AKTIF' },
      select: {
        id: true, nama: true, nomorHp: true, peran: true, dibuatPada: true, fotoV: true,
        keanggotaanGrup: { select: { peran: true, grup: { select: { id: true, nama: true, fotoV: true, _count: { select: { anggota: true } } } } } },
      },
    })
    if (!a) throw new NotFoundException('Anggota tidak ditemukan')
    let grupBersama = a.keanggotaanGrup
    if (id !== saya.id) {
      const milikSaya = await this.prisma.anggotaGrup.findMany({ where: { anggotaId: saya.id }, select: { grupId: true } })
      const ids = new Set(milikSaya.map((g) => g.grupId))
      grupBersama = grupBersama.filter((g) => ids.has(g.grup.id))
    }
    return {
      id: a.id, nama: a.nama,
      // Nomor HP hanya untuk admin aplikasi (dan pemilik akun sendiri); anggota biasa tidak melihat nomor orang lain.
      nomorHp: saya.peran !== 'USER' || id === saya.id ? a.nomorHp : null,
      peran: a.peran, dibuatPada: a.dibuatPada, fotoV: a.fotoV,
      grupBersama: grupBersama
        .map((g) => ({ id: g.grup.id, nama: g.grup.nama, fotoV: g.grup.fotoV, jumlah: g.grup._count.anggota, peranDiGrup: g.peran }))
        .sort((x, y) => x.nama.localeCompare(y.nama)),
    }
  }

  @Get('prekey/sisa')
  async sisa(@PenggunaIni() saya: Pengguna) {
    const jumlah = await this.prisma.oneTimePrekey.count({ where: { perangkat: { anggotaId: saya.id } } })
    return { jumlah }
  }

  @Put('prekey/isi-ulang')
  async isiUlang(@PenggunaIni() saya: Pengguna, @Body() dto: IsiUlangDto) {
    const p = await this.prisma.perangkat.findUnique({ where: { anggotaId: saya.id }, select: { id: true } })
    if (!p) throw new NotFoundException('Perangkat belum terdaftar')
    const r = await this.prisma.oneTimePrekey.createMany({
      data: dto.oneTime.map((o) => ({ perangkatId: p.id, keyId: o.id, kunci: o.pub })),
      skipDuplicates: true,
    })
    return { ditambahkan: r.count }
  }

  /** Paket prekey lawan bicara. Satu prekey sekali-pakai dihabiskan setiap pengambilan. */
  @Post('prekey/ambil/:anggotaId')
  @HttpCode(200)
  async ambil(@Param('anggotaId') anggotaId: string) {
    const hasil = await this.prisma.$transaction(async (tx) => {
      const p = await tx.perangkat.findFirst({
        where: { anggotaId, anggota: { status: 'AKTIF' } },
        select: {
          id: true, registrationId: true, identityKey: true,
          signedPreKeyId: true, signedPreKey: true, signedPreKeySig: true,
          kyberPreKeyId: true, kyberPreKey: true, kyberPreKeySig: true,
          anggota: { select: { nama: true } },
        },
      })
      if (!p) return null
      const ot = await tx.oneTimePrekey.findFirst({
        where: { perangkatId: p.id },
        orderBy: { dibuatPada: 'asc' },
        select: { id: true, keyId: true, kunci: true },
      })
      if (ot) await tx.oneTimePrekey.delete({ where: { id: ot.id } })
      return { p, ot }
    })
    if (!hasil) throw new NotFoundException('Anggota tidak ditemukan atau belum aktif')
    const { p, ot } = hasil
    return {
      nama: anggotaId,
      namaTampil: p.anggota.nama,
      deviceId: 1,
      regId: p.registrationId,
      identitas: p.identityKey,
      signedPreKey: { id: p.signedPreKeyId, pub: p.signedPreKey, sig: p.signedPreKeySig },
      kyber: { id: p.kyberPreKeyId, pub: p.kyberPreKey, sig: p.kyberPreKeySig },
      oneTime: ot ? { id: ot.keyId, pub: ot.kunci } : null,
    }
  }
}
