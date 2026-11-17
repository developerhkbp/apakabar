// Uji unggah/unduh blob terenkripsi. Jalankan gateway mode dev di port 3102: BASE=http://localhost:3102 node test/uji-berkas.mjs
import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3102'
const b64 = (n = 32) => randomBytes(n).toString('base64')
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const NOMOR = '628110009001'
await db.query(`DELETE FROM "Anggota" WHERE "nomorHp"=$1`, [NOMOR])
await db.query(`INSERT INTO "Anggota"(id,"nomorHp",nama,status,peran,"diubahPada") VALUES ('uji_berkas',$1,'Uji Berkas','AKTIF','USER',now())`, [NOMOR])
const j = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  return r.json()
}
const otp = await j('POST', '/auth/otp/minta', { nomorHp: NOMOR })
const v = await j('POST', '/auth/otp/verifikasi', {
  nomorHp: NOMOR, kode: otp.kodeDev,
  perangkat: { regId: 5, identitas: b64(33), signedPreKey: { id: 1, pub: b64(33), sig: b64(64) }, kyber: { id: 1, pub: b64(1569), sig: b64(64) }, oneTime: [{ id: 1, pub: b64(33) }] },
})
const h = { Authorization: `Bearer ${v.aksesToken}`, 'Content-Type': 'application/octet-stream' }
let lulus = 0
const ok = (n) => console.log(`  ✓ ${n}`) || lulus++

const data = randomBytes(300_000)
let r = await fetch(BASE + '/berkas', { method: 'POST', headers: h, body: data })
assert.equal(r.status, 201); const { id, ukuran } = await r.json(); assert.equal(ukuran, data.length); ok('unggah blob')
r = await fetch(BASE + `/berkas/${id}`, { headers: h })
assert.equal(r.status, 200); assert.ok(Buffer.from(await r.arrayBuffer()).equals(data)); ok('unduh sama persis')
r = await fetch(BASE + `/berkas/${id}`); assert.equal(r.status, 401); ok('tanpa token ditolak')
r = await fetch(BASE + '/berkas/../../etc/passwd', { headers: h }); assert.notEqual(r.status, 200); ok('path traversal ditolak')
r = await fetch(BASE + '/berkas/tidak-ada', { headers: h }); assert.equal(r.status, 404); ok('id tak valid → 404')
r = await fetch(BASE + '/berkas', { method: 'POST', headers: h, body: new Uint8Array(0) }); assert.equal(r.status, 400); ok('berkas kosong ditolak')
await db.query(`UPDATE "Berkas" SET kedaluwarsa = (now() at time zone 'utc') - interval '1 minute' WHERE id=$1`, [id])
r = await fetch(BASE + `/berkas/${id}`, { headers: h }); assert.equal(r.status, 404); ok('kedaluwarsa → 404')

await db.query(`DELETE FROM "Berkas" WHERE pengunggah='uji_berkas'`)
await db.query(`DELETE FROM "Anggota" WHERE "nomorHp"=$1`, [NOMOR])
await db.end()
console.log(`\n${lulus} pemeriksaan lulus`)
process.exit(0)
