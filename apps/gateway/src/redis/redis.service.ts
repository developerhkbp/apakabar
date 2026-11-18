import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

type Pendengar = (pesan: unknown) => void

/**
 * Pembungkus Redis yang opsional. Tanpa REDIS_URL semuanya berjalan di memori satu proses
 * (cukup untuk pengembangan dan satu replika). Dengan REDIS_URL, beberapa replika gateway
 * dapat saling meneruskan pesan (pub/sub), mengetahui siapa yang online, dan berbagi pembatas laju.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly log = new Logger('Redis')
  readonly aktif: boolean
  private perintah?: Redis
  private pelanggan?: Redis
  private readonly pendengar = new Map<string, Pendengar[]>()
  private readonly hitungLokal = new Map<string, { n: number; habis: number }>()

  constructor() {
    const url = process.env.REDIS_URL
    const sentinel = process.env.REDIS_SENTINELS // "host:port,host:port" — master dicari lewat Sentinel (Redis HA di cluster)
    this.aktif = !!(url || sentinel)
    if (!this.aktif) return
    const opsi = { maxRetriesPerRequest: 2 }
    if (sentinel) {
      const daftar = sentinel.split(',').map((s) => {
        const [host, port] = s.trim().split(':')
        return { host, port: parseInt(port || '26379', 10) }
      })
      const sambungan = () => new Redis({
        ...opsi,
        sentinels: daftar,
        name: process.env.REDIS_SENTINEL_MASTER ?? 'mymaster',
        db: parseInt(process.env.REDIS_DB ?? '1', 10), // terpisah dari database 0 milik superapp
        password: process.env.REDIS_PASSWORD || undefined,
        sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD || undefined,
      })
      this.pasang(sambungan(), sambungan())
    } else {
      this.pasang(new Redis(url!, opsi), new Redis(url!, opsi))
    }
  }

  private pasang(perintah: Redis, pelanggan: Redis) {
    this.perintah = perintah
    this.pelanggan = pelanggan
    for (const r of [perintah, pelanggan]) r.on('error', (e) => this.log.warn(`Redis: ${e.message}`))
    pelanggan.on('message', (kanal: string, isi: string) => {
      let data: unknown
      try {
        data = JSON.parse(isi)
      } catch {
        return
      }
      for (const f of this.pendengar.get(kanal) ?? []) f(data)
    })
  }

  async onModuleDestroy() {
    this.perintah?.disconnect()
    this.pelanggan?.disconnect()
  }

  /** Dipakai hanya oleh pengujian untuk menyuntikkan klien tiruan. */
  static dari(perintah: Redis, pelanggan: Redis): RedisService {
    const s = Object.create(RedisService.prototype) as RedisService
    Object.assign(s, { log: new Logger('Redis'), aktif: true, pendengar: new Map(), hitungLokal: new Map() })
    s.pasang(perintah, pelanggan)
    return s
  }

  async langgan(kanal: string, f: Pendengar) {
    const daftar = this.pendengar.get(kanal) ?? []
    daftar.push(f)
    this.pendengar.set(kanal, daftar)
    if (this.pelanggan && daftar.length === 1) await this.pelanggan.subscribe(kanal)
  }

  async terbitkan(kanal: string, data: unknown) {
    if (!this.perintah) return
    try {
      await this.perintah.publish(kanal, JSON.stringify(data))
    } catch (e) {
      this.log.warn(`Gagal menerbitkan: ${(e as Error).message}`)
    }
  }

  /** Penanda kehadiran: kunci berisi id instans, kedaluwarsa otomatis bila instans mati. */
  async tandaiOnline(anggotaId: string, instans: string, ttlDetik = 90) {
    if (!this.perintah) return
    try {
      await this.perintah.set(`online:${anggotaId}`, instans, 'EX', ttlDetik)
    } catch {
      /* abaikan */
    }
  }

  async hapusOnline(anggotaId: string, instans: string) {
    if (!this.perintah) return
    try {
      // hanya hapus bila masih milik instans ini (koneksi baru di replika lain tidak boleh terhapus)
      if ((await this.perintah.get(`online:${anggotaId}`)) === instans) await this.perintah.del(`online:${anggotaId}`)
    } catch {
      /* abaikan */
    }
  }

  async adaOnline(anggotaId: string): Promise<boolean> {
    if (!this.perintah) return false
    try {
      return (await this.perintah.exists(`online:${anggotaId}`)) === 1
    } catch {
      return false
    }
  }

  /** Kunci sekali-jalan antar replika (SET NX). Tanpa Redis selalu berhasil karena hanya ada satu proses. */
  async kunciSekali(kunci: string, ttlDetik: number): Promise<boolean> {
    if (!this.perintah) return true
    try {
      return (await this.perintah.set(`kunci:${kunci}`, '1', 'EX', ttlDetik, 'NX')) === 'OK'
    } catch {
      return false
    }
  }

  async lepasKunci(kunci: string) {
    if (!this.perintah) return
    try {
      await this.perintah.del(`kunci:${kunci}`)
    } catch {
      /* abaikan */
    }
  }

  /** Penghitung dengan kedaluwarsa (untuk pembatas laju). Mengembalikan hitungan setelah ditambah. */
  async tambahHitung(kunci: string, ttlDetik: number): Promise<number> {
    if (this.perintah) {
      try {
        const n = await this.perintah.incr(`hitung:${kunci}`)
        if (n === 1) await this.perintah.expire(`hitung:${kunci}`, ttlDetik)
        return n
      } catch {
        /* jatuh ke memori */
      }
    }
    const sekarang = Date.now()
    const h = this.hitungLokal.get(kunci)
    if (!h || h.habis < sekarang) {
      this.hitungLokal.set(kunci, { n: 1, habis: sekarang + ttlDetik * 1000 })
      return 1
    }
    return ++h.n
  }
}
