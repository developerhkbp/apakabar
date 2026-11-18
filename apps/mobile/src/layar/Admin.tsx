import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import {
  adminBlokir, adminBukaBlokir, adminDaftar, adminDetail, adminKeluarkan, adminRingkasan, adminSetujui, adminSetujuiBanyak,
  adminTambah, adminUbah, adminUbahPeran, type AnggotaAdmin, type DetailAnggotaAdmin, type Sesi, type StatusAnggota,
} from '../server'
import { awalNama, s } from '../gaya'

const TAB: { status: StatusAnggota; label: string }[] = [
  { status: 'MENUNGGU', label: 'Menunggu' },
  { status: 'DIUNDANG', label: 'Belum masuk' },
  { status: 'AKTIF', label: 'Aktif' },
  { status: 'DITANGGUHKAN', label: 'Diblokir' },
]

const tampilNomor = (n: string) => (n.startsWith('62') ? '0' + n.slice(2) : n)

export function Admin({ sesi, kembali }: { sesi: Sesi; kembali: () => void }) {
  const utama = sesi.peran === 'ADMIN_UTAMA'
  const [tab, setTab] = useState<StatusAnggota>('MENUNGGU')
  const [cari, setCari] = useState('')
  const [data, setData] = useState<AnggotaAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [halaman, setHalaman] = useState(1)
  const [jumlah, setJumlah] = useState<Record<string, number>>({})
  const [sibuk, setSibuk] = useState(false)
  const [dimuat, setDimuat] = useState(false) // sudah ada jawaban untuk tab/pencarian ini
  const [galat, setGalat] = useState('')
  const [formTambah, setFormTambah] = useState(false)
  const [diubah, setDiubah] = useState<AnggotaAdmin | null>(null)
  const [rinci, setRinci] = useState<AnggotaAdmin | null>(null)
  const permintaan = useRef(0)

  const muat = useCallback(async (hal = 1) => {
    const no = ++permintaan.current
    setSibuk(true)
    try {
      const [r, rg] = await Promise.all([adminDaftar(sesi.token, tab, cari.trim() || undefined, hal), adminRingkasan(sesi.token)])
      if (no !== permintaan.current) return // jawaban lama, abaikan
      setData(x => (hal === 1 ? r.data : [...x, ...r.data]))
      setTotal(r.total)
      setHalaman(hal)
      setJumlah(rg)
      setDimuat(true)
      setGalat('')
    } catch (e) {
      if (no === permintaan.current) { setGalat((e as Error).message); setDimuat(true) }
    } finally {
      if (no === permintaan.current) setSibuk(false)
    }
  }, [sesi.token, tab, cari])

  useEffect(() => {
    const t = setTimeout(() => muat(1), cari ? 300 : 0)
    return () => clearTimeout(t)
  }, [muat, cari])

  const jalankan = async (fn: () => Promise<unknown>) => {
    try { await fn(); await muat(1) } catch (e) { Alert.alert('Tidak berhasil', (e as Error).message) }
  }
  const konfirmasi = (judul: string, isi: string, teksYa: string, fn: () => Promise<unknown>) =>
    Alert.alert(judul, isi, [{ text: 'Batal', style: 'cancel' }, { text: teksYa, style: 'destructive', onPress: () => jalankan(fn) }])

  const baris = (a: AnggotaAdmin) => (
    <Pressable style={s.barisObrolan} onPress={() => setRinci(a)}>
      <View style={s.avatar}><Text style={s.avatarTeks}>{awalNama(a.nama)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.nama}>{a.nama}</Text>
        <Text style={s.cuplikan}>{tampilNomor(a.nomorHp)}</Text>
        {a.peran !== 'USER' ? (
          <View style={s.lencanaPeran}><Text style={s.lencanaPeranTeks}>{a.peran === 'ADMIN_UTAMA' ? 'Admin utama' : 'Admin'}</Text></View>
        ) : null}
        {a.status === 'DIUNDANG' ? (
          <Text style={{ fontSize: 12, color: '#8696A0', marginTop: 4 }}>Belum pernah masuk ke aplikasi. Tidak ada tindakan yang diperlukan.</Text>
        ) : null}
        {a.status !== 'DIUNDANG' && a.peran !== 'ADMIN_UTAMA' && a.id !== sesi.id ? (
          <View style={s.aksiBaris}>
            {a.status === 'MENUNGGU' ? (
              <Pressable style={[s.aksi, s.aksiPenuh]} onPress={() => jalankan(() => adminSetujui(sesi.token, a.id))}>
                <Text style={[s.aksiTeks, s.aksiPenuhTeks]}>Setujui</Text>
              </Pressable>
            ) : null}
            {a.status === 'DITANGGUHKAN' ? (
              <Pressable style={s.aksi} onPress={() => jalankan(() => adminBukaBlokir(sesi.token, a.id))}>
                <Text style={s.aksiTeks}>Buka blokir</Text>
              </Pressable>
            ) : (
              (a.peran === 'USER' || utama) && (
                <Pressable
                  style={[s.aksi, s.aksiBahaya]}
                  onPress={() => konfirmasi('Blokir anggota?', `${a.nama} tidak bisa masuk lagi dan dikeluarkan dari semua grup. Blokir bisa dibuka kembali.`, 'Blokir', () => adminBlokir(sesi.token, a.id))}
                >
                  <Text style={[s.aksiTeks, s.aksiBahayaTeks]}>Blokir</Text>
                </Pressable>
              )
            )}
            {utama && a.status === 'AKTIF' ? (
              <Pressable
                style={s.aksi}
                onPress={() => jalankan(() => adminUbahPeran(sesi.token, a.id, a.peran === 'ADMIN' ? 'USER' : 'ADMIN'))}
              >
                <Text style={s.aksiTeks}>{a.peran === 'ADMIN' ? 'Cabut admin' : 'Jadikan admin'}</Text>
              </Pressable>
            ) : null}
            {utama ? (
              <Pressable
                style={[s.aksi, s.aksiBahaya]}
                onPress={() => konfirmasi('Keluarkan dari ApaKabaR?', `${a.nama} dihapus permanen beserta keanggotaan grupnya. Tidak bisa dibatalkan.`, 'Keluarkan', () => adminKeluarkan(sesi.token, a.id))}
              >
                <Text style={[s.aksiTeks, s.aksiBahayaTeks]}>Keluarkan</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {a.peran === 'USER' || (utama && a.peran === 'ADMIN') ? (
          <View style={s.aksiBaris}>
            <Pressable style={s.aksi} onPress={() => { setFormTambah(false); setDiubah(a) }}>
              <Text style={s.aksiTeks}>Ubah nama / nomor</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  )

  if (rinci) {
    return (
      <Rinci
        token={sesi.token} a={rinci} kembali={() => setRinci(null)}
        bisaUbah={rinci.peran === 'USER' || (utama && rinci.peran === 'ADMIN')}
        ubah={() => { setFormTambah(false); setDiubah(rinci); setRinci(null) }}
      />
    )
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Text style={[s.judul, { flex: 1 }]}>Kelola anggota</Text>
        {utama ? (
          <Pressable onPress={() => { setDiubah(null); setFormTambah(x => !x) }} hitSlop={12}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{formTambah ? 'Tutup' : '+ Tambah'}</Text>
          </Pressable>
        ) : null}
      </View>
      {diubah ? <FormUbah key={diubah.id} token={sesi.token} a={diubah} batal={() => setDiubah(null)} selesai={() => { setDiubah(null); muat(1) }} /> : null}
      {formTambah ? <FormTambah token={sesi.token} selesai={() => { setFormTambah(false); setTab('AKTIF'); muat(1) }} /> : null}
      <View style={s.tab}>
        {TAB.map(t => (
          <Pressable key={t.status} style={[s.tabItem, tab === t.status && s.tabAktif]} onPress={() => { if (t.status === tab) return; setData([]); setTotal(0); setDimuat(false); setTab(t.status) }}>
            <Text style={[s.tabTeks, tab === t.status && s.tabTeksAktif]}>{t.label}{jumlah[t.status] ? ` (${jumlah[t.status]})` : ''}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={s.cari} value={cari} onChangeText={setCari} placeholder="Cari nama atau nomor" />
      {tab === 'MENUNGGU' && data.length > 1 ? (
        <Pressable
          style={[s.tombol, { marginHorizontal: 16, marginTop: 0, marginBottom: 6 }]}
          onPress={() => konfirmasi('Setujui semua?', `${data.length} anggota yang tampil akan disetujui.`, 'Setujui semua', () => adminSetujuiBanyak(sesi.token, data.map(x => x.id)))}
        >
          <Text style={s.tombolTeks}>Setujui {data.length} yang tampil</Text>
        </Pressable>
      ) : null}
      {galat ? <Text style={s.galat}>{galat}</Text> : null}
      <FlatList
        data={data}
        keyExtractor={a => a.id}
        renderItem={({ item }) => baris(item)}
        onEndReached={() => { if (dimuat && !sibuk && data.length > 0 && data.length < total) muat(halaman + 1) }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={!dimuat ? <ActivityIndicator style={{ margin: 32 }} /> : galat ? undefined : <Text style={s.kosong}>Tidak ada anggota di daftar ini.</Text>}
        ListFooterComponent={sibuk && halaman > 1 && data.length ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
      />
    </View>
  )
}

function FormTambah({ token, selesai }: { token: string; selesai: () => void }) {
  const [nama, setNama] = useState('')
  const [nomor, setNomor] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  return (
    <View style={{ padding: 16, backgroundColor: '#F7F8F8' }}>
      <TextInput style={s.formKolom} value={nama} onChangeText={setNama} placeholder="Nama lengkap" />
      <TextInput style={s.formKolom} value={nomor} onChangeText={setNomor} placeholder="Nomor HP (08xx…)" keyboardType="phone-pad" />
      {galat ? <Text style={s.galat}>{galat}</Text> : null}
      <Text style={[s.info, { textAlign: 'left' }]}>Anggota yang ditambahkan admin utama langsung aktif dan bisa masuk dengan kode WhatsApp.</Text>
      <Pressable
        style={[s.tombol, sibuk && { opacity: 0.5 }]}
        disabled={sibuk}
        onPress={async () => {
          setSibuk(true)
          setGalat('')
          try { await adminTambah(token, nomor, nama); selesai() } catch (e) { setGalat((e as Error).message) } finally { setSibuk(false) }
        }}
      >
        {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={s.tombolTeks}>Tambahkan</Text>}
      </Pressable>
    </View>
  )
}

function FormUbah({ token, a, batal, selesai }: { token: string; a: AnggotaAdmin; batal: () => void; selesai: () => void }) {
  const [nama, setNama] = useState(a.nama)
  const [nomor, setNomor] = useState(tampilNomor(a.nomorHp))
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  return (
    <View style={{ padding: 16, backgroundColor: '#F7F8F8' }}>
      <Text style={{ fontWeight: '700', color: '#111B21', marginBottom: 8 }}>Ubah data anggota</Text>
      <TextInput style={s.formKolom} value={nama} onChangeText={setNama} placeholder="Nama lengkap" />
      <TextInput style={s.formKolom} value={nomor} onChangeText={setNomor} placeholder="Nomor HP (08xx…)" keyboardType="phone-pad" />
      {galat ? <Text style={s.galat}>{galat}</Text> : null}
      <Text style={[s.info, { textAlign: 'left' }]}>Anggota masuk dengan kode WhatsApp ke nomor ini. Perubahan nomor tidak mengeluarkan perangkat yang sudah masuk.</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable style={[s.tombolTepi, { flex: 1 }]} disabled={sibuk} onPress={batal}>
          <Text style={s.tombolTepiTeks}>Batal</Text>
        </Pressable>
        <Pressable
          style={[s.tombol, { flex: 1 }, sibuk && { opacity: 0.5 }]}
          disabled={sibuk}
          onPress={async () => {
            const d: { nama?: string; nomorHp?: string } = {}
            if (nama.trim() !== a.nama) d.nama = nama.trim()
            if (nomor.trim() && nomor.replace(/\D/g, '') !== tampilNomor(a.nomorHp).replace(/\D/g, '')) d.nomorHp = nomor
            if (!d.nama && !d.nomorHp) { batal(); return }
            setSibuk(true)
            setGalat('')
            try { await adminUbah(token, a.id, d); selesai() } catch (e) { setGalat((e as Error).message) } finally { setSibuk(false) }
          }}
        >
          {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={s.tombolTeks}>Simpan</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const LABEL_STATUS: Record<string, string> = { AKTIF: 'Aktif', MENUNGGU: 'Menunggu persetujuan', DIUNDANG: 'Belum masuk', DITANGGUHKAN: 'Diblokir' }
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tglPendek = (iso: string | null) => { if (!iso) return null; const d = new Date(iso); return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}` }

/** Detail satu anggota untuk admin: data ApaKabaR dicocokkan dengan jabatan, tempat bertugas, dan foto dari superapp. */
function Rinci({ token, a, kembali, bisaUbah, ubah }: { token: string; a: AnggotaAdmin; kembali: () => void; bisaUbah: boolean; ubah: () => void }) {
  const [d, setD] = useState<DetailAnggotaAdmin | null>(null)
  const [galat, setGalat] = useState('')
  const [fotoRusak, setFotoRusak] = useState(false)
  useEffect(() => {
    let batal = false
    adminDetail(token, a.id).then(r => { if (!batal) setD(r) }).catch(e => { if (!batal) setGalat((e as Error).message) })
    return () => { batal = true }
  }, [token, a.id])
  const sp = d?.superapp
  const kotak = { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#E9EDEF' } as const
  const label = { fontSize: 12, color: '#667781' } as const
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Text style={[s.judul, { flex: 1 }]}>Detail anggota</Text>
        {bisaUbah ? (
          <Pressable onPress={ubah} hitSlop={12}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Ubah</Text></Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} style={{ backgroundColor: '#F0F2F5' }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          {sp?.fotoUrl && !fotoRusak ? (
            <Image source={{ uri: sp.fotoUrl }} onError={() => setFotoRusak(true)} style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: '#DDD' }} />
          ) : (
            <View style={[s.avatar, { width: 128, height: 128, borderRadius: 64 }]}><Text style={[s.avatarTeks, { fontSize: 44 }]}>{awalNama(a.nama)}</Text></View>
          )}
          <Text style={{ fontSize: 21, fontWeight: '700', color: '#111B21', textAlign: 'center' }}>{sp?.nama ?? a.nama}</Text>
          {sp && sp.nama !== a.nama ? <Text style={{ color: '#667781' }}>Nama di ApaKabaR: {a.nama}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <View style={s.lencanaPeran}><Text style={s.lencanaPeranTeks}>{LABEL_STATUS[a.status] ?? a.status}</Text></View>
            {a.peran !== 'USER' ? <View style={s.lencanaPeran}><Text style={s.lencanaPeranTeks}>{a.peran === 'ADMIN_UTAMA' ? 'Admin utama' : 'Admin'}</Text></View> : null}
          </View>
        </View>

        <View style={kotak}>
          <Text style={label}>Nomor HP (ApaKabaR)</Text>
          <Text style={{ fontSize: 17, color: '#111B21', marginTop: 2 }}>{tampilNomor(a.nomorHp)}</Text>
          {sp ? (
            sp.nomorCocok === null ? (
              <Text style={{ color: '#8696A0', marginTop: 6 }}>Superapp belum mencatat nomor HP pelayan ini.</Text>
            ) : sp.nomorCocok ? (
              <Text style={{ color: '#1B7F4B', marginTop: 6, fontWeight: '600' }}>✓ Sama dengan nomor di superapp</Text>
            ) : (
              <Text style={{ color: '#C62828', marginTop: 6, fontWeight: '600' }}>⚠ Berbeda dengan superapp ({sp.hp.map(tampilNomor).join(', ')}). Pastikan orangnya benar.</Text>
            )
          ) : null}
          <Text style={[label, { marginTop: 10 }]}>Bergabung</Text>
          <Text style={{ fontSize: 15, color: '#111B21' }}>{tglPendek(a.dibuatPada)}</Text>
        </View>

        <View style={kotak}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#0B4F8A', letterSpacing: 0.6 }}>JABATAN & TEMPAT BERTUGAS (SUPERAPP)</Text>
          {!d && !galat ? <ActivityIndicator style={{ marginTop: 14 }} /> : null}
          {galat ? <Text style={{ color: '#C62828', marginTop: 8 }}>{galat}</Text> : null}
          {d?.superappGalat ? <Text style={{ color: '#8696A0', marginTop: 8 }}>{d.superappGalat}</Text> : null}
          {sp && !sp.penugasan.length ? <Text style={{ color: '#8696A0', marginTop: 8 }}>Tidak ada penugasan aktif di superapp.</Text> : null}
          {sp?.penugasan.map((p, i) => (
            <View key={i} style={{ marginTop: 12, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: '#E9EDEF' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111B21' }}>{p.jabatan}{p.plt ? ' (Plt.)' : ''}</Text>
              {p.unit ? <Text style={{ fontSize: 15, color: '#111B21', marginTop: 2 }}>{p.unit}</Text> : null}
              {p.induk ? <Text style={{ color: '#667781', marginTop: 1 }}>{p.induk}</Text> : null}
              {p.sejak ? <Text style={{ color: '#8696A0', fontSize: 12, marginTop: 3 }}>Sejak {tglPendek(p.sejak)}</Text> : null}
            </View>
          ))}
          {sp && sp.status !== 'AKTIF' ? <Text style={{ color: '#C62828', marginTop: 12 }}>Status di superapp: {sp.status}</Text> : null}
        </View>
      </ScrollView>
    </View>
  )
}
