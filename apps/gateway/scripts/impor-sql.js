// Impor pelayan ke tabel Anggota lewat SQL langsung (untuk dijalankan di dalam cluster, tanpa ts-node/Prisma).
// Membaca JSON dari stdin. Env: APK_URL (koneksi ke database apakabar), TERAPKAN=1 untuk menulis (default: simulasi/rollback),
// ADMIN_HP + ADMIN_NAMA (opsional) untuk menjadikan satu nomor ADMIN_UTAMA berstatus AKTIF.
// Aturan sama dengan prisma/impor.ts: anggota baru DIUNDANG; yang sudah ada hanya diperbarui namanya; tidak ada yang dihapus.
const { Client } = require('pg')
const { randomBytes } = require('crypto')

function normalkan(mentah) {
  let n = String(mentah || '').replace(/[^\d+]/g, '')
  if (n.startsWith('+')) n = n.slice(1)
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  return /^628\d{7,11}$/.test(n) ? n : null
}

async function main() {
  let masuk = ''
  for await (const c of process.stdin) masuk += c
  const baris = JSON.parse(masuk)
  const valid = new Map()
  let ditolak = 0
  let ganda = 0
  for (const b of baris) {
    const nomor = b.nomorHp ? normalkan(b.nomorHp) : null
    const nama = b.nama && b.nama.trim()
    if (!nomor || !nama) { ditolak++; continue }
    if (valid.has(nomor)) { ganda++; continue }
    valid.set(nomor, { nomor, nama, sumber: b.sumberPelayanId || null })
  }
  const terapkan = process.env.TERAPKAN === '1'
  const db = new Client({ connectionString: process.env.APK_URL })
  await db.connect()
  await db.query('BEGIN')
  try {
    const sebelum = (await db.query('SELECT count(*)::int n FROM "Anggota"')).rows[0].n
    const semua = [...valid.values()]
    for (let i = 0; i < semua.length; i += 500) {
      const lot = semua.slice(i, i + 500)
      await db.query(
        `INSERT INTO "Anggota"(id,"nomorHp",nama,"sumberPelayanId",status,peran,"diubahPada")
         SELECT x.id, x.hp, x.nama, x.sumber, 'DIUNDANG', 'USER', now()
         FROM unnest($1::text[],$2::text[],$3::text[],$4::text[]) AS x(id,hp,nama,sumber)
         ON CONFLICT ("nomorHp") DO UPDATE SET nama=EXCLUDED.nama, "sumberPelayanId"=EXCLUDED."sumberPelayanId", "diubahPada"=now()`,
        [lot.map(() => 'c' + randomBytes(12).toString('hex')), lot.map((a) => a.nomor), lot.map((a) => a.nama), lot.map((a) => a.sumber)],
      )
    }
    if (process.env.ADMIN_HP) {
      const hp = normalkan(process.env.ADMIN_HP)
      if (!hp) throw new Error('ADMIN_HP tidak valid')
      await db.query(
        `INSERT INTO "Anggota"(id,"nomorHp",nama,status,peran,"diubahPada") VALUES ($1,$2,$3,'AKTIF','ADMIN_UTAMA',now())
         ON CONFLICT ("nomorHp") DO UPDATE SET status='AKTIF', peran='ADMIN_UTAMA', "diubahPada"=now()`,
        ['c' + randomBytes(12).toString('hex'), hp, process.env.ADMIN_NAMA || 'Admin Utama'],
      )
    }
    const sesudah = (await db.query('SELECT count(*)::int n FROM "Anggota"')).rows[0].n
    const ringkas = (await db.query('SELECT status, peran, count(*)::int n FROM "Anggota" GROUP BY 1,2 ORDER BY 1,2')).rows
    console.log(`${terapkan ? 'DITERAPKAN' : 'SIMULASI (rollback)'} — ${baris.length} baris, valid ${valid.size}, ditolak ${ditolak}, nomor ganda ${ganda}`)
    console.log(`Anggota: ${sebelum} → ${sesudah}`)
    for (const r of ringkas) console.log(`  ${r.status} / ${r.peran}: ${r.n}`)
    await db.query(terapkan ? 'COMMIT' : 'ROLLBACK')
  } catch (e) {
    await db.query('ROLLBACK')
    throw e
  } finally {
    await db.end()
  }
}
main().catch((e) => { console.error('GALAT:', e.message); process.exit(1) })
