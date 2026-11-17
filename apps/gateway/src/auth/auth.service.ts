import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { normalisasiNomor } from '../common/nomor'
import { PaketPerangkatDto } from '../common/dto-perangkat'
import { PengirimOtp } from './pengirim-otp'
import { PeristiwaService } from '../common/peristiwa.service'

const TTL_OTP_MS = 5 * 60 * 1000
const JEDA_OTP_MS = parseInt(process.env.OTP_JEDA_DETIK ?? '60', 10) * 1000
const MAKS_PERCOBAAN = 5
const MAKS_OTP_PER_JAM = parseInt(process.env.OTP_MAKS_PER_JAM ?? '5', 10)
// Batas per alamat IP (semua nomor): mencegah satu sumber memindai nomor atau menghabiskan kuota WhatsApp.
const MAKS_OTP_PER_IP_JAM = parseInt(process.env.OTP_MAKS_PER_IP_JAM ?? '30', 10)

export const PENGIRIM_OTP = 'PENGIRIM_OTP'
export interface PayloadToken {
  sub: string // id anggota
  ver: number // versiToken perangkat
  jenis: 'akses' | 'refresh'
}

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth')

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    @Inject(PENGIRIM_OTP) private readonly pengirim: PengirimOtp,
    private readonly peristiwa: PeristiwaService,
  ) {}

  private hash(nomorHp: string, kode: string) {
    const rahasia = process.env.OTP_SECRET ?? process.env.JWT_SECRET ?? ''
    return createHmac('sha256', rahasia).update(`${nomorHp}:${kode}`).digest('hex')
  }

  /**
   * Hanya nomor yang sudah ada di daftar anggota yang dikirimi kode. Nomor yang tidak terdaftar
   * (atau diblokir) langsung ditolak tanpa mengirim WhatsApp, sehingga kuota pengiriman tidak terbuang.
   */
  async mintaOtp(nomorMentah: string, ip?: string) {
    if (ip && (await this.redis.tambahHitung(`otp-ip:${ip}`, 3600)) > MAKS_OTP_PER_IP_JAM) {
      throw new HttpException('Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti', HttpStatus.TOO_MANY_REQUESTS)
    }
    const generik = { pesan: 'Kode verifikasi dikirim lewat WhatsApp.', kodeDev: undefined as string | undefined }
    const nomorHp = normalisasiNomor(nomorMentah)
    if (!nomorHp) throw new BadRequestException('Format nomor HP tidak valid')

    const anggota = await this.prisma.anggota.findUnique({ where: { nomorHp }, select: { id: true, status: true } })
    if (!anggota || anggota.status === 'DITANGGUHKAN') throw new ForbiddenException('Maaf, Anda tidak terdaftar.')

    const terakhir = await this.prisma.otpPermintaan.findFirst({
      where: { nomorHp },
      orderBy: { dibuatPada: 'desc' },
      select: { dibuatPada: true },
    })
    if (terakhir && Date.now() - terakhir.dibuatPada.getTime() < JEDA_OTP_MS) {
      throw new HttpException('Tunggu sebentar sebelum meminta kode lagi', HttpStatus.TOO_MANY_REQUESTS)
    }
    const sejam = await this.prisma.otpPermintaan.count({
      where: { nomorHp, dibuatPada: { gt: new Date(Date.now() - 3600_000) } },
    })
    if (sejam >= MAKS_OTP_PER_JAM) {
      throw new HttpException('Terlalu banyak permintaan kode. Coba lagi nanti', HttpStatus.TOO_MANY_REQUESTS)
    }

    const kode = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await this.prisma.otpPermintaan.create({
      data: { nomorHp, hashKode: this.hash(nomorHp, kode), kedaluwarsa: new Date(Date.now() + TTL_OTP_MS), ip },
    })
    try {
      await this.pengirim.kirim(nomorHp, kode)
    } catch (e) {
      this.log.error(`Gagal mengirim OTP: ${(e as Error).message}`)
      throw new HttpException('Kode verifikasi belum bisa dikirim. Coba lagi nanti', HttpStatus.BAD_GATEWAY)
    }
    if (this.pengirim.gema) generik.kodeDev = kode
    return generik
  }

  async verifikasiOtp(nomorMentah: string, kode: string, paket: PaketPerangkatDto) {
    const gagal = new UnauthorizedException('Kode salah atau sudah kedaluwarsa')
    const nomorHp = normalisasiNomor(nomorMentah)
    if (!nomorHp) throw gagal

    const anggota = await this.prisma.anggota.findUnique({ where: { nomorHp } })
    if (!anggota || anggota.status === 'DITANGGUHKAN') throw gagal

    const req = await this.prisma.otpPermintaan.findFirst({
      where: { nomorHp, terpakai: false, kedaluwarsa: { gt: new Date() } },
      orderBy: { dibuatPada: 'desc' },
    })
    if (!req || req.percobaan >= MAKS_PERCOBAAN) throw gagal

    const cocok = (() => {
      const a = Buffer.from(req.hashKode, 'hex')
      const b = Buffer.from(this.hash(nomorHp, kode), 'hex')
      return a.length === b.length && timingSafeEqual(a, b)
    })()
    if (!cocok) {
      await this.prisma.otpPermintaan.update({ where: { id: req.id }, data: { percobaan: { increment: 1 } } })
      throw gagal
    }

    const perangkat = await this.pasangPerangkat(anggota.id, paket)
    // Nomor terbukti milik anggota, tetapi masuk ke aplikasi baru setelah admin menyetujui:
    // DIUNDANG → MENUNGGU. Anggota yang sudah AKTIF tetap AKTIF.
    const status = anggota.status === 'DIUNDANG' ? 'MENUNGGU' : anggota.status
    await this.prisma.$transaction([
      this.prisma.otpPermintaan.update({ where: { id: req.id }, data: { terpakai: true } }),
      this.prisma.anggota.update({ where: { id: anggota.id }, data: { status } }),
    ])
    // Baru menjadi MENUNGGU: kabari admin (push + layar admin). Tidak boleh menggagalkan login.
    if (status === 'MENUNGGU' && anggota.status !== 'MENUNGGU') this.peristiwa.emit('anggota-menunggu')
    return {
      anggota: { id: anggota.id, nama: anggota.nama, peran: anggota.peran, status },
      ...this.terbitkanToken(anggota.id, perangkat.versiToken),
    }
  }

  /** Satu perangkat per anggota: perangkat lama diganti dan token lama otomatis tidak berlaku. */
  private async pasangPerangkat(anggotaId: string, p: PaketPerangkatDto) {
    const data = {
      registrationId: p.regId,
      identityKey: p.identitas,
      signedPreKeyId: p.signedPreKey.id,
      signedPreKey: p.signedPreKey.pub,
      signedPreKeySig: p.signedPreKey.sig,
      kyberPreKeyId: p.kyber.id,
      kyberPreKey: p.kyber.pub,
      kyberPreKeySig: p.kyber.sig,
    }
    return this.prisma.$transaction(async (tx) => {
      const ada = await tx.perangkat.findUnique({ where: { anggotaId }, select: { id: true, versiToken: true } })
      let id: string
      let versiToken: number
      if (ada) {
        await tx.oneTimePrekey.deleteMany({ where: { perangkatId: ada.id } })
        await tx.pesanAntrean.deleteMany({ where: { penerimaId: anggotaId } }) // pesan lama tak bisa didekripsi perangkat baru
        const u = await tx.perangkat.update({
          where: { id: ada.id },
          data: { ...data, pushToken: null, versiToken: { increment: 1 } },
          select: { id: true, versiToken: true },
        })
        id = u.id
        versiToken = u.versiToken
      } else {
        const c = await tx.perangkat.create({ data: { ...data, anggotaId }, select: { id: true, versiToken: true } })
        id = c.id
        versiToken = c.versiToken
      }
      if (p.oneTime.length) {
        await tx.oneTimePrekey.createMany({
          data: p.oneTime.map((o) => ({ perangkatId: id, keyId: o.id, kunci: o.pub })),
          skipDuplicates: true,
        })
      }
      return { id, versiToken }
    })
  }

  private terbitkanToken(anggotaId: string, ver: number) {
    const akses = this.jwt.sign({ sub: anggotaId, ver, jenis: 'akses' } satisfies PayloadToken, { expiresIn: '1h' })
    const refreshToken = this.jwt.sign({ sub: anggotaId, ver, jenis: 'refresh' } satisfies PayloadToken, { expiresIn: '30d' })
    return { aksesToken: akses, refreshToken }
  }

  async refresh(refreshToken: string) {
    let p: PayloadToken
    try {
      p = this.jwt.verify<PayloadToken>(refreshToken)
    } catch {
      throw new UnauthorizedException('Sesi berakhir. Silakan masuk lagi')
    }
    if (p.jenis !== 'refresh') throw new UnauthorizedException('Sesi berakhir. Silakan masuk lagi')
    await this.periksaSesi(p, true)
    return this.terbitkanToken(p.sub, p.ver)
  }

  /** Status keanggotaan untuk halaman "menunggu persetujuan". Boleh dipanggil selama belum ditangguhkan. */
  async statusSaya(token: string) {
    const pengguna = await this.periksaSesi(this.verifikasiToken(token), true)
    return { status: pengguna.status, peran: pengguna.peran }
  }

  /** Token hanya sah bila anggota masih aktif dan versi perangkat sama dengan yang tercatat. */
  async periksaSesi(p: PayloadToken, izinkanMenunggu = false) {
    const perangkat = await this.prisma.perangkat.findUnique({
      where: { anggotaId: p.sub },
      select: { versiToken: true, anggota: { select: { status: true, peran: true, nama: true } } },
    })
    const status = perangkat?.anggota.status
    const sah = status === 'AKTIF' || (izinkanMenunggu && status === 'MENUNGGU')
    if (!perangkat || perangkat.versiToken !== p.ver || !sah) {
      throw new UnauthorizedException('Sesi tidak berlaku. Silakan masuk lagi')
    }
    return { id: p.sub, nama: perangkat.anggota.nama, peran: perangkat.anggota.peran, status: perangkat.anggota.status }
  }

  verifikasiToken(token: string): PayloadToken {
    try {
      const p = this.jwt.verify<PayloadToken>(token)
      if (p.jenis !== 'akses') throw new Error('bukan akses')
      return p
    } catch {
      throw new UnauthorizedException('Token tidak valid')
    }
  }
}
