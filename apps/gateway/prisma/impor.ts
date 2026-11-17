import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

/**
 * Impor pelayan ke tabel Anggota dari berkas JSON hasil ekspor (read-only dari superapp).
 *   npm run impor -- berkas.json            → simulasi (tidak menulis apa pun)
 *   npm run impor -- berkas.json --terapkan → menulis ke database
 * Format berkas: [{ "nomorHp": "0812...", "nama": "Pdt. ...", "sumberPelayanId": "..." }]
 * Anggota baru berstatus DIUNDANG. Anggota yang sudah ada hanya diperbarui namanya;
 * status dan peran tidak pernah diubah oleh skrip ini, dan tidak ada yang dihapus.
 */

type Baris = { nomorHp?: string; nama?: string; sumberPelayanId?: string }

/** Menormalkan ke E.164 tanpa plus (62...). Mengembalikan null bila bukan nomor Indonesia yang masuk akal. */
export function normalkanNomor(mentah: string): string | null {
  let n = mentah.replace(/[^\d+]/g, '')
  if (n.startsWith('+')) n = n.slice(1)
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  if (!/^628\d{7,11}$/.test(n)) return null
  return n
}

async function main() {
  const [berkas, ...opsi] = process.argv.slice(2)
  if (!berkas) throw new Error('Pemakaian: npm run impor -- berkas.json [--terapkan]')
  const terapkan = opsi.includes('--terapkan')

  const baris: Baris[] = JSON.parse(readFileSync(berkas, 'utf8'))
  const valid = new Map<string, { nomorHp: string; nama: string; sumberPelayanId?: string }>()
  const ditolak: string[] = []
  const ganda: string[] = []

  baris.forEach((b, i) => {
    const nomor = b.nomorHp ? normalkanNomor(b.nomorHp) : null
    const nama = b.nama?.trim()
    if (!nomor || !nama) {
      ditolak.push(`baris ${i + 1}: ${nama ?? '(tanpa nama)'} — nomor "${b.nomorHp ?? ''}" tidak valid`)
      return
    }
    if (valid.has(nomor)) {
      ganda.push(`baris ${i + 1}: ${nama} — nomor ${nomor} sudah dipakai ${valid.get(nomor)!.nama}`)
      return
    }
    valid.set(nomor, { nomorHp: nomor, nama, sumberPelayanId: b.sumberPelayanId })
  })

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  const ada = new Map((await prisma.anggota.findMany({ select: { nomorHp: true, nama: true } })).map(a => [a.nomorHp, a.nama]))

  let baru = 0
  let diperbarui = 0
  let sama = 0
  for (const a of valid.values()) {
    const lama = ada.get(a.nomorHp)
    if (lama === undefined) baru++
    else if (lama !== a.nama) diperbarui++
    else sama++
    if (terapkan) {
      await prisma.anggota.upsert({
        where: { nomorHp: a.nomorHp },
        update: { nama: a.nama, sumberPelayanId: a.sumberPelayanId },
        create: { nomorHp: a.nomorHp, nama: a.nama, sumberPelayanId: a.sumberPelayanId },
      })
    }
  }

  console.log(`${terapkan ? 'DITERAPKAN' : 'SIMULASI'} — ${baris.length} baris`)
  console.log(`  baru: ${baru}, nama diperbarui: ${diperbarui}, tidak berubah: ${sama}`)
  console.log(`  ditolak: ${ditolak.length}, nomor ganda: ${ganda.length}`)
  ditolak.slice(0, 20).forEach(s => console.log('   ✗ ' + s))
  ganda.slice(0, 20).forEach(s => console.log('   ⚠ ' + s))
  if (!terapkan) console.log('Tambahkan --terapkan untuk menulis ke database.')

  await prisma.$disconnect()
  await pool.end()
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1) })
