import { Body, Controller, HttpCode, Put, UseGuards } from '@nestjs/common'
import { IsString, MaxLength, MinLength } from 'class-validator'
import { JwtAuthGuard, Pengguna, PenggunaIni } from '../auth/jwt-auth.guard'
import { PushService } from './push.service'

class TokenPushDto {
  @IsString({ message: 'Token tidak valid' }) @MinLength(20, { message: 'Token tidak valid' }) @MaxLength(512, { message: 'Token tidak valid' })
  token: string
}

@Controller('perangkat')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Perangkat mendaftarkan token FCM-nya (dipanggil setiap aplikasi tersambung, token bisa berganti). */
  @Put('push')
  @HttpCode(200)
  async daftar(@PenggunaIni() saya: Pengguna, @Body() dto: TokenPushDto) {
    await this.push.daftarkan(saya.id, dto.token)
    return { ok: true }
  }
}
