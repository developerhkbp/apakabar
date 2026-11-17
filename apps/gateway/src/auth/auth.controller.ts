import { Body, Controller, Get, Headers, HttpCode, Ip, Post, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { MintaOtpDto, RefreshDto, VerifikasiOtpDto } from './auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/minta')
  @HttpCode(200)
  minta(@Body() dto: MintaOtpDto, @Ip() ip: string) {
    return this.auth.mintaOtp(dto.nomorHp, ip)
  }

  @Post('otp/verifikasi')
  @HttpCode(200)
  verifikasi(@Body() dto: VerifikasiOtpDto) {
    return this.auth.verifikasiOtp(dto.nomorHp, dto.kode, dto.perangkat)
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken)
  }

  @Get('saya')
  saya(@Headers('authorization') h?: string) {
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException('Belum masuk')
    return this.auth.statusSaya(h.slice(7))
  }
}
