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
      select: { id: true, nama: true, fotoV: true },
    })
    return daftar
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
