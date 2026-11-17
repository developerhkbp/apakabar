import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import {
  adminBlokir, adminBukaBlokir, adminDaftar, adminKeluarkan, adminRingkasan, adminSetujui, adminSetujuiBanyak,
  adminTambah, adminUbahPeran, type AnggotaAdmin, type Sesi, type StatusAnggota,
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
  const [galat, setGalat] = useState('')
  const [formTambah, setFormTambah] = useState(false)
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
      setGalat('')
    } catch (e) {
      if (no === permintaan.current) setGalat((e as Error).message)
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
    <View style={s.barisObrolan}>
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
      </View>
    </View>
  )

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Text style={[s.judul, { flex: 1 }]}>Kelola anggota</Text>
        {utama ? (
          <Pressable onPress={() => setFormTambah(x => !x)} hitSlop={12}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{formTambah ? 'Tutup' : '+ Tambah'}</Text>
          </Pressable>
        ) : null}
      </View>
      {formTambah ? <FormTambah token={sesi.token} selesai={() => { setFormTambah(false); setTab('AKTIF'); muat(1) }} /> : null}
      <View style={s.tab}>
        {TAB.map(t => (
          <Pressable key={t.status} style={[s.tabItem, tab === t.status && s.tabAktif]} onPress={() => { setData([]); setTab(t.status) }}>
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
        onEndReached={() => { if (!sibuk && data.length < total) muat(halaman + 1) }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={sibuk ? <ActivityIndicator style={{ margin: 32 }} /> : <Text style={s.kosong}>Tidak ada anggota di daftar ini.</Text>}
        ListFooterComponent={sibuk && data.length ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
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
