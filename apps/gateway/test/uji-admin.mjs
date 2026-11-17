// Uji admin & grup (tanpa kripto asli: server hanya meneruskan byte, jadi kunci/ciphertext boleh acak).
// Jalankan gateway dulu, lalu: node test/uji-admin.mjs
import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import WebSocket from 'ws'

const BASE = process.env.BASE ?? 'http://localhost:3101'
const b64 = (n = 32) => randomBytes(n).toString('base64')
const N = (i) => `628110001${String(i).padStart(4, '0')}` // 62811000100xx

async function api(metode, jalur, badan, token) {
  const res = await fetch(BASE + jalur, {
    method: metode,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: badan ? JSON.stringify(badan) : undefined,
  })
  const t = await res.text()
  return { status: res.status, data: t ? JSON.parse(t) : null }
}

const paket = () => ({
  regId: 1 + Math.floor(Math.random() * 16000),
  identitas: b64(33),
  signedPreKey: { id: 1, pub: b64(33), sig: b64(64) },
  kyber: { id: 1, pub: b64(1569), sig: b64(64) },
  oneTime: [{ id: 1, pub: b64(33) }],
})

async function masuk(nomor) {
  const m = await api('POST', '/auth/otp/minta', { nomorHp: nomor })
  assert.equal(m.status, 200, JSON.stringify(m.data))
  const v = await api('POST', '/auth/otp/verifikasi', { nomorHp: nomor, kode: m.data.kodeDev, perangkat: paket() })
  assert.equal(v.status, 200, JSON.stringify(v.data))
  return { id: v.data.anggota.id, status: v.data.anggota.status, token: v.data.aksesToken }
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let lulus = 0
const ok = (nama) => console.log(`  ✓ ${nama}`) || lulus++

// bersihkan sisa uji sebelumnya
await db.query(`DELETE FROM "Grup" WHERE nama LIKE 'UJI %'`)
await db.query(`DELETE FROM "Anggota" WHERE "nomorHp" LIKE '628110001%' OR "nomorHp" = '628111000109'`)
await db.query(`DELETE FROM "OtpPermintaan" WHERE "nomorHp" LIKE '628110001%' OR "nomorHp" = '628111000109'`)

// data awal: 1 admin utama, 1 admin biasa, 4 pelayan hasil impor (DIUNDANG)
await db.query(`INSERT INTO "Anggota"(id,"nomorHp",nama,status,peran,"diubahPada") VALUES
  ('uji_utama','${N(1)}','Uji Utama','DIUNDANG','ADMIN_UTAMA',now()),
  ('uji_admin','${N(2)}','Uji Admin','DIUNDANG','USER',now()),
  ('uji_a','${N(3)}','Uji A','DIUNDANG','USER',now()),
  ('uji_b','${N(4)}','Uji B','DIUNDANG','USER',now()),
  ('uji_c','${N(5)}','Uji C','DIUNDANG','USER',now()),
  ('uji_d','${N(6)}','Uji D','DIUNDANG','USER',now())`)
await db.query(`UPDATE "Anggota" SET status='AKTIF' WHERE id='uji_utama'`)

console.log('Persetujuan')
const utama = await masuk(N(1))
assert.equal(utama.status, 'AKTIF')
const a = await masuk(N(3))
assert.equal(a.status, 'MENUNGGU'); ok('verifikasi OTP pertama → MENUNGGU')
assert.equal((await api('GET', '/anggota', undefined, a.token)).status, 401); ok('MENUNGGU belum bisa memakai API chat')
const st = await api('GET', '/auth/saya', undefined, a.token)
assert.equal(st.data.status, 'MENUNGGU'); ok('halaman tunggu bisa cek status')
assert.equal((await api('GET', '/admin/ringkasan', undefined, a.token)).status, 401)
const b = await masuk(N(4))
const c = await masuk(N(5))
const d = await masuk(N(6))

assert.equal((await api('GET', '/admin/anggota?status=MENUNGGU&q=Uji', undefined, utama.token)).data.data.length, 4); ok('admin melihat 4 permohonan')
assert.equal((await api('POST', `/admin/anggota/${a.id}/setujui`, undefined, utama.token)).status, 200)
assert.equal((await api('GET', '/auth/saya', undefined, a.token)).data.status, 'AKTIF'); ok('setujui → AKTIF tanpa login ulang')
assert.equal((await api('GET', '/anggota', undefined, a.token)).status, 200); ok('anggota aktif bisa memakai API')
const massal = await api('POST', '/admin/anggota/setujui', { ids: [b.id, c.id, d.id] }, utama.token)
assert.equal(massal.data.disetujui, 3); ok('setujui massal')

console.log('Peran admin')
assert.equal((await api('PUT', `/admin/anggota/${a.id}/peran`, { peran: 'ADMIN' }, a.token)).status, 403); ok('anggota biasa tidak bisa mengangkat admin')
assert.equal((await api('PUT', `/admin/anggota/${a.id}/peran`, { peran: 'ADMIN' }, utama.token)).status, 200)
const a2 = await masuk(N(3)) // masuk ulang agar peran di token segar
assert.equal(a2.status, 'AKTIF')
assert.equal((await api('GET', '/admin/ringkasan', undefined, a2.token)).status, 200); ok('admin utama mengangkat admin')
assert.equal((await api('POST', '/admin/anggota', { nomorHp: '0811-1000-109', nama: 'Orang Baru' }, a2.token)).status, 403); ok('admin biasa tak bisa tambah anggota manual')
const baru = await api('POST', '/admin/anggota', { nomorHp: '0811-1000-109', nama: 'Orang Baru' }, utama.token)
assert.equal(baru.status, 201, JSON.stringify(baru.data)); assert.equal(baru.data.status, 'AKTIF'); ok('admin utama menambah nomor & nama (langsung AKTIF)')
assert.equal((await api('POST', '/admin/anggota', { nomorHp: '0811-1000-109', nama: 'Dobel' }, utama.token)).status, 400); ok('nomor ganda ditolak')

console.log('Grup')
assert.equal((await api('POST', '/grup', { nama: 'UJI X', anggotaIds: [b.id] }, b.token)).status, 403); ok('anggota biasa tidak bisa membuat grup')
const g = await api('POST', '/grup', { nama: 'UJI Tim', anggotaIds: [a.id, b.id, c.id] }, utama.token)
assert.equal(g.status, 201, JSON.stringify(g.data))
const gid = g.data.id
assert.equal(g.data.anggota.length, 4); ok('admin membuat grup (pembuat otomatis admin grup)')
assert.equal((await api('POST', '/grup', { nama: 'UJI Y', anggotaIds: ['tidak_ada'] }, utama.token)).status, 400); ok('anggota tak dikenal ditolak')
assert.equal((await api('POST', `/grup/${gid}/anggota`, { anggotaIds: [d.id] }, b.token)).status, 403); ok('anggota biasa tak bisa menambah anggota')
assert.equal((await api('PUT', `/grup/${gid}/anggota/${b.id}/peran`, { peran: 'ADMIN_GRUP' }, utama.token)).status, 200); ok('admin memberi akses admin grup')
assert.equal((await api('POST', `/grup/${gid}/anggota`, { anggotaIds: [d.id] }, b.token)).status, 200); ok('admin grup menambah anggota')
assert.equal((await api('PATCH', `/grup/${gid}`, { nama: 'UJI Tim Baru' }, c.token)).status, 403)
assert.equal((await api('PATCH', `/grup/${gid}`, { nama: 'UJI Tim Baru' }, b.token)).status, 200); ok('admin grup mengganti nama')
assert.equal((await api('GET', '/grup', undefined, d.token)).data.length, 1); ok('anggota melihat grupnya')

// relay grup: A kirim → B, C, D menerima; A tidak
const sambung = (token) => {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws?token=${token}`)
  const masuk = []
  ws.on('message', (x) => { const m = JSON.parse(x.toString()); if (m.t === 'masuk') masuk.push(m) })
  return { ws, masuk, buka: new Promise((r, j) => { ws.on('open', r); ws.on('error', j) }) }
}
const tunggu = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await new Promise((r) => setTimeout(r, 40)) } throw new Error('waktu habis') }
const [wa, wb, wc] = [sambung(a2.token), sambung(b.token), sambung(c.token)]
await Promise.all([wa.buka, wb.buka, wc.buka])
const cipher = b64(120)
wa.ws.send(JSON.stringify({ event: 'kirimGrup', data: { grupId: gid, isi: cipher, idKlien: 'k1' } }))
await tunggu(() => wb.masuk.length && wc.masuk.length)
assert.equal(wb.masuk[0].jenis, 4); assert.equal(wb.masuk[0].grupId, gid); assert.equal(wb.masuk[0].isi, cipher); assert.equal(wb.masuk[0].dari, a2.id)
assert.equal(wa.masuk.length, 0); ok('pesan grup diteruskan ke anggota lain, tidak balik ke pengirim')
wa.ws.send(JSON.stringify({ event: 'kirimGrup', data: { grupId: gid, isi: cipher, idKlien: 'k1' } }))
await new Promise((r) => setTimeout(r, 400))
assert.equal(wb.masuk.length, 1); ok('kirim ulang idKlien sama tidak digandakan')
// tanda terima: ack penerima → pengirim menerima 'sampai'; laporan baca → 'baca'
const tanda = (w, t) => w.masuk.filter((m) => m.jenis === 6 && JSON.parse(m.isi).t === t)
wb.ws.send(JSON.stringify({ event: 'ack', data: { id: wb.masuk[0].id } }))
await tunggu(() => tanda(wa, 'sampai').length === 1)
assert.equal(tanda(wa, 'sampai')[0].dari, b.id); assert.equal(JSON.parse(tanda(wa, 'sampai')[0].isi).idKlien, 'k1'); assert.equal(tanda(wa, 'sampai')[0].grupId, gid)
ok('pengirim menerima tanda "sampai" dari penerima')
wb.ws.send(JSON.stringify({ event: 'ack', data: { id: wb.masuk[0].id } }))
await new Promise((r) => setTimeout(r, 300))
assert.equal(tanda(wa, 'sampai').length, 1); ok('ack ganda tidak menggandakan tanda')
wb.ws.send(JSON.stringify({ event: 'baca', data: { pengirimId: a2.id, idKlien: ['k1', 'bukan-milik-saya'] } }))
await tunggu(() => tanda(wa, 'baca').length === 1)
await new Promise((r) => setTimeout(r, 300))
assert.equal(tanda(wa, 'baca').length, 1); assert.equal(tanda(wa, 'baca')[0].dari, b.id); ok('pengirim menerima tanda "baca"; id palsu diabaikan')
wc.ws.send(JSON.stringify({ event: 'baca', data: { pengirimId: a2.id, idKlien: ['k1'] } }))
await new Promise((r) => setTimeout(r, 300))
assert.equal(tanda(wa, 'baca').length, 2); ok('tanda baca dari anggota lain tercatat terpisah')
assert.equal(tanda(wb, 'baca').length, 0); ok('tanda kontrol tidak bocor ke anggota lain')
// non-anggota tidak bisa kirim
const wd = sambung(d.token); await wd.buka
await db.query(`DELETE FROM "AnggotaGrup" WHERE "grupId"=$1 AND "anggotaId"=$2`, [gid, d.id])
wd.ws.send(JSON.stringify({ event: 'kirimGrup', data: { grupId: gid, isi: cipher, idKlien: 'k9' } }))
await new Promise((r) => setTimeout(r, 400))
assert.equal(wb.masuk.length, 1); ok('bukan anggota tak bisa mengirim ke grup')

// hapus pesan: anggota biasa tak berwenang; admin grup berwenang; penulis sendiri berwenang
const hapus = (w, pengirimId, idKlien) => w.ws.send(JSON.stringify({ event: 'hapusPesan', data: { grupId: gid, pengirimId, idKlien } }))
const jumlahKontrol = (w) => w.masuk.filter((m) => m.jenis === 5).length
hapus(wc, a2.id, 'k1')
await new Promise((r) => setTimeout(r, 400))
assert.equal(jumlahKontrol(wb), 0); ok('anggota biasa tak bisa menghapus pesan orang lain')
hapus(wb, a2.id, 'k1')
await tunggu(() => jumlahKontrol(wa) && jumlahKontrol(wc) && jumlahKontrol(wb))
const kontrol = wc.masuk.find((m) => m.jenis === 5)
assert.deepEqual(JSON.parse(kontrol.isi), { pengirimId: a2.id, idKlien: 'k1' }); ok('admin grup menghapus: semua anggota menerima perintah hapus')
hapus(wb, a2.id, 'k1')
await new Promise((r) => setTimeout(r, 400))
assert.equal(jumlahKontrol(wa), 1); ok('hapus berulang tidak digandakan')
// hapus untuk semua pada percakapan 1:1: pengirim menghapus pesannya sendiri
const sebelum = wb.masuk.length
wa.ws.send(JSON.stringify({ event: 'hapusPesan', data: { untukId: b.id, idKlien: 'p1' } }))
await tunggu(() => wb.masuk.length === sebelum + 1)
const k1 = wb.masuk[wb.masuk.length - 1]
assert.equal(k1.jenis, 5); assert.equal(k1.grupId, undefined); assert.equal(k1.dari, a2.id)
assert.deepEqual(JSON.parse(k1.isi), { pengirimId: a2.id, idKlien: 'p1' }); ok('hapus untuk semua di percakapan 1:1 sampai ke lawan bicara')

console.log('Mengeluarkan dari grup & blokir')
const distLama = (await api('GET', `/grup/${gid}`, undefined, utama.token)).data.idDistribusi
assert.equal((await api('DELETE', `/grup/${gid}/anggota/${c.id}`, undefined, utama.token)).status, 200)
const distBaru = (await api('GET', `/grup/${gid}`, undefined, utama.token)).data.idDistribusi
assert.notEqual(distLama, distBaru); ok('mengeluarkan anggota mengganti kunci grup')
assert.equal((await api('DELETE', `/grup/${gid}/anggota/${utama.id}`, undefined, utama.token)).status, 200); ok('admin grup boleh keluar bila masih ada admin lain')
assert.equal((await api('DELETE', `/grup/${gid}/anggota/${b.id}`, undefined, b.token)).status, 400); ok('admin grup terakhir tak bisa keluar')
assert.equal((await api('POST', `/admin/anggota/${b.id}/blokir`, undefined, a2.token)).status, 200); ok('admin memblokir anggota')
await tunggu(() => wb.ws.readyState === WebSocket.CLOSED); ok('koneksi live yang diblokir terputus')
assert.equal((await api('GET', '/anggota', undefined, b.token)).status, 401); ok('token yang diblokir tidak berlaku')
{ const r = await api('POST', '/auth/otp/minta', { nomorHp: N(4) }); assert.equal(r.status, 403); assert.equal(r.data.kodeDev, undefined); ok('yang diblokir tak bisa minta OTP') }
assert.equal((await api('POST', `/admin/anggota/${utama.id}/blokir`, undefined, a2.token)).status, 403); ok('admin utama tak bisa diblokir')
assert.equal((await api('POST', `/admin/anggota/${b.id}/buka-blokir`, undefined, a2.token)).status, 200); ok('buka blokir')
assert.equal((await api('DELETE', `/admin/anggota/${c.id}`, undefined, a2.token)).status, 403); ok('admin biasa tak bisa mengeluarkan permanen')
assert.equal((await api('DELETE', `/admin/anggota/${c.id}`, undefined, utama.token)).status, 200); ok('admin utama mengeluarkan anggota')
const sisa = await db.query(`SELECT count(*)::int n FROM "Anggota" WHERE id=$1`, [c.id])
assert.equal(sisa.rows[0].n, 0)
assert.equal((await api('DELETE', `/grup/${gid}`, undefined, c.token)).status, 401)
assert.equal((await api('DELETE', `/grup/${gid}`, undefined, a2.token)).status, 200); ok('admin menghapus grup')
assert.equal((await api('GET', `/grup/${gid}`, undefined, utama.token)).status, 404)

;[wa, wb, wc, wd].forEach((x) => x.ws.close())
await db.query(`DELETE FROM "Grup" WHERE nama LIKE 'UJI %'`)
await db.query(`DELETE FROM "Anggota" WHERE "nomorHp" LIKE '628110001%' OR "nomorHp" = '628111000109'`)
await db.end()
console.log(`\n${lulus} pemeriksaan lulus`)
process.exit(0)
