import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Anggota contoh untuk pengembangan (nomor fiktif). Data asli diimpor dari Pelayan AKTIF nanti.
const contoh = [
  { nomorHp: '6281100000001', nama: 'Pdt. Uji Satu', peran: 'ADMIN_UTAMA' as const },
  { nomorHp: '6281100000002', nama: 'Pdt. Uji Dua', peran: 'USER' as const },
  { nomorHp: '6281100000003', nama: 'St. Uji Tiga', peran: 'USER' as const },
  { nomorHp: '6281100000004', nama: 'Gr. Uji Empat', peran: 'USER' as const },
]

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  for (const a of contoh) {
    await prisma.anggota.upsert({ where: { nomorHp: a.nomorHp }, update: { nama: a.nama, peran: a.peran, status: 'AKTIF' }, create: { ...a, status: 'AKTIF' } })
  }
  console.log(`Seed selesai: ${contoh.length} anggota contoh`)
  await prisma.$disconnect()
  await pool.end()
}
main()
