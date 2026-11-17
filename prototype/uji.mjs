// Relay palsu: server hanya melihat byte terenkripsi dan direktori prekey publik.
import assert from 'node:assert/strict'
import { Klien } from './klien.mjs'

const direktori = new Map() // nama -> paket publik
const antrean = new Map() // nama -> pesan ciphertext (yang dilihat server)
const kirim = (ke, dari, pesan) => {
  if (!antrean.has(ke)) antrean.set(ke, [])
  antrean.get(ke).push({ dari, pesan })
}
const ambil = ke => antrean.get(ke)?.splice(0) ?? []
// server membuang satu prekey sekali-pakai per permintaan
const ambilBundle = nama => {
  const p = direktori.get(nama)
  return { ...p, oneTime: p.oneTime.shift() ?? null }
}

const ani = new Klien('6281100000001')
const budi = new Klien('6281100000002')
const cici = new Klien('6281100000003')
for (const k of [ani, budi, cici]) direktori.set(k.nama, await k.daftar())

// 1:1 — Ani menulis ke Budi (X3DH + Double Ratchet)
await ani.mulaiSesi(ambilBundle(budi.nama))
kirim(budi.nama, ani.nama, await ani.enkripsi(budi.nama, 'Horas, Bang. Apa kabar?'))
let masuk = ambil(budi.nama)
assert.ok(!Buffer.from(masuk[0].pesan.isi).toString('utf8').includes('Horas'), 'server tidak boleh melihat isi')
console.log('Budi terima :', await budi.dekripsi(ani.nama, masuk[0].pesan), `(jenis ${masuk[0].pesan.jenis}: PreKey)`)

// Budi membalas (Double Ratchet berjalan, tanpa prekey lagi)
kirim(ani.nama, budi.nama, await budi.enkripsi(ani.nama, 'Horas! Baik, Lae.'))
masuk = ambil(ani.nama)
console.log('Ani terima  :', await ani.dekripsi(budi.nama, masuk[0].pesan), `(jenis ${masuk[0].pesan.jenis}: Whisper)`)

// Pesan tiba tidak berurutan
const a1 = await ani.enkripsi(budi.nama, 'satu')
const a2 = await ani.enkripsi(budi.nama, 'dua')
assert.equal(await budi.dekripsi(ani.nama, a2), 'dua')
assert.equal(await budi.dekripsi(ani.nama, a1), 'satu')
console.log('Pesan terbalik urutan: OK')

// Grup (Sender Keys): Ani, Budi, Cici
const idGrup = '11111111-2222-4333-8444-555555555555'
await ani.mulaiSesi(ambilBundle(cici.nama))
const dist = await ani.buatKunciGrup(idGrup)
// kunci grup dikirim lewat sesi 1:1 terenkripsi, bukan polos
const kunciKeBudi = await ani.enkripsi(budi.nama, Buffer.from(dist).toString('base64'))
const kunciKeCici = await ani.enkripsi(cici.nama, Buffer.from(dist).toString('base64'))
await budi.terimaKunciGrup(ani.nama, Buffer.from(await budi.dekripsi(ani.nama, kunciKeBudi), 'base64'))
await cici.terimaKunciGrup(ani.nama, Buffer.from(await cici.dekripsi(ani.nama, kunciKeCici), 'base64'))
const g = await ani.enkripsiGrup(idGrup, 'Rapat Resort Jumat jam 7 malam.') // satu ciphertext untuk semua
console.log('Budi (grup) :', await budi.dekripsiGrup(ani.nama, g))
console.log('Cici (grup) :', await cici.dekripsiGrup(ani.nama, g))

// Orang luar tanpa kunci grup tidak bisa membaca
const asing = new Klien('6281100000009')
await assert.rejects(asing.dekripsiGrup(ani.nama, g))
console.log('Orang luar ditolak: OK')
console.log('\nSEMUA UJI LULUS')
