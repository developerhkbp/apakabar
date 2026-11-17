// Ekspor READ-ONLY pelayan AKTIF dari superapp → data/pelayan.json (berisi data pribadi, di-gitignore).
const { Pool } = require('pg')
const fs = require('fs')
const env = fs.readFileSync('D:/Documents/HKBP/hkbp.or.id/apps/api/.env', 'utf8')
const url = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)[1].replace(/\?.*$/, '')
;(async () => {
  const pool = new Pool({ connectionString: url, max: 1 })
  const c = await pool.connect()
  try {
    await c.query('BEGIN READ ONLY')
    const r = await c.query(`SELECT id, nama, "gelarDepan", hp, hp2 FROM "Pelayan" WHERE status = 'AKTIF'`)
    await c.query('ROLLBACK')
    const hasil = r.rows.map(p => ({
      sumberPelayanId: p.id,
      nama: [p.gelarDepan, p.nama].filter(Boolean).join(' ').trim(),
      nomorHp: p.hp || p.hp2 || '',
    }))
    fs.writeFileSync('data/pelayan.json', JSON.stringify(hasil, null, 1))
    console.log('total aktif:', hasil.length, '| tanpa hp:', hasil.filter(h => !h.nomorHp).length)
  } finally { c.release(); await pool.end() }
})().catch(e => { console.error(e.message); process.exit(1) })
