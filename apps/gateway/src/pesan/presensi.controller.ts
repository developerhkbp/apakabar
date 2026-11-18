import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { PesanGateway } from './pesan.gateway'

/** Status online sesama anggota aktif (direktori tertutup). */
@Controller('anggota')
@UseGuards(JwtAuthGuard)
export class PresensiController {
  constructor(private readonly gateway: PesanGateway, private readonly prisma: PrismaService) {}

  @Get(':id/online')
  async online(@Param('id') id: string) {
    const ada = await this.prisma.anggota.findFirst({ where: { id, status: 'AKTIF' }, select: { id: true } })
    if (!ada) throw new NotFoundException('Anggota tidak ditemukan')
    return { online: await this.gateway.adaOnline(id) }
  }
}
