import { Controller, Get } from '@nestjs/common'

/**
 * Versi aplikasi seluler yang dirilis (tanpa autentikasi, tanpa data pengguna).
 * Atur lewat env APK_VERSI_TERBARU / APK_VERSI_MINIMUM saat merilis versi baru.
 */
@Controller('versi')
export class VersiController {
  @Get()
  baca() {
    return {
      terbaru: process.env.APK_VERSI_TERBARU ?? '1.1.8',
      minimum: process.env.APK_VERSI_MINIMUM ?? '1.1.0',
    }
  }
}
