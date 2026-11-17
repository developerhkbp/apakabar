import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { readdir, rm } from 'fs/promises'
import { join } from 'path'
import { PrismaService } from '../prisma/prisma.service'

/** Batas keras blob (sudah termasuk overhead enkripsi); batas per jenis berkas dijaga di aplikasi. */
export const MAKS_BERKAS = 66 * 1024 * 1024
const HARI = 24 * 3600 * 1000

@Injectable()
export class BerkasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Berkas')
  private timer?: NodeJS.Timeout
  readonly folder = process.env.BERKAS_DIR ?? join(process.cwd(), 'data', 'berkas')
  readonly masaSimpanMs = parseInt(process.env.BERKAS_HARI ?? '30', 10) * HARI

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.bersihkan().catch(e => this.log.error(e)), 3600 * 1000)
    this.timer.unref()
    this.bersihkan().catch(() => {})
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer) }

  /** Menghapus blob kedaluwarsa dari disk dan basis data. */
  async bersihkan() {
    const lewat = await this.prisma.berkas.findMany({ where: { kedaluwarsa: { lt: new Date() } }, select: { id: true }, take: 500 })
    for (const b of lewat) await rm(join(this.folder, b.id), { force: true })
    if (lewat.length) await this.prisma.berkas.deleteMany({ where: { id: { in: lewat.map(b => b.id) } } })
    // berkas yatim (mis. unggahan terputus sebelum tercatat) lebih tua dari 1 hari
    try {
      const ada = new Set((await this.prisma.berkas.findMany({ select: { id: true } })).map(b => b.id))
      for (const f of await readdir(this.folder)) if (!ada.has(f)) {
        const { mtimeMs } = await (await import('fs/promises')).stat(join(this.folder, f))
        if (Date.now() - mtimeMs > HARI) await rm(join(this.folder, f), { force: true })
      }
    } catch { /* folder belum ada */ }
  }
}
