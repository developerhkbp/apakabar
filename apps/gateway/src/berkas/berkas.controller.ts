import { BadRequestException, Controller, Get, HttpCode, NotFoundException, Param, PayloadTooLargeException, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { BerkasService, MAKS_BERKAS } from './berkas.service'

@Controller('berkas')
@UseGuards(JwtAuthGuard)
export class BerkasController {
  constructor(private readonly prisma: PrismaService, private readonly berkas: BerkasService) {}

  /** Unggah blob terenkripsi (badan permintaan mentah). Server tidak pernah melihat isi aslinya. */
  @Post()
  @HttpCode(201)
  async unggah(@PenggunaIni() p: Pengguna, @Req() req: Request) {
    const panjang = parseInt(req.headers['content-length'] ?? '0', 10)
    if (!panjang) throw new BadRequestException('Berkas kosong')
    if (panjang > MAKS_BERKAS) throw new PayloadTooLargeException('Berkas terlalu besar')
    const id = randomUUID()
    let total: number
    try {
      total = await this.berkas.simpan(id, req, MAKS_BERKAS)
    } catch (e) {
      if ((e as Error).message === 'melebihi-batas') throw new PayloadTooLargeException('Berkas terlalu besar')
      throw e
    }
    await this.prisma.berkas.create({ data: { id, pengunggah: p.id, ukuran: total, kedaluwarsa: new Date(Date.now() + this.berkas.masaSimpanMs) } })
    return { id, ukuran: total }
  }

  @Get(':id')
  async unduh(@Param('id') id: string, @Res() res: Response) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new NotFoundException('Berkas tidak ditemukan')
    const baris = await this.prisma.berkas.findUnique({ where: { id }, select: { id: true, kedaluwarsa: true } })
    if (!baris || baris.kedaluwarsa < new Date()) throw new NotFoundException('Berkas sudah tidak tersedia')
    const blob = await this.berkas.buka(id)
    if (!blob) throw new NotFoundException('Berkas sudah tidak tersedia')
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', blob.ukuran)
    res.setHeader('Cache-Control', 'private, no-store')
    blob.aliran.on('error', () => res.destroy())
    blob.aliran.pipe(res)
  }
}
