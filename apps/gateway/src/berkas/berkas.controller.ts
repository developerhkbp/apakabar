import { BadRequestException, Controller, Get, HttpCode, NotFoundException, Param, PayloadTooLargeException, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { mkdir, rm, stat } from 'fs/promises'
import { join } from 'path'
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
    await mkdir(this.berkas.folder, { recursive: true })
    const id = randomUUID()
    const tujuan = join(this.berkas.folder, id)
    let total = 0
    await new Promise<void>((selesai, gagal) => {
      const tulis = createWriteStream(tujuan)
      req.on('data', (c: Buffer) => {
        total += c.length
        if (total > MAKS_BERKAS) { req.destroy(); tulis.destroy(); gagal(new PayloadTooLargeException('Berkas terlalu besar')) }
      })
      req.on('error', gagal)
      tulis.on('error', gagal)
      tulis.on('finish', selesai)
      req.pipe(tulis)
    }).catch(async e => { await rm(tujuan, { force: true }); throw e })
    await this.prisma.berkas.create({ data: { id, pengunggah: p.id, ukuran: total, kedaluwarsa: new Date(Date.now() + this.berkas.masaSimpanMs) } })
    return { id, ukuran: total }
  }

  @Get(':id')
  async unduh(@Param('id') id: string, @Res() res: Response) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new NotFoundException('Berkas tidak ditemukan')
    const baris = await this.prisma.berkas.findUnique({ where: { id }, select: { id: true, kedaluwarsa: true } })
    const jalur = join(this.berkas.folder, id)
    if (!baris || baris.kedaluwarsa < new Date() || !existsSync(jalur)) throw new NotFoundException('Berkas sudah tidak tersedia')
    const { size } = await stat(jalur)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', size)
    res.setHeader('Cache-Control', 'private, no-store')
    createReadStream(jalur).pipe(res)
  }
}
