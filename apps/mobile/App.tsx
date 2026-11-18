import { StatusBar } from 'expo-status-bar'
import Signal from './modules/signal-protocol/src'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  adaOnline, adminRingkasan, daftarAnggota, daftarGrup, detailGrup, keluar, kunciGrup, mintaOtp, muatRiwayat, muatSesi, Obrolan,
  profilAnggota, simpanRiwayat, sudahOnboarding, tandaiOnboarding, ubahFotoGrup, ubahFotoSaya, verifikasi, versiFotoSaya,
  GalatApi, type Anggota, type DetailGrup, type Pesan, type RingkasGrup, type Riwayat, type Sesi,
} from './src/server'
import { awalNama, EMAS_TUA, s, setTemaAdmin, waktuDaftar } from './src/gaya'
import { Menunggu } from './src/layar/Menunggu'
import { Admin } from './src/layar/Admin'
import { BuatGrup, InfoGrup } from './src/layar/Grup'
import { buka, bungkus, bungkusLampiran, cuplikanBalas, denganBalasan, ringkas, untukDiteruskan } from './src/konten'
import { unggahSemua } from './src/lampiran'
import { Galeri } from './src/layar/Galeri'
import { ambilPratinjau, cariTautan } from './src/pratinjau'
import { Percakapan } from './src/layar/Percakapan'
import { Teruskan } from './src/layar/Teruskan'
import { Avatar, setTokenFoto } from './src/avatar'
import { Profil } from './src/layar/Profil'
import { Kontak } from './src/layar/Kontak'
import { InfoPesan } from './src/layar/InfoPesan'
import { MenuPesan, type ItemMenu } from './src/layar/MenuPesan'
import { Onboarding } from './src/layar/Onboarding'
import { Pengaturan } from './src/layar/Pengaturan'
import { Logo, Wordmark } from './src/logo'

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInti />
    </SafeAreaProvider>
  )
}

function AppInti() {
  const [sesi, setSesi] = useState<Sesi | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [perkenalan, setPerkenalan] = useState(false)
  useEffect(() => {
    Promise.all([muatSesi(), sudahOnboarding()]).then(([x, sudah]) => { setSesi(x); setPerkenalan(!x && !sudah); setMemuat(false) })
  }, [])
  const keluarDariPerangkat = useCallback(async () => { await keluar(); setSesi(null) }, [])
  if (memuat) return <View style={s.root} />
  if (!sesi && perkenalan) return <Onboarding selesai={() => { tandaiOnboarding(); setPerkenalan(false) }} />
  if (!sesi) return <Masuk onMasuk={setSesi} />
  if (sesi.status === 'MENUNGGU') return <Menunggu sesi={sesi} onAktif={setSesi} onKeluar={keluarDariPerangkat} />
  return <Utama sesi={sesi} onKeluar={keluarDariPerangkat} />
}

function Masuk({ onMasuk }: { onMasuk: (x: Sesi) => void }) {
  const [nomor, setNomor] = useState('')
  const [kode, setKode] = useState('')
  const [tahap, setTahap] = useState<'nomor' | 'kode'>('nomor')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')

  const jalan = async (fn: () => Promise<void>) => {
    setSibuk(true)
    setGalat('')
    try { await fn() } catch (e) { setGalat((e as Error).message) } finally { setSibuk(false) }
  }

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <View style={s.masukIsi}>
        <View style={{ alignItems: 'center', marginBottom: 20, gap: 10 }}><Logo ukuran={88} /><Wordmark tinggi={40} varian="gelap" /></View>
        <Text style={s.masukJudul}>Masukkan nomor WhatsApp Anda</Text>
        <Text style={s.masukUrai}>
          {tahap === 'nomor'
            ? 'Kode verifikasi akan dikirim ke nomor WhatsApp Anda.'
            : 'Masukkan kode 6 digit yang dikirim ke WhatsApp Anda.'}
        </Text>
        {tahap === 'nomor' ? (
          <TextInput style={s.input} value={nomor} onChangeText={setNomor} placeholder="Nomor WhatsApp, mis. 0812xxxxxxx" keyboardType="phone-pad" autoFocus />
        ) : (
          <TextInput style={[s.input, { letterSpacing: 8, textAlign: 'center' }]} value={kode} onChangeText={setKode} placeholder="------" keyboardType="number-pad" maxLength={6} autoFocus />
        )}
        {info ? <Text style={s.info}>{info}</Text> : null}
        {galat ? <Text style={s.galat}>{galat}</Text> : null}
        <Pressable
          style={[s.tombol, sibuk && { opacity: 0.5 }]}
          disabled={sibuk}
          onPress={() => jalan(async () => {
            if (tahap === 'nomor') {
              const r = await mintaOtp(nomor)
              if (r.kodeDev) setInfo(`(mode uji) kode: ${r.kodeDev}`)
              setTahap('kode')
            } else {
              onMasuk(await verifikasi(nomor, kode))
            }
          })}
        >
          {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={s.tombolTeks}>{tahap === 'nomor' ? 'Berikutnya' : 'Verifikasi'}</Text>}
        </Pressable>
      </View>
    </View>
  )
}

type Layar =
  | { j: 'daftar' }
  | { j: 'orang'; anggota: Anggota }
  | { j: 'grup'; grup: RingkasGrup }
  | { j: 'infoGrup'; grup: RingkasGrup }
  | { j: 'galeri'; grup: RingkasGrup }
  | { j: 'kontak' }
  | { j: 'profil'; jenis: 'saya' | 'anggota' | 'grup'; anggota?: Anggota; grup?: RingkasGrup; balik: Layar }
  | { j: 'teruskan'; isi: string; kunciAsal: string; balik: Layar }
  | { j: 'infoPesan'; kunci: string; id: string; grup?: RingkasGrup; lawan?: Anggota; balik: Layar }
  | { j: 'buatGrup' }
  | { j: 'admin' }
  | { j: 'pengaturan' }

/** Teks yang akan dienkripsi: bila memuat tautan, metadata situs diambil di perangkat ini dan ikut dikirim. */
async function siapkanIsi(teks: string): Promise<string> {
  const url = cariTautan(teks)
  if (!url) return teks
  return bungkus(teks, await ambilPratinjau(url))
}

function Utama({ sesi, onKeluar }: { sesi: Sesi; onKeluar: () => void }) {
  const [peran, setPeran] = useState(sesi.peran ?? 'USER')
  const [anggota, setAnggota] = useState<Anggota[]>([])
  const [grup, setGrup] = useState<RingkasGrup[]>([])
  const [menunggu, setMenunggu] = useState(0)
  const [pesan, setPesan] = useState<Riwayat>({})
  const [dimuat, setDimuat] = useState(false)
  const [belumBaca, setBelumBaca] = useState<Record<string, number>>({})
  const [layar, setLayar] = useState<Layar>({ j: 'daftar' })
  const [menu, setMenu] = useState(false)
  const [online, setOnline] = useState<Record<string, boolean>>({})
  const [menuPesan, setMenuPesan] = useState<ItemMenu[] | null>(null)
  const [fotoSaya, setFotoSaya] = useState(0)
  const insets = useSafeAreaInsets()
  /** Pesan yang sedang dibalas di percakapan `kunci`. */
  const [balasan, setBalasan] = useState<{ kunci: string; p: Pesan } | null>(null)
  const [cari, setCari] = useState('')
  const [tersambung, setTersambung] = useState(false)
  const obrolan = useRef<Obrolan | null>(null)
  const layarRef = useRef<Layar>(layar)
  layarRef.current = layar
  const adalahAdmin = peran !== 'USER'
  setTokenFoto(sesi.token)
  useEffect(() => { versiFotoSaya(sesi.token, sesi.id).then(r => setFotoSaya(r.fotoV)).catch(() => {}) }, [sesi.token])
  setTemaAdmin(adalahAdmin) // header emas untuk admin (dipasang sebelum layar anak dirender)
  useEffect(() => () => setTemaAdmin(false), [])

  const tambah = (kunci: string, p: Pesan) => setPesan(x => ({ ...x, [kunci]: [...(x[kunci] ?? []), p] }))
  const hapusLokal = (kunci: string, id: string) => setPesan(x => ({ ...x, [kunci]: (x[kunci] ?? []).filter(p => p.id !== id) }))

  /** Mengirim isi ke percakapan (kunci orang atau `g:<id>`). Gagal → pesan ditandai ⚠ dan bisa dikirim ulang. */
  const kirimKe = async (kunci: string, isi: string, diam = false) => {
    try {
      const o = obrolan.current!
      if (kunci.startsWith('g:')) {
        const d: DetailGrup = await detailGrup(sesi.token, kunci.slice(2)) // daftar anggota & kunci grup terbaru
        tambah(kunci, await o.kirimGrup({ id: d.id, idDistribusi: d.idDistribusi, anggotaIds: d.anggota.map(a => a.id) }, isi))
      } else {
        tambah(kunci, await o.kirim(kunci, isi))
      }
    } catch (e) {
      const jaringan = e instanceof GalatApi && e.status === 0
      if (!diam) Alert.alert('Pesan belum terkirim', ((e as Error)?.message || String(e)) + ' Ketuk pesan bertanda ⚠ untuk mengirim ulang.')
      tambah(kunci, { id: String(Date.now()), dari: sesi.id, teks: isi, waktu: Date.now(), saya: true, status: 'gagal', gagalJaringan: jaringan })
    }
  }
  /** Bila ada pesan yang sedang dibalas di percakapan ini, sisipkan kutipannya lalu tutup bilah balasan. */
  const denganBalas = (kunci: string, isi: string) => {
    if (!balasan || balasan.kunci !== kunci || !balasan.p.ref) return isi
    const hasil = denganBalasan(isi, { r: balasan.p.ref, d: balasan.p.dari, c: cuplikanBalas(balasan.p.teks) })
    setBalasan(null)
    return hasil
  }
  const kirimUlang = async (kunci: string, p: Pesan, diam = false) => {
    hapusLokal(kunci, p.id)
    await kirimKe(kunci, p.teks, diam)
  }
  /** Menu hapus: untuk diri sendiri selalu ada; untuk semua hanya bila berwenang. */
  const menuHapus = (kunci: string, p: Pesan, untukSemua?: { keterangan: string; jalankan: () => void }) =>
    Alert.alert('Hapus pesan?', undefined, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus untuk saya', onPress: () => hapusLokal(kunci, p.id) },
      ...(untukSemua ? [{ text: 'Hapus untuk semua', style: 'destructive' as const, onPress: untukSemua.jalankan }] : []),
    ])
  const namaAnggota = useMemo(() => new Map(anggota.map(a => [a.id, a.nama])), [anggota])
  // Nama anggota grup yang belum/tidak aktif (mis. sudah dikeluarkan) diambil dari detail grup saat grup dibuka.
  const [namaGrup, setNamaGrup] = useState<Record<string, string>>({})
  const grupTerbuka = layar.j === 'grup' ? layar.grup.id : null
  useEffect(() => {
    if (!grupTerbuka) return
    detailGrup(sesi.token, grupTerbuka)
      .then(d => setNamaGrup(x => ({ ...x, ...Object.fromEntries(d.anggota.map(a => [a.id, a.nama])) })))
      .catch(() => {})
  }, [grupTerbuka, sesi.token])

  // Riwayat dimuat dari brankas terenkripsi dan disimpan kembali setiap ada perubahan.
  useEffect(() => { muatRiwayat().then(r => { setPesan(x => ({ ...r, ...x })); setDimuat(true) }) }, [])
  useEffect(() => {
    if (!dimuat) return
    const t = setTimeout(() => { simpanRiwayat(pesan).catch(() => {}) }, 400)
    return () => clearTimeout(t)
  }, [pesan, dimuat])

  const muatGrup = useCallback(() => daftarGrup(sesi.token).then(setGrup).catch(() => {}), [sesi.token])

  useEffect(() => {
    const o = new Obrolan(sesi)
    obrolan.current = o
    o.onSesiBerakhir = onKeluar
    o.onKoneksi = setTersambung
    o.onPeran = setPeran
    o.onPesan = p => {
      tambah(p.dari, p)
      const l = layarRef.current
      if (!(l.j === 'orang' && l.anggota.id === p.dari)) setBelumBaca(b => ({ ...b, [p.dari]: (b[p.dari] ?? 0) + 1 }))
    }
    o.onPesanGrup = (grupId, p) => {
      const k = kunciGrup(grupId)
      tambah(k, p)
      const l = layarRef.current
      if (!(l.j === 'grup' && l.grup.id === grupId)) setBelumBaca(b => ({ ...b, [k]: (b[k] ?? 0) + 1 }))
    }
    o.onHapus = (k, pengirimId, ref) => {
      setPesan(x => ({ ...x, [k]: (x[k] ?? []).map(p => (p.dari === pengirimId && p.ref === ref ? { ...p, teks: '', dihapus: true } : p)) }))
    }
    o.onGrupBerubah = () => {
      muatGrup()
      // grup yang sedang dibuka dihapus atau saya dikeluarkan → kembali ke daftar
      const l = layarRef.current
      if (l.j === 'grup' || l.j === 'infoGrup') {
        daftarGrup(sesi.token).then(g => { if (!g.some(x => x.id === l.grup.id)) setLayar({ j: 'daftar' }) }).catch(() => {})
      }
    }
    o.onTanda = (kunci, ref, oleh, t, waktu) =>
      setPesan(x => ({ ...x, [kunci]: (x[kunci] ?? []).map(p => p.saya && p.ref === ref
        ? { ...p, terima: { ...p.terima, [oleh]: p.terima?.[oleh] ?? waktu }, ...(t === 'baca' ? { baca: { ...p.baca, [oleh]: waktu } } : {}) }
        : p) }))
    o.onStatus = (idKlien, status) =>
      setPesan(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v.map(p => (p.id === idKlien ? { ...p, status } : p))])))
    o.sambung()
    const muat = () => daftarAnggota(sesi.token).then(setAnggota).catch(() => {})
    muat()
    muatGrup()
    const t = setInterval(muat, 15000)
    return () => { clearInterval(t); o.putus() }
  }, [sesi, muatGrup])

  // Admin: jumlah permohonan yang menunggu persetujuan
  useEffect(() => {
    if (!adalahAdmin) return
    const muat = () => adminRingkasan(sesi.token).then(r => setMenunggu(r.MENUNGGU ?? 0)).catch(() => {})
    muat()
    const t = setInterval(muat, 15000)
    return () => clearInterval(t)
  }, [adalahAdmin, sesi.token])

  // Ketuk notifikasi "menunggu persetujuan" → langsung buka layar admin (saat aplikasi dibuka atau kembali aktif)
  useEffect(() => {
    if (!adalahAdmin) return
    const cek = () => { if (Signal.tujuanNotifikasi() === 'persetujuan') setLayar({ j: 'admin' }) }
    cek()
    const l = AppState.addEventListener('change', st => { if (st === 'active') cek() })
    return () => l.remove()
  }, [adalahAdmin])

  const sesiSaya = { ...sesi, peran }

  // Kirim ulang otomatis pesan yang gagal karena jaringan begitu koneksi pulih.
  useEffect(() => {
    if (!tersambung || !dimuat) return
    const tertunda = Object.entries(pesan).flatMap(([kunci, daftar]) => daftar.filter(p => p.saya && p.status === 'gagal' && p.gagalJaringan).map(p => [kunci, p] as const))
    for (const [kunci, p] of tertunda) kirimUlang(kunci, p, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tersambung, dimuat])

  // Status online lawan bicara di percakapan yang terbuka (diperbarui tiap 15 detik).
  const idLawan = layar.j === 'orang' ? layar.anggota.id : layar.j === 'profil' && layar.jenis === 'anggota' && layar.anggota ? layar.anggota.id : null
  useEffect(() => {
    if (!idLawan || !tersambung) return
    let batal = false
    const cek = () => adaOnline(sesi.token, idLawan).then(v => { if (!batal) setOnline(x => ({ ...x, [idLawan]: v })) }).catch(() => {})
    cek()
    const t = setInterval(cek, 15000)
    return () => { batal = true; clearInterval(t) }
  }, [idLawan, tersambung, sesi.token])

  // Percakapan yang sedang terbuka: laporkan pesan masuk yang sudah terlihat sebagai "dibaca".
  const kunciTerbuka = layar.j === 'orang' ? layar.anggota.id : layar.j === 'grup' ? kunciGrup(layar.grup.id) : null
  useEffect(() => {
    if (!kunciTerbuka || !tersambung) return
    const baru = (pesan[kunciTerbuka] ?? []).filter(p => !p.saya && p.ref && !p.dilapor && !p.dihapus)
    if (!baru.length) return
    const perPengirim: Record<string, string[]> = {}
    for (const p of baru) (perPengirim[p.dari] ??= []).push(p.ref!)
    for (const [dari, refs] of Object.entries(perPengirim)) obrolan.current?.laporBaca(dari, refs)
    const ids = new Set(baru.map(p => p.id))
    setPesan(x => ({ ...x, [kunciTerbuka]: (x[kunciTerbuka] ?? []).map(p => (ids.has(p.id) ? { ...p, dilapor: true } : p)) }))
  }, [kunciTerbuka, pesan, tersambung])

  /** Menu tekan-lama: Info pesan (pesan sendiri), hapus untuk saya, hapus untuk semua bila berwenang. */
  const bukaMenu = (kunci: string, p: Pesan, info: Layar, untukSemua?: () => void) => {
    const item: ItemMenu[] = []
    if (!p.dihapus && p.status !== 'gagal') {
      if (p.ref) item.push({ label: 'Balas', aksi: () => setBalasan({ kunci, p }) })
      item.push({ label: 'Teruskan', aksi: () => setLayar({ j: 'teruskan', isi: p.teks, kunciAsal: kunci, balik: layarRef.current }) })
    }
    if (p.saya && p.status !== 'gagal') item.push({ label: 'Info pesan', aksi: () => setLayar(info) })
    item.push({ label: 'Hapus untuk saya', aksi: () => hapusLokal(kunci, p.id) })
    if (untukSemua) item.push({ label: 'Hapus untuk semua', bahaya: true, aksi: untukSemua })
    setMenuPesan(item)
  }

  if (layar.j === 'orang') {
    const lawan = layar.anggota
    return (
      <View style={{ flex: 1 }}>
      <Percakapan
        jumlahPenerima={1}
        fotoPengirim={() => <Avatar jenis="anggota" id={lawan.id} v={anggota.find(a => a.id === lawan.id)?.fotoV} nama={lawan.nama} ukuran={28} />}
        avatar={<Avatar jenis="anggota" id={lawan.id} v={anggota.find(a => a.id === lawan.id)?.fotoV} nama={lawan.nama} ukuran={36} />}
        bukaInfo={() => setLayar({ j: 'profil', jenis: 'anggota', anggota: lawan, balik: layar })}
        judul={lawan.nama}
        daftar={pesan[lawan.id] ?? []}
        kembali={() => setLayar({ j: 'daftar' })}
        ambil={l => obrolan.current!.ambilBerkas(l)}
        kirimLampiran={async (teks, berkas, progres) => {
          const isi = bungkusLampiran(teks, await unggahSemua(u => obrolan.current!.unggahBerkas(u), berkas, progres))
          await kirimKe(lawan.id, denganBalas(lawan.id, isi))
        }}
        tekanLama={p => bukaMenu(lawan.id, p, { j: 'infoPesan', kunci: lawan.id, id: p.id, lawan, balik: layar }, p.saya && p.ref && p.status !== 'gagal' ? () => obrolan.current?.hapusPesanPribadi(lawan.id, p.ref!) : undefined)}
        kirim={async teks => { await kirimKe(lawan.id, denganBalas(lawan.id, await siapkanIsi(teks))) }}
        kirimUlang={p => kirimUlang(lawan.id, p)}
        subjudul={online[lawan.id] ? 'online' : undefined}
        balasan={balasan?.kunci === lawan.id ? balasan.p : null}
        batalBalas={() => setBalasan(null)}
        namaBalas={id => (id === sesi.id ? 'Anda' : lawan.nama)}
      />
      {menuPesan ? <MenuPesan item={menuPesan} tutup={() => setMenuPesan(null)} /> : null}
      </View>
    )
  }

  if (layar.j === 'grup') {
    const g = layar.grup
    const k = kunciGrup(g.id)
    return (
      <View style={{ flex: 1 }}>
      <Percakapan
        jumlahPenerima={Math.max(1, g.jumlah - 1)}
        fotoPengirim={id => <Avatar jenis="anggota" id={id} v={anggota.find(a => a.id === id)?.fotoV} nama={namaAnggota.get(id) ?? namaGrup[id] ?? 'Anggota'} ukuran={28} />}
        avatar={<Avatar jenis="grup" id={g.id} v={grup.find(x => x.id === g.id)?.fotoV} nama={g.nama} ukuran={36} />}
        judul={g.nama}
        subjudul={`${g.jumlah} anggota`}
        grup
        daftar={pesan[k] ?? []}
        kembali={() => setLayar({ j: 'daftar' })}
        bukaInfo={() => setLayar({ j: 'infoGrup', grup: g })}
        ambil={l => obrolan.current!.ambilBerkas(l)}
        kirimLampiran={async (teks, berkas, progres) => {
          const isi = bungkusLampiran(teks, await unggahSemua(u => obrolan.current!.unggahBerkas(u), berkas, progres))
          await kirimKe(k, denganBalas(k, isi))
        }}
        namaPengirim={id => namaAnggota.get(id) ?? namaGrup[id] ?? 'Anggota'}
        tekanLama={p => {
          // Server memeriksa ulang wewenangnya; di sini hanya menentukan apakah pilihan ditampilkan.
          const berwenang = (p.saya || adalahAdmin || g.peranSaya === 'ADMIN_GRUP') && !!p.ref
          bukaMenu(k, p, { j: 'infoPesan', kunci: k, id: p.id, grup: g, balik: layar }, berwenang ? () => obrolan.current?.hapusPesanGrup(g.id, p.dari, p.ref!) : undefined)
        }}
        kirim={async teks => { await kirimKe(k, denganBalas(k, await siapkanIsi(teks))) }}
        kirimUlang={p => kirimUlang(k, p)}
        balasan={balasan?.kunci === k ? balasan.p : null}
        batalBalas={() => setBalasan(null)}
        namaBalas={id => (id === sesi.id ? 'Anda' : namaAnggota.get(id) ?? namaGrup[id] ?? 'Anggota')}
      />
      {menuPesan ? <MenuPesan item={menuPesan} tutup={() => setMenuPesan(null)} /> : null}
      </View>
    )
  }

  if (layar.j === 'teruskan') {
    const t = layar
    return (
      <Teruskan
        anggota={anggota}
        grup={grup}
        isi={t.isi}
        kunciAsal={t.kunciAsal}
        kembali={() => setLayar(t.balik)}
        kirim={async tujuan => {
          const isi = untukDiteruskan(t.isi)
          for (const kunci of tujuan) await kirimKe(kunci, isi, true)
          setLayar(t.balik)
        }}
      />
    )
  }

  if (layar.j === 'infoPesan') {
    const p = (pesan[layar.kunci] ?? []).find(x => x.id === layar.id)
    if (!p) return <View style={{ flex: 1 }} />
    return <InfoPesan token={sesi.token} p={p} grupId={layar.grup?.id} lawan={layar.lawan} saya={sesi.id} kembali={() => setLayar(layar.balik)} />
  }

  if (layar.j === 'infoGrup') {
    const g = layar.grup
    return (
      <InfoGrup
        sesi={sesiSaya}
        grupId={g.id}
        anggota={anggota}
        kembali={() => setLayar({ j: 'grup', grup: g })}
        jumlahMedia={(pesan[kunciGrup(g.id)] ?? []).reduce((n, p) => n + (p.dihapus ? 0 : (buka(p.teks).lampiran?.length ?? 0)), 0)}
        bukaGaleri={() => setLayar({ j: 'galeri', grup: g })}
        bukaProfilGrup={() => setLayar({ j: 'profil', jenis: 'grup', grup: g, balik: layar })}
        bubar={() => { muatGrup(); setLayar({ j: 'daftar' }) }}
      />
    )
  }

  if (layar.j === 'galeri') {
    const g = layar.grup
    return (
      <Galeri
        judul={g.nama}
        daftar={pesan[kunciGrup(g.id)] ?? []}
        namaPengirim={id => namaAnggota.get(id) ?? namaGrup[id] ?? 'Anggota'}
        ambil={l => obrolan.current!.ambilBerkas(l)}
        kembali={() => setLayar({ j: 'infoGrup', grup: g })}
      />
    )
  }

  if (layar.j === 'buatGrup') {
    return (
      <BuatGrup
        sesi={sesiSaya}
        anggota={anggota}
        kembali={() => setLayar({ j: 'daftar' })}
        selesai={d => {
          muatGrup()
          setLayar({ j: 'grup', grup: { id: d.id, nama: d.nama, idDistribusi: d.idDistribusi, jumlah: d.anggota.length, peranSaya: 'ADMIN_GRUP' } })
        }}
      />
    )
  }

  if (layar.j === 'pengaturan') {
    return <Pengaturan sesi={sesiSaya} fotoV={fotoSaya} bukaProfil={() => setLayar({ j: 'profil', jenis: 'saya', balik: layar })} kembali={() => setLayar({ j: 'daftar' })} keluar={onKeluar} />
  }

  if (layar.j === 'kontak') {
    return <Kontak anggota={anggota} kembali={() => setLayar({ j: 'daftar' })} pilih={a => setLayar({ j: 'orang', anggota: a })} />
  }

  if (layar.j === 'profil') {
    const balik = layar.balik
    if (layar.jenis === 'saya') {
      return (
        <Profil
          jenis="anggota" id={sesi.id} nama={sesi.nama} v={fotoSaya} bolehUbah lencana={adalahAdmin ? (peran === 'ADMIN_UTAMA' ? 'ADMIN UTAMA' : 'ADMIN') : undefined}
          simpanFoto={async d => setFotoSaya((await ubahFotoSaya(sesi.token, d)).fotoV)}
          muat={() => profilAnggota(sesi.token, sesi.id)} saya
          kembali={() => setLayar(balik)}
        />
      )
    }
    if (layar.jenis === 'grup' && layar.grup) {
      const g = layar.grup
      const gTerbaru = grup.find(x => x.id === g.id) ?? g
      return (
        <Profil
          jenis="grup" id={g.id} nama={gTerbaru.nama} subjudul={`${gTerbaru.jumlah} anggota`} v={gTerbaru.fotoV}
          bolehUbah={adalahAdmin || gTerbaru.peranSaya === 'ADMIN_GRUP'}
          simpanFoto={async d => { await ubahFotoGrup(sesi.token, g.id, d); await muatGrup() }}
          kembali={() => setLayar(balik)}
        />
      )
    }
    const a = layar.anggota!
    return (
      <Profil
        jenis="anggota" id={a.id} nama={a.nama} v={anggota.find(x => x.id === a.id)?.fotoV} bolehUbah={false}
        simpanFoto={async () => {}}
        muat={() => profilAnggota(sesi.token, a.id)} online={online[a.id]}
        kirimPesan={() => setLayar({ j: 'orang', anggota: a })}
        kembali={() => setLayar(balik)}
      />
    )
  }
  if (layar.j === 'admin') return <Admin sesi={sesiSaya} kembali={() => setLayar({ j: 'daftar' })} />

  // Beranda hanya memuat obrolan yang sudah berjalan, yang terbaru di atas. Anggota lain (bisa ribuan)
  // tidak ditampilkan semua: dicari lewat kolom cari, atau dipilih dari "Obrolan baru".
  const q = cari.trim().toLowerCase()
  const terakhirWaktu = (kunci: string) => (pesan[kunci] ?? []).slice(-1)[0]?.waktu ?? 0
  type Baris = { t: 'seksi'; label: string } | { t: 'grup'; g: RingkasGrup } | { t: 'orang'; a: Anggota }
  type Berjalan = { w: number; nama: string; b: Baris }
  const berjalan: Berjalan[] = [
    ...grup.map(g => ({ w: terakhirWaktu(kunciGrup(g.id)), nama: g.nama, b: { t: 'grup', g } as Baris })),
    ...anggota.filter(a => (pesan[a.id] ?? []).length > 0).map(a => ({ w: terakhirWaktu(a.id), nama: a.nama, b: { t: 'orang', a } as Baris })),
  ]
    .filter(x => !q || x.nama.toLowerCase().includes(q))
    .sort((x, y) => y.w - x.w || x.nama.localeCompare(y.nama))
  const sudahBerjalan = new Set(berjalan.filter(x => x.b.t === 'orang').map(x => (x.b as { a: Anggota }).a.id))
  const BATAS_CARI = 30
  const lainnya = q ? anggota.filter(a => !(pesan[a.id] ?? []).length && a.nama.toLowerCase().includes(q) && !sudahBerjalan.has(a.id)) : []
  const data: Baris[] = [
    ...berjalan.map(x => x.b),
    ...(lainnya.length ? [{ t: 'seksi', label: 'ANGGOTA LAIN' } as Baris, ...lainnya.slice(0, BATAS_CARI).map(a => ({ t: 'orang', a }) as Baris)] : []),
    ...(lainnya.length > BATAS_CARI ? [{ t: 'seksi', label: `…dan ${lainnya.length - BATAS_CARI} lainnya. Persempit pencarian.` } as Baris] : []),
  ]

  const barisObrolan = (judul: string, kunci: string, grupIni: boolean, buka: () => void, avatar: ReactNode) => {
    const terakhir = (pesan[kunci] ?? []).slice(-1)[0]
    const n = belumBaca[kunci] ?? 0
    return (
      <Pressable
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: pressed ? '#F1F4F3' : '#fff', borderRadius: 18, marginHorizontal: 12, marginVertical: 4, paddingHorizontal: 14, paddingVertical: 12, elevation: 1 })}
        onPress={() => { setBelumBaca(b => ({ ...b, [kunci]: 0 })); buka() }}
      >
        {avatar}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.nama, { flex: 1 }]} numberOfLines={1}>{judul}</Text>
            {terakhir ? <Text style={{ fontSize: 12, color: n > 0 ? '#128C7E' : '#8696A0', fontWeight: n > 0 ? '700' : '400' }}>{waktuDaftar(terakhir.waktu)}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <Text style={[s.cuplikan, { flex: 1, marginTop: 0 }, n > 0 && { color: '#111', fontWeight: '600' }]} numberOfLines={1}>
              {n > 0 ? (n > 1 ? `${n} pesan baru` : 'Pesan baru') : terakhir ? (terakhir.dihapus ? 'Pesan ini dihapus' : ringkas(terakhir.teks)) : 'Ketuk untuk mulai mengobrol'}
            </Text>
            {n > 0 ? <View style={s.lencana}><Text style={s.lencanaTeks}>{n}</Text></View> : null}
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, { paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Logo ukuran={34} />
            <Wordmark tinggi={28} varian={adalahAdmin ? 'putih' : 'terang'} />
            {adalahAdmin ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: EMAS_TUA, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{peran === 'ADMIN_UTAMA' ? 'ADMIN UTAMA' : 'ADMIN'}</Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={() => setMenu(true)} hitSlop={14}>
            <Text style={{ color: '#fff', fontSize: 22 }}>⋮{adalahAdmin && menunggu > 0 ? ' •' : ''}</Text>
          </Pressable>
        </View>
        <Text style={s.subjudul}>{sesi.nama} · {tersambung ? 'online' : 'menyambung…'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 26, marginHorizontal: 14, marginTop: -2, marginBottom: 8, paddingHorizontal: 16, elevation: 3, transform: [{ translateY: -4 }] }}>
        <Text style={{ fontSize: 16, opacity: 0.45 }}>🔍</Text>
        <TextInput style={{ flex: 1, fontSize: 15.5, paddingVertical: 12, color: '#111' }} value={cari} onChangeText={setCari} placeholder="Cari obrolan atau grup" placeholderTextColor="#8696A0" />
      </View>
      <FlatList
        style={{ backgroundColor: '#F4F6F5' }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 + insets.bottom }}
        data={data}
        keyExtractor={(b, i) => (b.t === 'seksi' ? `s${b.label}` : b.t === 'grup' ? `g${b.g.id}` : `a${b.a.id}`) + i}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.kosong}>{q ? 'Tidak ada yang cocok.' : 'Belum ada obrolan. Ketuk tombol hijau di kanan bawah untuk memulai.'}</Text>}
        initialNumToRender={14}
        windowSize={7}
        renderItem={({ item }) => {
          if (item.t === 'seksi') return <Text style={s.seksi}>{item.label}</Text>
          if (item.t === 'grup') return barisObrolan(item.g.nama, kunciGrup(item.g.id), true, () => setLayar({ j: 'grup', grup: item.g }), <Avatar jenis="grup" id={item.g.id} v={item.g.fotoV} nama={item.g.nama} />)
          return barisObrolan(item.a.nama, item.a.id, false, () => setLayar({ j: 'orang', anggota: item.a }), <Avatar jenis="anggota" id={item.a.id} v={item.a.fotoV} nama={item.a.nama} />)
        }}
      />
      <Pressable
        onPress={() => setLayar({ j: 'kontak' })}
        accessibilityLabel="Obrolan baru"
        style={{ position: 'absolute', right: 18, bottom: 22 + insets.bottom, width: 60, height: 60, borderRadius: 18, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', elevation: 5 }}
      >
        {/* ikon gelembung obrolan dengan tanda + (digambar dengan View, tanpa emoji) */}
        <View style={{ width: 28, height: 24, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#128C7E', fontSize: 20, fontWeight: '800', lineHeight: 22, marginTop: -1 }}>+</Text>
        </View>
        <View style={{ position: 'absolute', left: 18, top: 41, width: 0, height: 0, borderTopWidth: 7, borderTopColor: '#fff', borderRightWidth: 7, borderRightColor: 'transparent' }} />
      </Pressable>
      {menu ? (
        <Pressable style={s.tabirMenu} onPress={() => setMenu(false)}>
          <View style={s.menu}>
            {adalahAdmin ? (
              <>
                <Pressable style={s.menuItem} onPress={() => { setMenu(false); setLayar({ j: 'buatGrup' }) }}>
                  <Text style={s.menuTeks}>Grup baru</Text>
                </Pressable>
                <Pressable style={s.menuItem} onPress={() => { setMenu(false); setLayar({ j: 'admin' }) }}>
                  <Text style={s.menuTeks}>Kelola anggota</Text>
                  {menunggu > 0 ? <View style={s.lencana}><Text style={s.lencanaTeks}>{menunggu}</Text></View> : null}
                </Pressable>
              </>
            ) : null}
            <Pressable style={s.menuItem} onPress={() => { setMenu(false); setLayar({ j: 'profil', jenis: 'saya', balik: { j: 'daftar' } }) }}>
              <Text style={s.menuTeks}>Profil saya</Text>
            </Pressable>
            <Pressable style={s.menuItem} onPress={() => { setMenu(false); setLayar({ j: 'pengaturan' }) }}>
              <Text style={s.menuTeks}>Pengaturan</Text>
            </Pressable>
            <Pressable
              style={s.menuItem}
              onPress={() => {
                setMenu(false)
                Alert.alert('Keluar?', 'Kunci dan riwayat pesan di perangkat ini akan dihapus.', [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Keluar', style: 'destructive', onPress: onKeluar },
                ])
              }}
            >
              <Text style={[s.menuTeks, { color: '#E53935' }]}>Keluar</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}
    </View>
  )
}
