import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { KontakService } from './kontak.service'

@Controller('kontak')
@UseGuards(JwtAuthGuard)
export class KontakController {
  constructor(private readonly kontak: KontakService) {}

  @Get('ringkasan')
  ringkasan(@PenggunaIni() p: Pengguna) {
    return this.kontak.ringkasan(p.id)
  }

  @Post('riwayat')
  @HttpCode(200)
  riwayat(@PenggunaIni() p: Pengguna, @Body() b: { ids?: string[] }) {
    return this.kontak.klaimRiwayat(p.id, Array.isArray(b?.ids) ? b.ids.filter((x) => typeof x === 'string') : [])
  }

  @Get(':id/status')
  status(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.kontak.status(p.id, id)
  }

  @Post(':id/minta')
  @HttpCode(200)
  minta(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.kontak.minta(p.id, id)
  }

  @Post(':id/terima')
  @HttpCode(200)
  terima(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.kontak.terima(p.id, id)
  }

  @Post(':id/tolak')
  @HttpCode(200)
  tolak(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.kontak.tolak(p.id, id)
  }

  @Post(':id/blokir')
  @HttpCode(200)
  blokir(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.kontak.blokir(p.id, id)
  }

  @Delete(':id/blokir')
  bukaBlokir(@PenggunaIni() p: Pengguna, @Param('id') id: string) {
    return this.kontak.bukaBlokir(p.id, id)
  }
}
