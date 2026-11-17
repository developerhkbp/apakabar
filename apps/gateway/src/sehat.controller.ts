import { Controller, Get } from '@nestjs/common'

/** Pemeriksaan kesehatan untuk load balancer (tanpa autentikasi, tanpa data). */
@Controller('sehat')
export class SehatController {
  @Get()
  cek() {
    return { ok: true }
  }
}
