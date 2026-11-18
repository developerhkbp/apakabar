import { Body, Controller, Get, NotFoundException, Param, Put, Res, UseGuards } from '@nestjs/common'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import type { Response } from 'express'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { fotoDariBase64 } from './foto'

class FotoDto {
  @IsOptional() @IsString() @MaxLength(100000)
  data?: string | null
}

@Controller('foto')
@UseGuards(JwtAuthGuard)
export class FotoController {
  constructor(private readonly prisma: PrismaService) {}

  @Put('saya')
  async ubahSaya(@PenggunaIni() p: Pengguna, @Body() d: FotoDto) {
    const foto = fotoDariBase64(d.data)
    const a = await this.prisma.anggota.update({ where: { id: p.id }, data: { foto, fotoV: { increment: 1 } }, select: { fotoV: true } })
    return { fotoV: a.fotoV }
  }

  @Get('saya/versi')
  async versiSaya(@PenggunaIni() p: Pengguna) {
    const a = await this.prisma.anggota.findUnique({ where: { id: p.id }, select: { fotoV: true, fotoSuperapp: true } })
    return { fotoV: a?.fotoV ?? 0, fotoUrl: a?.fotoSuperapp ?? null }
  }

  @Get('anggota/:id')
  async anggota(@Param('id') id: string, @Res() res: Response) {
    const a = await this.prisma.anggota.findUnique({ where: { id }, select: { foto: true } })
    this.kirim(res, a?.foto)
  }

  @Get('grup/:id')
  async grup(@Param('id') id: string, @Res() res: Response) {
    const g = await this.prisma.grup.findUnique({ where: { id }, select: { foto: true } })
    this.kirim(res, g?.foto)
  }

  private kirim(res: Response, foto?: Uint8Array | null) {
    if (!foto) throw new NotFoundException('Tidak ada foto')
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable') // alamat memuat versi (?v=)
    res.end(Buffer.from(foto))
  }
}
