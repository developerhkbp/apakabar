import { StatusBar } from 'expo-status-bar'
import Signal from './modules/signal-protocol/src'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, AppState, BackHandler, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  adaOnline, adminRingkasan, blokirAnggota, bukaBlokirAnggota, bungkusReaksi, klaimRiwayat, mintaIzin, ringkasanKontak, statusKontak, terimaIzin, tolakIzin, daftarAnggota, daftarGrup, daftarKomentarStatus, daftarStatus, detailGrup, hapusKomentarStatus, hapusStatus, muatArsipStatus, simpanArsipStatus, keluar, kirimKomentarStatus, simpanStatus, kunciGrup, mintaOtp, muatRiwayat, muatSesi, Obrolan,
  profilAnggota, simpanRiwayat, sudahOnboarding, tandaiOnboarding, ubahFotoGrup, ubahFotoSaya, verifikasi, versiFotoSaya,
  GalatApi, type PermintaanObrolan, type StatusKontak, type Anggota, type DetailGrup, type ArsipStatus, type StatusHarian, type Pesan, type RingkasGrup, type Riwayat, type Sesi,
} from './src/server'
import { awalNama, EMAS_TUA, s, setTemaAdmin, waktuDaftar } from './src/gaya'
import { Menunggu } from './src/layar/Menunggu'
import { Admin } from './src/layar/Admin'
import { BuatGrup, InfoGrup } from './src/layar/Grup'
import { buka, bungkus, bungkusLampiran, cuplikanBalas, denganBalasan, ringkas, untukDiteruskan } from './src/konten'
import { saring, unggahSemua, type Terpilih } from './src/lampiran'
import { Galeri } from './src/layar/Galeri'
import { ambilPratinjau, cariTautan } from './src/pratinjau'
import { Percakapan } from './src/layar/Percakapan'
import { Favorit } from './src/layar/Favorit'
import { BarisPermintaan, BilahIzin, KartuBlokir } from './src/layar/Izin'
import { BarisStatus, DetailStatus, KartuStatusSaya } from './src/layar/Status'
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
  | { j: 'favorit' }
  | { j: 'status'; id: string; balik: Layar }
  | { j: 'bagikan'; teks: string; berkas: Terpilih[] }

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
  const [statusList, setStatusList] = useState<StatusHarian[]>([])
  const [izin, setIzin] = useState<Record<string, StatusKontak>>({})
  const [kontak, setKontak] = useState<{ masuk: PermintaanObrolan[]; diblokir: string[] }>({ masuk: [], diblokir: [] })
  const [sibukIzin, setSibukIzin] = useState(false)
  const [menuReaksi, setMenuReaksi] = useState<{ saatIni?: string; pilih: (emoji: string) => void } | null>(null)
  const insets = useSafeAreaInsets()
  /** Pesan yang sedang dibalas di percakapan `kunci`. */
  const [balasan, setBalasan] = useState<{ kunci: string; p: Pesan } | null>(null)
  const [cari, setCari] = useState('')
  const [tersambung, setTersambung] = useState(false)
  const obrolan = useRef<Obrolan | null>(null)
  const layarRef = useRef<Layar>(layar)
  layarRef.current = layar
  // Tombol back bawaan Android mengikuti tombol kembali di aplikasi: tutup menu dulu, lalu mundur satu layar.
  const backRef = useRef<() => boolean>(() => false)
  backRef.current = () => {
    if (menuPesan) { setMenuPesan(null); return true }
    if (menu) { setMenu(false); return true }
    const l = layar
    switch (l.j) {
      case 'daftar': return false // di beranda: biarkan Android menutup aplikasi
      case 'profil': case 'teruskan': case 'infoPesan': case 'status': setLayar(l.balik); return true
      case 'infoGrup': setLayar({ j: 'grup', grup: l.grup }); return true
      case 'galeri': setLayar({ j: 'infoGrup', grup: l.grup }); return true
      default: setLayar({ j: 'daftar' }); return true
    }
  }
  useEffect(() => {
    const b = BackHandler.addEventListener('hardwareBackPress', () => backRef.current())
    return () => b.remove()
  }, [])
  const adalahAdmin = peran !== 'USER'
  setTokenFoto(sesi.token)
  useEffect(() => { versiFotoSaya(sesi.token, sesi.id).then(r => setFotoSaya(r.fotoV)).catch(() => {}) }, [sesi.token])
  // Status harian: dimuat saat masuk, saat aplikasi kembali aktif, dan tiap menit.
  useEffect(() => { try { Signal.siapkanSaluranPesan() } catch { /* build lama tanpa fungsi ini */ } }, [])
  const muatStatus = useCallback(() => { daftarStatus(sesi.token).then(setStatusList).catch(() => {}) }, [sesi.token])
  useEffect(() => {
    muatStatus()
    const t = setInterval(muatStatus, 60_000)
    const l = AppState.addEventListener('change', st => { if (st === 'active') muatStatus() })
    return () => { clearInterval(t); l.remove() }
  }, [muatStatus])
  const statusSaya = statusList.find(x => x.saya) ?? null
  // Arsip status saya di HP: status yang sudah lewat 24 jam hilang dari server, tetapi salinannya tetap ada di sini.
  const [arsip, setArsip] = useState<ArsipStatus[]>([])
  const [arsipSiap, setArsipSiap] = useState(false)
  useEffect(() => { muatArsipStatus().then(d => { setArsip(d); setArsipSiap(true) }) }, [])
  useEffect(() => {
    if (!arsipSiap) return
    const milik = statusList.filter(x => x.saya)
    if (!milik.length) return
    setArsip(lama => {
      const ada = new Set(lama.map(a => a.id))
      const baru = milik.filter(m => !ada.has(m.id)).map(({ id, teks, suasana, dibuatPada }) => ({ id, teks, suasana, dibuatPada }))
      if (!baru.length) return lama
      const hasil = [...baru, ...lama].sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada)).slice(0, 300)
      simpanArsipStatus(hasil)
      return hasil
    })
  }, [statusList, arsipSiap])
  const hapusArsip = (id: string) => setArsip(lama => { const hasil = lama.filter(a => a.id !== id); simpanArsipStatus(hasil); return hasil })
  const tambahStatus = async (teks: string, suasana?: string) => { await simpanStatus(sesi.token, teks, suasana); muatStatus() }
  // Permintaan izin pesan & daftar blokir: dimuat saat masuk, saat aplikasi aktif, tiap menit, dan saat ada kabar dari server.
  const muatKontak = useCallback(() => { ringkasanKontak(sesi.token).then(setKontak).catch(() => {}) }, [sesi.token])
  const muatIzin = useCallback((id: string) => { statusKontak(sesi.token, id).then(st => setIzin(x => ({ ...x, [id]: st }))).catch(() => {}) }, [sesi.token])
  useEffect(() => {
    muatKontak()
    const t = setInterval(muatKontak, 60_000)
    const l = AppState.addEventListener('change', st => { if (st === 'active') muatKontak() })
    return () => { clearInterval(t); l.remove() }
  }, [muatKontak])
  // Percakapan lama (riwayat ada di perangkat ini) diakui ke server; diterima otomatis begitu kedua pihak mengaku.
  const sudahKlaim = useRef(false)
  useEffect(() => {
    if (!dimuat || !tersambung || sudahKlaim.current) return
    const ids = Object.entries(pesan).filter(([k, v]) => !k.startsWith('g:') && v.length > 0).map(([k]) => k)
    sudahKlaim.current = true
    if (ids.length) klaimRiwayat(sesi.token, ids).then(() => { muatKontak(); const l = layarRef.current; if (l.j === 'orang') muatIzin(l.anggota.id) }).catch(() => { sudahKlaim.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimuat, tersambung])
  /** Menjalankan aksi izin/blokir lalu menyimpan status terbaru lawan bicara. */
  const aksiIzin = async (id: string, jalankan: () => Promise<unknown>) => {
    setSibukIzin(true)
    try {
      const r = await jalankan()
      if (typeof r === 'string') setIzin(x => ({ ...x, [id]: r as StatusKontak }))
      else muatIzin(id)
      muatKontak()
    } catch (e) {
      Alert.alert('Tidak berhasil', (e as Error)?.message || 'Periksa koneksi lalu coba lagi.')
    } finally {
      setSibukIzin(false)
    }
  }
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
    o.onReaksi = (kunci, pengirimId, ref, oleh, emoji) =>
      setPesan(x => ({ ...x, [kunci]: (x[kunci] ?? []).map(p => {
        if (p.dari !== pengirimId || p.ref !== ref) return p
        const { [oleh]: _lama, ...sisa } = p.reaksi ?? {}
        return { ...p, reaksi: emoji ? { ...sisa, [oleh]: emoji } : sisa }
      }) }))
    o.onButuhIzin = untuk => {
      muatIzin(untuk)
      Alert.alert('Pesan belum terkirim', 'Anda perlu izin dulu dari penerima. Buka percakapannya lalu ketuk "Minta izin kirim pesan".')
    }
    o.onIzinBerubah = () => { muatKontak(); const l = layarRef.current; if (l.j === 'orang') muatIzin(l.anggota.id) }
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
  }, [sesi, muatGrup, muatIzin, muatKontak])

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

  // Isi yang dibagikan dari aplikasi lain (menu Bagikan Android) → pilih tujuan percakapan.
  useEffect(() => {
    const cek = async () => {
      try {
        const b = await Signal.bagikanMasuk()
        if (!b) return
        const { lolos, ditolak } = saring(b.berkas.map(x => (x.uri ? x : { ...x, ukuran: 0 })), 0)
        const valid = lolos.filter(x => x.uri)
        if (ditolak.length) Alert.alert('Sebagian berkas tidak dapat dikirim', ditolak.join('\n'))
        if (!b.teks && !valid.length) return
        setLayar({ j: 'bagikan', teks: b.teks, berkas: valid })
      } catch { /* abaikan; bukan intent bagikan */ }
    }
    cek()
    const l = AppState.addEventListener('change', st => { if (st === 'active') cek() })
    return () => l.remove()
  }, [])

  const sesiSaya = { ...sesi, peran }

  // Kirim ulang otomatis pesan yang gagal karena jaringan begitu koneksi pulih.
  useEffect(() => {
    if (!tersambung || !dimuat) return
    const tertunda = Object.entries(pesan).flatMap(([kunci, daftar]) => daftar.filter(p => p.saya && p.status === 'gagal' && p.gagalJaringan).map(p => [kunci, p] as const))
    for (const [kunci, p] of tertunda) kirimUlang(kunci, p, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tersambung, dimuat])

  // Izin kirim pesan dengan lawan bicara di percakapan yang terbuka.
  const idOrang = layar.j === 'orang' ? layar.anggota.id : null
  useEffect(() => { if (idOrang) muatIzin(idOrang) }, [idOrang, muatIzin])

  /** Reaksi emoji pada satu pesan (ketuk emoji yang sama lagi = cabut). Dikirim sebagai pesan terenkripsi biasa, tidak tampil sebagai pesan. */
  const reaksiPesan = async (kunci: string, p: Pesan, emoji: string) => {
    if (!p.ref) return
    const baru = p.reaksi?.[sesi.id] === emoji ? '' : emoji
    setPesan(x => ({ ...x, [kunci]: (x[kunci] ?? []).map(m => {
      if (m.id !== p.id) return m
      const { [sesi.id]: _lama, ...sisa } = m.reaksi ?? {}
      return { ...m, reaksi: baru ? { ...sisa, [sesi.id]: baru } : sisa }
    }) }))
    const isi = bungkusReaksi(p.dari, p.ref, baru)
    try {
      const o = obrolan.current!
      if (kunci.startsWith('g:')) {
        const d: DetailGrup = await detailGrup(sesi.token, kunci.slice(2))
        await o.kirimGrup({ id: d.id, idDistribusi: d.idDistribusi, anggotaIds: d.anggota.map(a => a.id) }, isi)
      } else await o.kirim(kunci, isi)
    } catch (e) {
      Alert.alert('Reaksi belum terkirim', (e as Error)?.message || 'Periksa koneksi lalu coba lagi.')
    }
  }

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

  const gantiFavorit = (kunci: string, p: Pesan) =>
    setPesan(x => ({ ...x, [kunci]: (x[kunci] ?? []).map(m => (m.id === p.id ? { ...m, favorit: !m.favorit } : m)) }))
  /** Aksi geser pesan (kanan: balas; kiri: teruskan, favorit, hapus) untuk percakapan `kunci`. */
  const geserPesan = (kunci: string, untukSemua: (p: Pesan) => (() => void) | undefined) => ({
    balas: (p: Pesan) => setBalasan({ kunci, p }),
    teruskan: (p: Pesan) => setLayar({ j: 'teruskan', isi: p.teks, kunciAsal: kunci, balik: layarRef.current }),
    favorit: (p: Pesan) => gantiFavorit(kunci, p),
    hapus: (p: Pesan) => {
      const semua = untukSemua(p)
      const item: ItemMenu[] = [{ label: 'Hapus untuk saya', aksi: () => hapusLokal(kunci, p.id) }]
      if (semua) item.push({ label: 'Hapus untuk semua', bahaya: true, aksi: semua })
      setMenuReaksi(null)
      setMenuPesan(item)
    },
  })
  const favorit = useMemo(
    () => Object.entries(pesan).flatMap(([kunci, ps]) => ps.filter(p => p.favorit && !p.dihapus).map(p => ({ kunci, p }))).sort((a, b) => b.p.waktu - a.p.waktu),
    [pesan],
  )

  /** Menu tekan-lama: Info pesan (pesan sendiri), hapus untuk saya, hapus untuk semua bila berwenang. */
  const bukaMenu = (kunci: string, p: Pesan, info: Layar, untukSemua?: () => void) => {
    const item: ItemMenu[] = []
    if (!p.dihapus && p.status !== 'gagal') {
      if (p.ref) item.push({ label: 'Balas', aksi: () => setBalasan({ kunci, p }) })
      item.push({ label: 'Teruskan', aksi: () => setLayar({ j: 'teruskan', isi: p.teks, kunciAsal: kunci, balik: layarRef.current }) })
      item.push({ label: p.favorit ? 'Hapus dari favorit' : 'Favoritkan', aksi: () => gantiFavorit(kunci, p) })
    }
    if (p.saya && p.status !== 'gagal') item.push({ label: 'Info pesan', aksi: () => setLayar(info) })
    item.push({ label: 'Hapus untuk saya', aksi: () => hapusLokal(kunci, p.id) })
    if (untukSemua) item.push({ label: 'Hapus untuk semua', bahaya: true, aksi: untukSemua })
    setMenuReaksi(!p.dihapus && p.status !== 'gagal' && p.ref ? { saatIni: p.reaksi?.[sesi.id], pilih: e => reaksiPesan(kunci, p, e) } : null)
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
        saya={sesi.id}
        bilahIzin={izin[lawan.id] && izin[lawan.id] !== 'IZIN' ? (
          <BilahIzin
            nama={lawan.nama} status={izin[lawan.id]} sibuk={sibukIzin}
            minta={() => aksiIzin(lawan.id, () => mintaIzin(sesi.token, lawan.id))}
            terima={() => aksiIzin(lawan.id, () => terimaIzin(sesi.token, lawan.id))}
            tolak={() => aksiIzin(lawan.id, async () => { await tolakIzin(sesi.token, lawan.id); setLayar({ j: 'daftar' }) })}
            blokir={() => Alert.alert(`Blokir ${lawan.nama}?`, 'Anda tidak akan menerima pesan darinya, dan statusnya tidak akan terlihat satu sama lain.', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Blokir', style: 'destructive', onPress: () => aksiIzin(lawan.id, () => blokirAnggota(sesi.token, lawan.id)) },
            ])}
            bukaBlokir={() => aksiIzin(lawan.id, () => bukaBlokirAnggota(sesi.token, lawan.id))}
          />
        ) : undefined}
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
        geser={geserPesan(lawan.id, p => (p.saya && p.ref && p.status !== 'gagal' ? () => obrolan.current?.hapusPesanPribadi(lawan.id, p.ref!) : undefined))}
        subjudul={online[lawan.id] ? 'online' : undefined}
        balasan={balasan?.kunci === lawan.id ? balasan.p : null}
        batalBalas={() => setBalasan(null)}
        namaBalas={id => (id === sesi.id ? 'Anda' : lawan.nama)}
      />
      {menuPesan ? <MenuPesan item={menuPesan} reaksi={menuReaksi ?? undefined} tutup={() => { setMenuPesan(null); setMenuReaksi(null) }} /> : null}
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
        saya={sesi.id}
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
        geser={geserPesan(k, p => ((p.saya || adalahAdmin || g.peranSaya === 'ADMIN_GRUP') && !!p.ref ? () => obrolan.current?.hapusPesanGrup(g.id, p.dari, p.ref!) : undefined))}
        balasan={balasan?.kunci === k ? balasan.p : null}
        batalBalas={() => setBalasan(null)}
        namaBalas={id => (id === sesi.id ? 'Anda' : namaAnggota.get(id) ?? namaGrup[id] ?? 'Anggota')}
      />
      {menuPesan ? <MenuPesan item={menuPesan} reaksi={menuReaksi ?? undefined} tutup={() => { setMenuPesan(null); setMenuReaksi(null) }} /> : null}
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

  if (layar.j === 'bagikan') {
    const t = layar
    const ringkasan = t.teks || `${t.berkas.length} berkas: ${t.berkas.map(x => x.nama).join(', ')}`
    return (
      <Teruskan
        anggota={anggota}
        grup={grup}
        isi={ringkasan}
        kunciAsal=""
        kembali={() => setLayar({ j: 'daftar' })}
        kirim={async tujuan => {
          try {
            // Berkas dienkripsi dan diunggah sekali; kuncinya ikut di tiap pesan tujuan.
            const lampiran = t.berkas.length ? await unggahSemua(u => obrolan.current!.unggahBerkas(u), t.berkas, () => {}) : []
            const isi = lampiran.length ? bungkusLampiran(t.teks, lampiran) : await siapkanIsi(t.teks)
            for (const kunci of tujuan) await kirimKe(kunci, isi, true)
            // satu tujuan → langsung buka percakapannya (seperti WhatsApp); beberapa tujuan → kembali ke beranda
            const k = tujuan.length === 1 ? tujuan[0] : null
            const g = k?.startsWith('g:') ? grup.find(x => x.id === k.slice(2)) : undefined
            const a = k && !k.startsWith('g:') ? anggota.find(x => x.id === k) : undefined
            setLayar(g ? { j: 'grup', grup: g } : a ? { j: 'orang', anggota: a } : { j: 'daftar' })
          } catch (e) {
            Alert.alert('Gagal membagikan', (e as Error).message || 'Periksa koneksi lalu coba lagi.')
          }
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

  if (layar.j === 'favorit') {
    const namaTempat = (kunci: string) => (kunci.startsWith('g:') ? grup.find(g => g.id === kunci.slice(2))?.nama ?? 'Grup' : namaAnggota.get(kunci) ?? 'Obrolan')
    return (
      <Favorit
        daftar={favorit.map(({ kunci, p }) => ({ kunci, p, tempat: namaTempat(kunci), pengirim: p.saya ? 'Anda' : namaAnggota.get(p.dari) ?? namaGrup[p.dari] ?? 'Anggota' }))}
        buka={kunci => {
          if (kunci.startsWith('g:')) { const g = grup.find(x => x.id === kunci.slice(2)); if (g) setLayar({ j: 'grup', grup: g }) }
          else { const a = anggota.find(x => x.id === kunci); if (a) setLayar({ j: 'orang', anggota: a }) }
        }}
        lepas={gantiFavorit}
        kembali={() => setLayar({ j: 'daftar' })}
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
          tambahan={
            <KartuStatusSaya
              daftar={statusList.filter(x => x.saya)}
              riwayat={arsip.filter(a => !statusList.some(x => x.id === a.id))}
              hapusRiwayat={hapusArsip}
              tambah={tambahStatus}
              hapus={async id => { await hapusStatus(sesi.token, id); setStatusList(x => x.filter(y => y.id !== id)); hapusArsip(id) }}
              buka={id => setLayar({ j: 'status', id, balik: layar })}
            />
          }
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
        tambahan={(() => {
          const diblokir = kontak.diblokir.includes(a.id) || izin[a.id] === 'DIBLOKIR_SAYA'
          return (
            <KartuBlokir
              nama={a.nama} diblokir={diblokir}
              ubah={() => diblokir
                ? aksiIzin(a.id, () => bukaBlokirAnggota(sesi.token, a.id))
                : Alert.alert(`Blokir ${a.nama}?`, 'Anda tidak akan menerima pesan darinya, dan statusnya tidak akan terlihat satu sama lain.', [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Blokir', style: 'destructive', onPress: () => aksiIzin(a.id, () => blokirAnggota(sesi.token, a.id)) },
                  ])}
            />
          )
        })()}
        kembali={() => setLayar(balik)}
      />
    )
  }
  if (layar.j === 'status') {
    const st = statusList.find(x => x.id === layar.id)
    if (!st) { setLayar(layar.balik); return <View style={s.root} /> }
    return (
      <DetailStatus
        key={st.id}
        status={st} anggota={anggota} saya={sesi.id}
        saudara={statusList.filter(x => x.anggotaId === st.anggotaId).sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada))}
        pilih={id => setLayar({ ...layar, id })}
        muat={() => daftarKomentarStatus(sesi.token, st.id)}
        kirim={t => kirimKomentarStatus(sesi.token, st.id, t)}
        hapusKomentar={async id => { await hapusKomentarStatus(sesi.token, st.id, id) }}
        hapusStatus={st.saya ? async () => { await hapusStatus(sesi.token, st.id); setStatusList(x => x.filter(y => y.id !== st.id)); hapusArsip(st.id) } : undefined}
        berubah={muatStatus}
        kembali={() => setLayar(layar.balik)}
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
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: pressed ? '#F1F4F8' : '#fff', borderRadius: 18, marginHorizontal: 12, marginVertical: 4, paddingHorizontal: 14, paddingVertical: 12, elevation: 1 })}
        onPress={() => { setBelumBaca(b => ({ ...b, [kunci]: 0 })); buka() }}
      >
        {avatar}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.nama, { flex: 1 }]} numberOfLines={1}>{judul}</Text>
            {terakhir ? <Text style={{ fontSize: 12, color: n > 0 ? '#1976D2' : '#8696A0', fontWeight: n > 0 ? '700' : '400' }}>{waktuDaftar(terakhir.waktu)}</Text> : null}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable onPress={() => setLayar({ j: 'profil', jenis: 'saya', balik: { j: 'daftar' } })} hitSlop={10} accessibilityLabel="Profil saya">
              <View style={{ padding: 2, borderRadius: 22, borderWidth: 2, borderColor: statusSaya ? '#fff' : 'transparent' }}>
                <Avatar jenis="anggota" id={sesi.id} v={fotoSaya} nama={sesi.nama} ukuran={36} />
              </View>
            </Pressable>
            <Pressable onPress={() => setMenu(true)} hitSlop={14}>
              <Text style={{ color: '#fff', fontSize: 22 }}>⋮{adalahAdmin && menunggu > 0 ? ' •' : ''}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={s.subjudul}>{sesi.nama} · {tersambung ? 'online' : 'menyambung…'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 26, marginHorizontal: 14, marginTop: -2, marginBottom: 8, paddingHorizontal: 16, elevation: 3, transform: [{ translateY: -4 }] }}>
        <Text style={{ fontSize: 16, opacity: 0.45 }}>🔍</Text>
        <TextInput style={{ flex: 1, fontSize: 15.5, paddingVertical: 12, color: '#111' }} value={cari} onChangeText={setCari} placeholder="Cari obrolan atau grup" placeholderTextColor="#8696A0" />
      </View>
      <FlatList
        style={{ backgroundColor: '#F4F6F9' }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 + insets.bottom }}
        data={data}
        keyExtractor={(b, i) => (b.t === 'seksi' ? `s${b.label}` : b.t === 'grup' ? `g${b.g.id}` : `a${b.a.id}`) + i}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={q ? undefined : (
          <>
            <BarisPermintaan daftar={kontak.masuk} buka={r => setLayar({ j: 'orang', anggota: { id: r.id, nama: r.nama, fotoV: r.fotoV } })} />
            <BarisStatus tambah={tambahStatus} daftar={statusList} anggota={anggota} buka={id => setLayar({ j: 'status', id, balik: { j: 'daftar' } })} />
          </>
        )}
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
        style={{ position: 'absolute', right: 18, bottom: 22 + insets.bottom, width: 60, height: 60, borderRadius: 18, backgroundColor: '#42A5F5', alignItems: 'center', justifyContent: 'center', elevation: 5 }}
      >
        {/* ikon gelembung obrolan dengan tanda + (digambar dengan View, tanpa emoji) */}
        <View style={{ width: 28, height: 24, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#1976D2', fontSize: 20, fontWeight: '800', lineHeight: 22, marginTop: -1 }}>+</Text>
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
            <Pressable style={s.menuItem} onPress={() => { setMenu(false); setLayar({ j: 'favorit' }) }}>
              <Text style={s.menuTeks}>Pesan berbintang{favorit.length ? ` (${favorit.length})` : ''}</Text>
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
