// Uji ujung-ke-ujung: dua klien Signal sungguhan berbicara lewat gateway.
// Jalankan gateway dulu (npm run dev), lalu: npm run uji
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { Klien } from '../../../prototype/klien.mjs'
import * as S from '../../../prototype/node_modules/@signalapp/libsignal-client/dist/index.js'

const BASE = process.env.BASE ?? 'http://localhost:3101'
const b64 = (u) => Buffer.from(u).toString('base64')
const deb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))

async function api(metode, jalur, badan, token) {
  const res = await fetch(BASE + jalur, {
    method: metode,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: badan ? JSON.stringify(badan) : undefined,
  })
  const teks = await res.text()
  return { status: res.status, data: teks ? JSON.parse(teks) : null }
}

function paketUnggah(p) {
  return {
    regId: p.regId,
    identitas: b64(p.identitas),
    signedPreKey: { id: p.signedPreKey.id, pub: b64(p.signedPreKey.pub), sig: b64(p.signedPreKey.sig) },
    kyber: { id: p.kyber.id, pub: b64(p.kyber.pub), sig: b64(p.kyber.sig) },
    oneTime: p.oneTime.map((o) => ({ id: o.id, pub: b64(o.pub) })),
  }
}

async function masuk(nomorHp, klien) {
  const m = await api('POST', '/auth/otp/minta', { nomorHp })
  assert.equal(m.status, 200)
  assert.ok(m.data.kodeDev, 'mode dev harus menggemakan kode')
  const paket = await klien.daftar(5)
  const v = await api('POST', '/auth/otp/verifikasi', { nomorHp, kode: m.data.kodeDev, perangkat: paketUnggah(paket) })
  assert.equal(v.status, 200, JSON.stringify(v.data))
  // alamat Signal klien = id anggota di server
  klien.nama = v.data.anggota.id
  klien.addr = S.ProtocolAddress.new(klien.nama, 1)
  return { id: v.data.anggota.id, token: v.data.aksesToken, refresh: v.data.refreshToken, kode: m.data.kodeDev }
}

function sambung(token) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws?token=${token}`)
  const masuk = []
  const terkirim = []
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString())
    if (m.t === 'masuk') masuk.push(m)
    if (m.t === 'terkirim') terkirim.push(m)
  })
  const buka = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); ws.on('close', (c) => rej(new Error('ditutup ' + c))) })
  const tunggu = async (fn, ms = 4000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { const r = fn(); if (r) return r; await new Promise((r) => setTimeout(r, 40)) }
    throw new Error('waktu habis menunggu pesan')
  }
  const kirim = (untuk, jenis, isi, idKlien) => ws.send(JSON.stringify({ event: 'kirim', data: { untuk, jenis, isi, idKlien } }))
  const ack = (id) => ws.send(JSON.stringify({ event: 'ack', data: { id } }))
  return { ws, buka, masuk, terkirim, tunggu, kirim, ack }
}

let n = 0
const ok = (s) => console.log(`  ok ${++n}. ${s}`)

const A = new Klien('x')
const B = new Klien('y')

// 1. Nomor di luar daftar: ditolak, tanpa kode
const luar = await api('POST', '/auth/otp/minta', { nomorHp: '6289999999999' })
assert.equal(luar.status, 403)
assert.equal(luar.data.message, 'Maaf, Anda tidak terdaftar.')
assert.equal(luar.data.kodeDev, undefined)
ok('nomor di luar daftar ditolak "tidak terdaftar" & tidak mendapat kode')

// 2. OTP salah ditolak
await api('POST', '/auth/otp/minta', { nomorHp: '081100000004' })
const salah = await api('POST', '/auth/otp/verifikasi', {
  nomorHp: '081100000004', kode: '000000', perangkat: paketUnggah(await new Klien('z').daftar(1)),
})
assert.equal(salah.status, 401)
ok('kode OTP salah ditolak')

// 3. Masuk dua anggota (nomor dinormalkan dari format 08…)
const a = await masuk('081100000002', A)
const b = await masuk('6281100000003', B)
ok('dua anggota masuk lewat OTP dan mengunggah kunci publik')

// 4. OTP tak bisa dipakai ulang
const ulang = await api('POST', '/auth/otp/verifikasi', {
  nomorHp: '081100000002', kode: a.kode, perangkat: paketUnggah(await new Klien('w').daftar(1)),
})
assert.equal(ulang.status, 401)
ok('OTP yang sudah dipakai tidak bisa dipakai ulang')

// 5. Tanpa token ditolak; direktori hanya untuk anggota
assert.equal((await api('GET', '/anggota')).status, 401)
const dir = await api('GET', '/anggota', null, a.token)
assert.equal(dir.status, 200)
assert.ok(dir.data.some((x) => x.id === b.id) && !dir.data.some((x) => x.id === a.id))
ok('direktori tertutup; berisi anggota aktif lain saja')

// 6. A mengambil prekey B, memulai sesi, mengirim saat B OFFLINE
const ambil = await api('POST', `/prekey/ambil/${b.id}`, null, a.token)
assert.equal(ambil.status, 200)
const pb = ambil.data
await A.mulaiSesi({
  nama: b.id, deviceId: pb.deviceId, regId: pb.regId, identitas: deb64(pb.identitas),
  signedPreKey: { id: pb.signedPreKey.id, pub: deb64(pb.signedPreKey.pub), sig: deb64(pb.signedPreKey.sig) },
  kyber: { id: pb.kyber.id, pub: deb64(pb.kyber.pub), sig: deb64(pb.kyber.sig) },
  oneTime: pb.oneTime ? { id: pb.oneTime.id, pub: deb64(pb.oneTime.pub) } : null,
})
const sisa = await api('GET', '/prekey/sisa', null, b.token)
assert.equal(sisa.data.jumlah, 4)
ok('prekey sekali-pakai dihabiskan saat diambil (5 → 4)')

const wsA = sambung(a.token)
await wsA.buka
const c1 = await A.enkripsi(b.id, 'Horas, Amang! Ini pesan pertama.')
assert.equal(c1.jenis, 3)
wsA.kirim(b.id, c1.jenis, b64(c1.isi), 'm1')
await wsA.tunggu(() => wsA.terkirim.find((t) => t.idKlien === 'm1'))
ok('A mengirim saat B offline; server memberi tanda terima')

// 7. B online → menerima dari antrean, mendekripsi, membalas
const wsB = sambung(b.token)
await wsB.buka
const m1 = await wsB.tunggu(() => wsB.masuk.find((m) => m.dari === a.id))
const teks1 = await B.dekripsi(a.id, { jenis: m1.jenis, isi: deb64(m1.isi) })
assert.equal(teks1, 'Horas, Amang! Ini pesan pertama.')
wsB.ack(m1.id)
ok('B menerima dari antrean offline dan berhasil mendekripsi')

const c2 = await B.enkripsi(a.id, 'Horas! Pesan diterima.')
wsB.kirim(a.id, c2.jenis, b64(c2.isi), 'm2')
const m2 = await wsA.tunggu(() => wsA.masuk.find((m) => m.dari === b.id))
assert.equal(await A.dekripsi(b.id, { jenis: m2.jenis, isi: deb64(m2.isi) }), 'Horas! Pesan diterima.')
wsA.ack(m2.id)
ok('balasan B sampai ke A secara langsung (Double Ratchet berjalan)')

// 8. Kirim ulang idKlien sama tidak menggandakan
wsA.kirim(b.id, c1.jenis, b64(c1.isi), 'm1')
await new Promise((r) => setTimeout(r, 400))
assert.equal(wsB.masuk.filter((m) => m.dari === a.id).length, 1)
ok('pengiriman ulang dengan idKlien sama tidak menggandakan pesan')

// 9. Server tidak punya plaintext: isi di antrean/transit hanyalah ciphertext
assert.ok(!Buffer.from(m1.isi, 'base64').toString('utf8').includes('Horas'))
ok('isi yang lewat server adalah ciphertext (tidak memuat teks asli)')

wsA.ws.close()
wsB.ws.close()
console.log(`\nSEMUA ${n} PENGUJIAN LULUS`)
process.exit(0)
