import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { GrupOtomatisService } from '../grup/grup-otomatis.service'
import { normalisasiNomor } from '../common/nomor'

type SumberPelayan = { id: string; nama: string; hp: string[]; tohonan: string; fotoUrl: string | null; distrik: { id: string; nama: string }[]; kantorPusat: boolean }
type SumberCalon = { id: string; nama: string; hp: string[]; fotoUrl: string | null; pelayanId: string | null; tahapLpp: string | null }
type Muatan = { pelayan: SumberPelayan[]; calon: SumberCalon[] }

export type HasilSinkron = {
  mulai: string
  selesai: string | null
  galat: string | null
  pelayan: number
  calon: number
  anggotaBaru: number
  diperbarui: number
  dilepas: number
  tanpaNomor: number
  bentrokNomor: number
  fotoDiperbarui: number
  grupBaru: number
  masukGrup: number
  keluarGrup: number
}

const JAM_DEFAULT = 4 // WIB
const SAMA = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

/**
 * Sinkronisasi pelayan dan calon pelayan dari superapp ke ApaKabaR, otomatis tiap hari pukul 04:00 WIB:
 *  - anggota baru ditambahkan (status DIUNDANG; nomor HP dan nama anggota yang sudah ada tidak ditimpa),
 *  - alamat foto profil dari superapp disimpan (fotonya tidak diunduh; aplikasi memuatnya langsung dari alamat itu),
 *  - daftar grup otomatis tiap anggota dihitung ulang (tohonan, distrik, LPP, kantor pusat), lalu keanggotaan grup diselaraskan.
 */
@Injectable()
export class SinkronService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Sinkron')
  private timer?: NodeJS.Timeout
  private sedang = false
  private tundaSampai = 0
  private tanggalTerakhir = ''
  terakhir: HasilSinkron | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly otomatis: GrupOtomatisService,
  ) {}

  get berjalan() {
    return this.sedang
  }

  onModuleInit() {
    if (process.env.SINKRON_AKTIF === '0' || !process.env.SUPERAPP_SERVICE_KEY) {
      this.log.warn('Sinkronisasi terjadwal nonaktif (SUPERAPP_SERVICE_KEY belum diisi atau SINKRON_AKTIF=0)')
      return
    }
    this.timer = setInterval(() => void this.periksaJadwal(), 60_000)
    this.timer.unref?.()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  private async periksaJadwal() {
    const jam = Number(process.env.SINKRON_JAM ?? JAM_DEFAULT)
    const wib = new Date(Date.now() + 7 * 3600_000)
    if (wib.getUTCHours() !== jam) return
    const tanggal = wib.toISOString().slice(0, 10)
    if (this.tanggalTerakhir === tanggal || Date.now() < this.tundaSampai || this.sedang) return
    // dua replika gateway: hanya satu yang menang kunci hari ini
    if (!(await this.redis.kunciSekali(`sinkron:${tanggal}`, 23 * 3600))) {
      this.tanggalTerakhir = tanggal
      return
    }
    const h = await this.jalankan()
    if (h.galat) {
      // gagal (mis. superapp sedang tidak bisa dihubungi): kunci dilepas dan dicoba lagi 10 menit kemudian
      await this.redis.lepasKunci(`sinkron:${tanggal}`)
      this.tundaSampai = Date.now() + 10 * 60_000
    } else {
      this.tanggalTerakhir = tanggal
    }
  }

  async jalankan(): Promise<HasilSinkron> {
    const h: HasilSinkron = {
      mulai: new Date().toISOString(), selesai: null, galat: null, pelayan: 0, calon: 0, anggotaBaru: 0, diperbarui: 0, dilepas: 0,
      tanpaNomor: 0, bentrokNomor: 0, fotoDiperbarui: 0, grupBaru: 0, masukGrup: 0, keluarGrup: 0,
    }
    if (this.sedang) {
      h.galat = 'Sinkronisasi sedang berjalan'
      return h
    }
    this.sedang = true
    this.terakhir = h
    try {
      await this.proses(h)
    } catch (e) {
      h.galat = (e as Error).message || 'Gagal'
      this.log.error(`Sinkronisasi gagal: ${h.galat}`)
    } finally {
      h.selesai = new Date().toISOString()
      this.sedang = false
    }
    if (!h.galat) this.log.log(`Sinkronisasi selesai: ${JSON.stringify(h)}`)
    return h
  }

  private get dasar() {
    return (process.env.SUPERAPP_URL ?? 'https://api.hkbp.or.id/api/v1').replace(/\/$/, '')
  }

  private get kunci() {
    const k = process.env.SUPERAPP_SERVICE_KEY
    if (!k) throw new Error('SUPERAPP_SERVICE_KEY belum diisi')
    return k
  }

  private async proses(h: HasilSinkron) {
    const res = await fetch(`${this.dasar}/integrasi/apakabar/sinkron`, { headers: { 'X-Service-Key': this.kunci }, signal: AbortSignal.timeout(180_000) })
    if (!res.ok) throw new Error(`Superapp menjawab ${res.status}`)
    const data = (await res.json()) as Muatan
    // pengaman: respons yang jauh lebih kecil dari biasanya dicurigai rusak, jangan sampai mengeluarkan orang dari grup
    if (!Array.isArray(data.pelayan) || data.pelayan.length < 100) throw new Error('Data pelayan dari superapp tidak wajar (terlalu sedikit), sinkronisasi dibatalkan')
    h.pelayan = data.pelayan.length
    h.calon = data.calon?.length ?? 0

    const semua = await this.prisma.anggota.findMany({
      select: { id: true, nomorHp: true, sumberPelayanId: true, sumberCalonId: true, jenisSumber: true, grupOtomatis: true, fotoSuperapp: true },
    })
    type Baris = (typeof semua)[number]
    const dariPelayan = new Map<string, Baris>()
    const dariCalon = new Map<string, Baris>()
    const dariNomor = new Map<string, Baris>()
    for (const a of semua) {
      if (a.sumberPelayanId) dariPelayan.set(a.sumberPelayanId, a)
      if (a.sumberCalonId) dariCalon.set(a.sumberCalonId, a)
      dariNomor.set(a.nomorHp, a)
    }
    const diproses = new Set<string>()
    const namaGrup = new Map<string, string>()

    const olah = async (s: { id: string; nama: string; hp: string[]; fotoUrl: string | null }, jenis: 'PELAYAN' | 'CALON', kunciGrup: string[]) => {
      const nomor = s.hp.map((n) => normalisasiNomor(n)).find((n): n is string => !!n) ?? null
      let ada = (jenis === 'PELAYAN' ? dariPelayan.get(s.id) : dariCalon.get(s.id)) ?? null
      if (!ada && nomor) {
        const n = dariNomor.get(nomor)
        if (n) {
          // nomor sudah dipakai anggota lain yang jelas orang berbeda, atau sudah diproses putaran ini (dua pelayan satu nomor)
          const orangLain = jenis === 'PELAYAN' ? n.sumberPelayanId && n.sumberPelayanId !== s.id : n.sumberPelayanId || (n.sumberCalonId && n.sumberCalonId !== s.id)
          if (orangLain || diproses.has(n.id)) {
            h.bentrokNomor++
            return
          }
          ada = n
        }
      }
      if (ada && diproses.has(ada.id)) {
        h.bentrokNomor++
        return
      }
      if (!ada) {
        if (!nomor) {
          h.tanpaNomor++
          return
        }
        const baru = await this.prisma.anggota.create({
          data: {
            nomorHp: nomor, nama: s.nama || nomor, status: 'DIUNDANG', jenisSumber: jenis, grupOtomatis: kunciGrup, fotoSuperapp: s.fotoUrl,
            ...(jenis === 'PELAYAN' ? { sumberPelayanId: s.id } : { sumberCalonId: s.id }),
          },
          select: { id: true, nomorHp: true, sumberPelayanId: true, sumberCalonId: true, jenisSumber: true, grupOtomatis: true, fotoSuperapp: true },
        })
        dariNomor.set(nomor, baru)
        diproses.add(baru.id)
        h.anggotaBaru++
        if (s.fotoUrl) h.fotoDiperbarui++
        return
      }
      diproses.add(ada.id)
      const perlu: Record<string, unknown> = {}
      if (jenis === 'PELAYAN' && ada.sumberPelayanId !== s.id) perlu.sumberPelayanId = s.id
      if (jenis === 'CALON' && ada.sumberCalonId !== s.id) perlu.sumberCalonId = s.id
      if (ada.jenisSumber !== jenis) perlu.jenisSumber = jenis
      if (!SAMA(ada.grupOtomatis, kunciGrup)) perlu.grupOtomatis = kunciGrup
      if ((ada.fotoSuperapp ?? null) !== s.fotoUrl) {
        perlu.fotoSuperapp = s.fotoUrl
        h.fotoDiperbarui++
      }
      if (Object.keys(perlu).length) {
        await this.prisma.anggota.update({ where: { id: ada.id }, data: perlu })
        h.diperbarui++
      }
    }

    for (const p of data.pelayan) {
      const kunciGrup = ['PELAYAN', `TOHONAN:${p.tohonan}`, ...p.distrik.map((d) => `DISTRIK:${d.id}`), ...(p.kantorPusat ? ['KANTOR_PUSAT'] : [])]
      for (const d of p.distrik) namaGrup.set(`DISTRIK:${d.id}`, `Distrik ${d.nama}`)
      await olah(p, 'PELAYAN', kunciGrup)
    }
    for (const c of data.calon ?? []) {
      if (c.pelayanId) continue // sudah menjadi pelayan; ikut daftar pelayan
      await olah(c, 'CALON', c.tahapLpp ? [`LPP:${c.tahapLpp}`] : [])
    }

    // Anggota yang dulu ikut grup otomatis tetapi sekarang tidak ada lagi di daftar (pensiun, tidak aktif, selesai) dilepas dari semua grup otomatis.
    const lepas = semua.filter((a) => !diproses.has(a.id) && a.grupOtomatis.length > 0).map((a) => a.id)
    if (lepas.length) {
      await this.prisma.anggota.updateMany({ where: { id: { in: lepas } }, data: { grupOtomatis: [] } })
      h.dilepas = lepas.length
    }

    const g = await this.otomatis.rekonsiliasi(namaGrup)
    h.grupBaru = g.grupBaru
    h.masukGrup = g.masuk
    h.keluarGrup = g.keluar
  }
}
