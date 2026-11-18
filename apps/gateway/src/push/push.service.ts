import { Injectable, Logger } from '@nestjs/common'
import { App, cert, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { readFileSync } from 'fs'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { PeristiwaService } from '../common/peristiwa.service'

const JEDA_PER_PENERIMA_MS = 5000

/**
 * Notifikasi push lewat FCM. Isi notifikasi SENGAJA tetap "Pesan baru": tanpa nama pengirim
 * dan tanpa isi, sehingga Google/Apple tidak pernah melihat metadata percakapan.
 * Bila FIREBASE_KEY_PATH tidak diisi, push dinonaktifkan (hanya dicatat di log).
 */
/** Saluran notifikasi di aplikasi (bersuara dering HKBP); bila belum ada di perangkat, FCM memakai saluran bawaan. */
const SALURAN_PESAN = 'apakabar_pesan_v1'

@Injectable()
export class PushService {
  private readonly log = new Logger('Push')
  private app?: App
  private readonly terakhir = new Map<string, number>()

  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, peristiwa: PeristiwaService) {
    peristiwa.on('anggota-menunggu', () => { this.kabariAdminMenunggu().catch((e) => this.log.warn(`Push admin gagal: ${(e as Error).message}`)) })
    const jalur = process.env.FIREBASE_KEY_PATH
    if (!jalur) {
      this.log.warn('FIREBASE_KEY_PATH kosong — push dinonaktifkan')
      return
    }
    try {
      this.app = initializeApp({ credential: cert(JSON.parse(readFileSync(jalur, 'utf8'))) })
      this.log.log('FCM aktif')
    } catch (e) {
      this.log.error(`Gagal memuat kunci Firebase: ${(e as Error).message}`)
    }
  }

  async daftarkan(anggotaId: string, token: string) {
    await this.prisma.perangkat.update({ where: { anggotaId }, data: { pushToken: token } })
  }

  /**
   * Kabari semua admin aktif bahwa ada anggota menunggu persetujuan. Tanpa nama (tetap tanpa metadata ke FCM).
   * Dibatasi satu kali per 5 menit di seluruh replika agar gelombang pendaftar tidak membanjiri admin.
   */
  async kabariAdminMenunggu() {
    if (!this.app) return
    if ((await this.redis.tambahHitung('push-admin-menunggu', 300)) > 1) return
    const admin = await this.prisma.perangkat.findMany({
      where: { pushToken: { not: null }, anggota: { status: 'AKTIF', peran: { in: ['ADMIN', 'ADMIN_UTAMA'] } } },
      select: { anggotaId: true, pushToken: true },
    })
    for (const p of admin) {
      try {
        await getMessaging(this.app).send({
          token: p.pushToken!,
          notification: { title: 'ApaKabaR', body: 'Ada anggota menunggu persetujuan' },
          data: { tujuan: 'persetujuan' },
          android: { priority: 'high', notification: { tag: 'menunggu-persetujuan', channelId: SALURAN_PESAN, sound: 'notifikasi_hkbp' } },
        })
      } catch (e) {
        const kode = (e as { code?: string }).code ?? ''
        if (kode === 'messaging/registration-token-not-registered' || kode === 'messaging/invalid-registration-token') {
          await this.prisma.perangkat.updateMany({ where: { anggotaId: p.anggotaId, pushToken: p.pushToken }, data: { pushToken: null } })
        } else {
          this.log.warn(`Push admin gagal: ${kode || (e as Error).message}`)
        }
      }
    }
  }

  /** Dipanggil saat pesan masuk antrean dan penerima sedang tidak terhubung. */
  async kabari(penerimaId: string) {
    if (!this.app) return
    const sekarang = Date.now()
    if (sekarang - (this.terakhir.get(penerimaId) ?? 0) < JEDA_PER_PENERIMA_MS) return
    this.terakhir.set(penerimaId, sekarang)

    const p = await this.prisma.perangkat.findUnique({ where: { anggotaId: penerimaId }, select: { pushToken: true } })
    if (!p?.pushToken) return
    try {
      await getMessaging(this.app).send({
        token: p.pushToken,
        notification: { title: 'ApaKabaR', body: 'Pesan baru' },
        android: { priority: 'high', notification: { tag: 'pesan-baru', channelId: SALURAN_PESAN, sound: 'notifikasi_hkbp' } },
      })
    } catch (e) {
      const kode = (e as { code?: string }).code ?? ''
      if (kode === 'messaging/registration-token-not-registered' || kode === 'messaging/invalid-registration-token') {
        // token sudah tidak berlaku (aplikasi dihapus/dipasang ulang)
        await this.prisma.perangkat.updateMany({ where: { anggotaId: penerimaId, pushToken: p.pushToken }, data: { pushToken: null } })
      } else {
        this.log.warn(`Push gagal: ${kode || (e as Error).message}`)
      }
    }
  }
}
