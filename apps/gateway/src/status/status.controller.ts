import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { StatusService } from './status.service'

const pangkas = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

class StatusDto {
  @Transform(pangkas)
  @IsString({ message: 'Status wajib diisi' })
  @MinLength(1, { message: 'Status wajib diisi' })
  @MaxLength(280, { message: 'Status maksimal 280 karakter' })
  teks: string

  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'Suasana tidak valid' })
  suasana?: string
}

class KomentarDto {
  @Transform(pangkas)
  @IsString({ message: 'Komentar wajib diisi' })
  @MinLength(1, { message: 'Komentar wajib diisi' })
  @MaxLength(300, { message: 'Komentar maksimal 300 karakter' })
  teks: string
}

@Controller('status')
@UseGuards(JwtAuthGuard)
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  daftar(@PenggunaIni() p: Pengguna) {
    return this.status.daftar(p)
  }

  @Post()
  @HttpCode(200)
  simpan(@PenggunaIni() p: Pengguna, @Body() d: StatusDto) {
    return this.status.simpan(p, d.teks, d.suasana)
  }

  @Delete()
  hapusSaya(@PenggunaIni() p: Pengguna) {
    return this.status.hapusSaya(p)
  }

  @Delete(':id')
  hapus(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.status.hapus(id, p)
  }

  @Get(':id/komentar')
  komentar(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.status.komentar(id, p)
  }

  @Post(':id/komentar')
  @HttpCode(200)
  komentari(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Body() d: KomentarDto) {
    return this.status.komentari(id, p, d.teks)
  }

  @Delete(':id/komentar/:komentarId')
  hapusKomentar(@PenggunaIni() p: Pengguna, @Param('id') id: string, @Param('komentarId') komentarId: string) {
    return this.status.hapusKomentar(id, komentarId, p)
  }
}
