import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Storage } from '@google-cloud/storage'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, readdir, rm, stat } from 'fs/promises'
import { join } from 'path'
import { Transform, type Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { PrismaService } from '../prisma/prisma.service'

/** Batas keras blob (sudah termasuk overhead enkripsi); batas per jenis berkas dijaga di aplikasi. */
export const MAKS_BERKAS = 66 * 1024 * 1024
const HARI = 24 * 3600 * 1000
const AWALAN_GCS = process.env.GCS_AWALAN ?? 'apakabar/berkas/'

/**
 * Penyimpanan blob terenkripsi. Bila GCS_BUCKET_NAME diisi, blob disimpan di Google Cloud Storage
 * (bucket yang sama dengan superapp, di bawah awalan `apakabar/berkas/`, memakai Workload Identity),
 * sehingga semua replika gateway melihat berkas yang sama. Tanpa itu, blob disimpan di disk (pengembangan).
 * Isi blob sudah terenkripsi AES-256-GCM di perangkat pengirim, jadi penyimpanan tidak pernah memegang kunci.
 */
@Injectable()
export class BerkasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Berkas')
  private timer?: NodeJS.Timeout
  readonly folder = process.env.BERKAS_DIR ?? join(process.cwd(), 'data', 'berkas')
  readonly masaSimpanMs = parseInt(process.env.BERKAS_HARI ?? '30', 10) * HARI
  private readonly gcs = process.env.GCS_BUCKET_NAME
    ? new Storage({ projectId: process.env.GCP_PROJECT_ID }).bucket(process.env.GCS_BUCKET_NAME)
    : undefined

  constructor(private readonly prisma: PrismaService) {}

  get memakaiGcs() {
    return !!this.gcs
  }

  onModuleInit() {
    this.timer = setInterval(() => this.bersihkan().catch((e) => this.log.error(e)), 3600 * 1000)
    this.timer.unref()
    this.bersihkan().catch(() => {})
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  /** Menulis aliran masuk ke penyimpanan. Mengembalikan jumlah byte; gagal jika melebihi batas. */
  async simpan(id: string, masuk: Readable, batas: number): Promise<number> {
    let total = 0
    // Penghitung ukuran berupa Transform di dalam pipeline (memasang 'data' langsung akan menguras aliran lebih dulu).
    const hitung = new Transform({
      transform(c: Buffer, _e, cb) {
        total += c.length
        if (total > batas) return cb(new Error('melebihi-batas'))
        cb(null, c)
      },
    })
    try {
      if (this.gcs) {
        await pipeline(masuk, hitung, this.gcs.file(AWALAN_GCS + id).createWriteStream({ resumable: false, contentType: 'application/octet-stream' }))
      } else {
        await mkdir(this.folder, { recursive: true })
        await pipeline(masuk, hitung, createWriteStream(join(this.folder, id)))
      }
    } catch (e) {
      await this.hapus(id)
      throw e
    }
    return total
  }

  /** Membuka blob untuk diunduh; null bila tidak ada. */
  async buka(id: string): Promise<{ aliran: Readable; ukuran: number } | null> {
    try {
      if (this.gcs) {
        const f = this.gcs.file(AWALAN_GCS + id)
        const [meta] = await f.getMetadata()
        return { aliran: f.createReadStream(), ukuran: Number(meta.size ?? 0) }
      }
      const jalur = join(this.folder, id)
      const { size } = await stat(jalur)
      return { aliran: createReadStream(jalur), ukuran: size }
    } catch {
      return null
    }
  }

  async hapus(id: string) {
    try {
      if (this.gcs) await this.gcs.file(AWALAN_GCS + id).delete({ ignoreNotFound: true })
      else await rm(join(this.folder, id), { force: true })
    } catch (e) {
      this.log.warn(`Gagal menghapus berkas ${id}: ${(e as Error).message}`)
    }
  }

  /** Menghapus blob kedaluwarsa dari penyimpanan dan basis data. */
  async bersihkan() {
    const lewat = await this.prisma.berkas.findMany({ where: { kedaluwarsa: { lt: new Date() } }, select: { id: true }, take: 500 })
    for (const b of lewat) await this.hapus(b.id)
    if (lewat.length) await this.prisma.berkas.deleteMany({ where: { id: { in: lewat.map((b) => b.id) } } })
    // berkas yatim (mis. unggahan terputus sebelum tercatat) lebih tua dari 1 hari
    try {
      const ada = new Set((await this.prisma.berkas.findMany({ select: { id: true } })).map((b) => b.id))
      if (this.gcs) {
        const [files] = await this.gcs.getFiles({ prefix: AWALAN_GCS, maxResults: 2000 })
        for (const f of files) {
          const id = f.name.slice(AWALAN_GCS.length)
          const dibuat = Date.parse(String(f.metadata.timeCreated ?? ''))
          if (id && !ada.has(id) && dibuat && Date.now() - dibuat > HARI) await this.hapus(id)
        }
      } else {
        for (const f of await readdir(this.folder)) {
          if (ada.has(f)) continue
          const { mtimeMs } = await stat(join(this.folder, f))
          if (Date.now() - mtimeMs > HARI) await this.hapus(f)
        }
      }
    } catch {
      /* folder belum ada / penyimpanan tak terjangkau — coba lagi jam berikutnya */
    }
  }
}
