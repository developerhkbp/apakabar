import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { fotoDariBase64 } from '../foto/foto'
import { GrupService, MAKS_ANGGOTA_GRUP } from './grup.service'

class BuatGrupDto {
  @IsString({ message: 'Nama grup wajib diisi' }) @MinLength(1, { message: 'Nama grup wajib diisi' }) @MaxLength(80, { message: 'Nama grup maksimal 80 karakter' })
  nama: string
  @IsArray() @ArrayMaxSize(MAKS_ANGGOTA_GRUP) @IsString({ each: true })
  anggotaIds: string[]
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true })
  adminIds?: string[]
}
class NamaDto {
  @IsString({ message: 'Nama grup wajib diisi' }) @MinLength(1, { message: 'Nama grup wajib diisi' }) @MaxLength(80, { message: 'Nama grup maksimal 80 karakter' })
  nama: string
}
class FotoDto {
  @IsOptional() @IsString() @MaxLength(100000)
  data?: string | null
}
class DaftarIdDto {
  @IsArray() @ArrayMaxSize(MAKS_ANGGOTA_GRUP) @IsString({ each: true })
  anggotaIds: string[]
}
class PeranGrupDto {
  @IsIn(['ANGGOTA', 'ADMIN_GRUP'], { message: 'Peran tidak valid' })
  peran: 'ANGGOTA' | 'ADMIN_GRUP'
}

@Controller('grup')
@UseGuards(JwtAuthGuard)
export class GrupController {
  constructor(private readonly grup: GrupService) {}

  @Post()
  buat(@PenggunaIni() p: Pengguna, @Body() d: BuatGrupDto) {
    return this.grup.buat(p, d.nama, d.anggotaIds, d.adminIds ?? [])
  }

  @Get()
  daftar(@PenggunaIni() p: Pengguna) {
    return this.grup.daftarSaya(p)
  }

  @Get(':id')
  detail(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.grup.detail(id, p)
  }

  @Patch(':id')
  ubahNama(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Body() d: NamaDto) {
    return this.grup.ubahNama(id, p, d.nama)
  }

  @Put(':id/foto')
  ubahFoto(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Body() d: FotoDto) {
    return this.grup.ubahFoto(id, p, fotoDariBase64(d.data))
  }

  @Delete(':id')
  hapus(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.grup.hapus(id, p)
  }

  @Post(':id/anggota')
  @HttpCode(200)
  tambah(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Body() d: DaftarIdDto) {
    return this.grup.tambahAnggota(id, p, d.anggotaIds)
  }

  @Delete(':id/anggota/:anggotaId')
  keluarkan(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Param('anggotaId') anggotaId: string) {
    return this.grup.keluarkan(id, p, anggotaId)
  }

  @Put(':id/anggota/:anggotaId/peran')
  ubahPeran(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Param('anggotaId') anggotaId: string, @Body() d: PeranGrupDto) {
    return this.grup.ubahPeran(id, p, anggotaId, d.peran)
  }
}
