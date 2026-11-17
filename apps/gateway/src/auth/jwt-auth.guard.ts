import { CanActivate, ForbiddenException, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import { AuthService } from './auth.service'

export interface Pengguna {
  id: string
  nama: string
  peran: 'USER' | 'ADMIN' | 'ADMIN_UTAMA'
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest()
    const h: string | undefined = req.headers['authorization']
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException('Belum masuk')
    const payload = this.auth.verifikasiToken(h.slice(7))
    req.pengguna = await this.auth.periksaSesi(payload)
    return true
  }
}

export const PenggunaIni = createParamDecorator((_d, ctx: ExecutionContext): Pengguna => {
  return ctx.switchToHttp().getRequest().pengguna
})

/** Hanya admin aplikasi (ADMIN / ADMIN_UTAMA). Dipasang setelah JwtAuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const p: Pengguna | undefined = ctx.switchToHttp().getRequest().pengguna
    if (!p || p.peran === 'USER') throw new ForbiddenException('Hanya admin yang boleh melakukan ini')
    return true
  }
}
