// Uji relay antar-replika lewat Redis (tiruan, ioredis-mock) dan pembatas OTP per IP.
// Jalankan: npx ts-node --transpile-only test/uji-redis.ts   (butuh Postgres lokal; port 3111/3112)
import 'dotenv/config'
import 'reflect-metadata'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import Module from 'node:module'
import WebSocket from 'ws'

process.env.REDIS_URL = 'redis://mock:6379'
process.env.OTP_PENGIRIM = 'dev'
process.env.OTP_JEDA_DETIK = '0'
process.env.OTP_MAKS_PER_JAM = '100'
process.env.OTP_MAKS_PER_IP_JAM = '8'

// Ganti 'ioredis' dengan tiruan sebelum aplikasi dimuat.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mock = require('ioredis-mock')
const asli = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (req: unknown, ...r: unknown[]) {
  if (req === 'ioredis') return { __esModule: true, default: Mock, Redis: Mock }
  return asli.call(this, req, ...r)
}

async function boot(port: number) {
  const { NestFactory } = await import('@nestjs/core')
  const { ValidationPipe } = await import('@nestjs/common')
  const { WsAdapter } = await import('@nestjs/platform-ws')
  const { AppModule } = await import('../src/app.module')
  const app = await NestFactory.create(AppModule, { logger: ['error'] })
  app.useWebSocketAdapter(new WsAdapter(app))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(port, '127.0.0.1')
  return app
}

const pg = require('pg')
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const b64 = (n = 32) => randomBytes(n).toString('base64')
const j = async (base: string, m: string, p: string, b?: unknown, tok?: string) => {
  const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) })
  return { status: r.status, json: await r.json().catch(() => ({})) as Record<string, any> }
}
async function masuk(base: string, id: string, nomor: string, nama: string) {
  await db.query(`DELETE FROM "Anggota" WHERE "nomorHp"=$1`, [nomor])
  await db.query(`INSERT INTO "Anggota"(id,"nomorHp",nama,status,peran,"diubahPada") VALUES ($1,$2,$3,'AKTIF','USER',now())`, [id, nomor, nama])
  const otp = await j(base, 'POST', '/auth/otp/minta', { nomorHp: nomor })
  const v = await j(base, 'POST', '/auth/otp/verifikasi', {
    nomorHp: nomor, kode: otp.json.kodeDev,
    perangkat: { regId: 5, identitas: b64(33), signedPreKey: { id: 1, pub: b64(33), sig: b64(64) }, kyber: { id: 1, pub: b64(1569), sig: b64(64) }, oneTime: [{ id: 1, pub: b64(33) }] },
  })
  return v.json.aksesToken as string
}
const sambung = (port: number, token: string) =>
  new Promise<{ ws: WebSocket; pesan: any[]; tutup: number[] }>((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`)
    const st = { ws, pesan: [] as any[], tutup: [] as number[] }
    ws.on('message', (m) => {
      const d = JSON.parse(m.toString())
      st.pesan.push(d)
      if (d.t === 'siap') res(st)
    })
    ws.on('close', (c) => st.tutup.push(c))
    ws.on('error', rej)
  })
const tunggu = async (f: () => boolean, ms = 3000) => {
  const t = Date.now()
  while (!f()) {
    if (Date.now() - t > ms) return false
    await new Promise((r) => setTimeout(r, 25))
  }
  return true
}
let lulus = 0
const ok = (n: string) => { console.log(`  ✓ ${n}`); lulus++ }

async function main() {
const app1 = await boot(3111)
const app2 = await boot(3112)
const B1 = 'http://127.0.0.1:3111'
try {
  const tokA = await masuk(B1, 'uji_redis_a', '628110009201', 'Uji Redis A')
  const tokB = await masuk(B1, 'uji_redis_b', '628110009202', 'Uji Redis B')

  // A di replika 1, B di replika 2
  const a = await sambung(3111, tokA)
  const b = await sambung(3112, tokB)
  a.ws.send(JSON.stringify({ event: 'kirim', data: { untuk: 'uji_redis_b', jenis: 2, isi: 'Y2lwaGVy', idKlien: 'k1' } }))
  assert.ok(await tunggu(() => b.pesan.some((p) => p.t === 'masuk' && p.idKlien === 'k1')), 'B (replika 2) harus menerima pesan dari A (replika 1)')
  ok('pesan dari replika 1 sampai ke penerima di replika 2')
  assert.ok(await tunggu(() => a.pesan.some((p) => p.t === 'terkirim' && p.idKlien === 'k1')))
  ok('pengirim menerima tanda terkirim')

  // arah sebaliknya + tanda sampai (ack) kembali ke pengirim lintas replika
  const masuk1 = b.pesan.find((p) => p.t === 'masuk' && p.idKlien === 'k1')
  b.ws.send(JSON.stringify({ event: 'ack', data: { id: masuk1.id } }))
  assert.ok(await tunggu(() => a.pesan.some((p) => p.t === 'masuk' && p.jenis === 6 && JSON.parse(p.isi).t === 'sampai')), 'tanda sampai harus kembali ke A')
  ok('tanda sampai (✓✓) kembali ke pengirim lintas replika')

  // tidak ada pengiriman ganda
  const jumlah = b.pesan.filter((p) => p.t === 'masuk' && p.idKlien === 'k1').length
  assert.equal(jumlah, 1); ok('tidak ada pesan ganda')

  // satu perangkat per anggota: koneksi baru B di replika 1 menutup koneksi lama di replika 2
  const b2 = await sambung(3111, tokB)
  assert.ok(await tunggu(() => b.tutup.includes(4001)), 'koneksi lama B di replika 2 harus ditutup')
  ok('koneksi baru menutup koneksi lama di replika lain (kode 4001)')
  a.ws.send(JSON.stringify({ event: 'kirim', data: { untuk: 'uji_redis_b', jenis: 2, isi: 'Y2lwaGVy', idKlien: 'k2' } }))
  assert.ok(await tunggu(() => b2.pesan.some((p) => p.t === 'masuk' && p.idKlien === 'k2')))
  ok('pesan berikutnya tiba di koneksi baru')

  // B luring → tidak ada yang mengantar, pesan tetap diantre
  b2.ws.close()
  await new Promise((r) => setTimeout(r, 300))
  a.ws.send(JSON.stringify({ event: 'kirim', data: { untuk: 'uji_redis_b', jenis: 2, isi: 'Y2lwaGVy', idKlien: 'k3' } }))
  assert.ok(await tunggu(() => a.pesan.some((p) => p.t === 'terkirim' && p.idKlien === 'k3')))
  const antre = await db.query(`SELECT count(*)::int n FROM "PesanAntrean" WHERE "penerimaId"='uji_redis_b' AND "idKlien"='k3' AND diterima=false`)
  assert.equal(antre.rows[0].n, 1); ok('penerima luring: pesan tersimpan di antrean')
  const b3 = await sambung(3112, tokB)
  assert.ok(await tunggu(() => b3.pesan.some((p) => p.t === 'masuk' && p.idKlien === 'k3')))
  ok('antrean dikosongkan saat tersambung lagi (replika mana pun)')

  // pembatas OTP per IP
  let tertolak = 0
  for (let i = 0; i < 12; i++) {
    const r = await j(B1, 'POST', '/auth/otp/minta', { nomorHp: '628110009201' })
    if (r.status === 429) tertolak++
  }
  assert.ok(tertolak >= 5, `harus ada penolakan 429 (didapat ${tertolak})`)
  ok(`pembatas OTP per IP menolak setelah batas (${tertolak} dari 12 ditolak)`)

  a.ws.close(); b3.ws.close()
} finally {
  await db.query(`DELETE FROM "Anggota" WHERE id IN ('uji_redis_a','uji_redis_b')`)
  await db.query(`DELETE FROM "OtpPermintaan" WHERE "nomorHp" IN ('628110009201','628110009202')`)
  await db.end()
  await app1.close()
  await app2.close()
}
console.log(`${lulus} lulus`)
process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
