// Uji foto profil & foto grup. Gateway dev di port 3102: BASE=http://localhost:3102 node test/uji-foto.mjs
import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3102'
const b64 = (n = 32) => randomBytes(n).toString('base64')
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const j = async (m, p, b, tok) => {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) })
  return { status: r.status, h: r.headers, buf: Buffer.from(await r.arrayBuffer()) }
}
const json = (r) => JSON.parse(r.buf.toString())
async function masuk(id, nomor, nama, peran) {
  await db.query(`DELETE FROM "Anggota" WHERE "nomorHp"=$1`, [nomor])
  await db.query(`INSERT INTO "Anggota"(id,"nomorHp",nama,status,peran,"diubahPada") VALUES ($1,$2,$3,'AKTIF',$4,now())`, [id, nomor, nama, peran])
  const otp = json(await j('POST', '/auth/otp/minta', { nomorHp: nomor }))
  const v = json(await j('POST', '/auth/otp/verifikasi', {
    nomorHp: nomor, kode: otp.kodeDev,
    perangkat: { regId: 5, identitas: b64(33), signedPreKey: { id: 1, pub: b64(33), sig: b64(64) }, kyber: { id: 1, pub: b64(1569), sig: b64(64) }, oneTime: [{ id: 1, pub: b64(33) }] },
  }))
  return v.aksesToken
}
let lulus = 0
const ok = (n) => console.log(`  ✓ ${n}`) || lulus++
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(2000)])
const tokA = await masuk('uji_foto_a', '628110009101', 'Uji Foto A', 'ADMIN')
const tokB = await masuk('uji_foto_b', '628110009102', 'Uji Foto B', 'USER')

let r = await j('PUT', '/foto/saya', { data: jpeg.toString('base64') }, tokB)
assert.equal(r.status, 200); assert.equal(json(r).fotoV, 1); ok('unggah foto profil')
r = await j('GET', '/foto/anggota/uji_foto_b', undefined, tokA)
assert.equal(r.status, 200); assert.ok(r.buf.equals(jpeg)); assert.equal(r.h.get('content-type'), 'image/jpeg'); ok('anggota lain bisa mengunduh')
r = await j('PUT', '/foto/saya', { data: Buffer.from('bukan jpeg '.repeat(20)).toString('base64') }, tokB)
assert.equal(r.status, 400); ok('bukan JPEG ditolak')
r = await j('PUT', '/foto/saya', { data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(70000)]).toString('base64') }, tokB)
assert.equal(r.status, 400); ok('terlalu besar ditolak')
r = await j('GET', '/anggota', undefined, tokA)
assert.equal(json(r).find((a) => a.id === 'uji_foto_b').fotoV, 1); ok('direktori memuat fotoV')

r = await j('POST', '/grup', { nama: 'Uji Foto Grup', anggotaIds: ['uji_foto_b'], adminIds: [] }, tokA)
const gid = json(r).id
r = await j('PUT', `/grup/${gid}/foto`, { data: jpeg.toString('base64') }, tokB)
assert.equal(r.status, 403); ok('anggota biasa tidak boleh mengganti foto grup')
r = await j('PUT', `/grup/${gid}/foto`, { data: jpeg.toString('base64') }, tokA)
assert.equal(r.status, 200); assert.equal(json(r).fotoV, 1); ok('admin mengganti foto grup')
r = await j('GET', `/foto/grup/${gid}`, undefined, tokB)
assert.ok(r.buf.equals(jpeg)); ok('anggota grup mengunduh foto grup')
r = await j('GET', `/grup/${gid}`, undefined, tokB)
assert.equal(json(r).fotoV, 1); ok('detail grup memuat fotoV')
r = await j('PUT', `/grup/${gid}/foto`, { data: null }, tokA)
r = await j('GET', `/foto/grup/${gid}`, undefined, tokB)
assert.equal(r.status, 404); ok('hapus foto grup')
r = await j('GET', '/foto/saya/versi')
assert.equal(r.status, 401); ok('tanpa token ditolak')

await j('DELETE', `/grup/${gid}`, undefined, tokA)
await db.query(`DELETE FROM "Anggota" WHERE id IN ('uji_foto_a','uji_foto_b')`)
console.log(`${lulus} lulus`)
await db.end()
