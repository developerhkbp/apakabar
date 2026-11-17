import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import {
  buatGrup, detailGrup, hapusGrup, keluarkanDariGrup, tambahAnggotaGrup, ubahNamaGrup, ubahPeranGrup,
  type Anggota, type DetailGrup, type Sesi,
} from '../server'
import { Avatar } from '../avatar'
import { awalNama, s } from '../gaya'

/** Daftar anggota dengan kotak centang dan pencarian. */
function PilihAnggota({ daftar, terpilih, ubah }: { daftar: Anggota[]; terpilih: Set<string>; ubah: (id: string) => void }) {
  const [cari, setCari] = useState('')
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return q ? daftar.filter(a => a.nama.toLowerCase().includes(q)) : daftar
  }, [daftar, cari])
  return (
    <View style={{ flex: 1 }}>
      <TextInput style={s.cari} value={cari} onChangeText={setCari} placeholder="Cari nama" />
      <FlatList
        data={tampil}
        keyExtractor={a => a.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.kosong}>Tidak ada anggota yang cocok.</Text>}
        renderItem={({ item }) => {
          const pilih = terpilih.has(item.id)
          return (
            <Pressable style={s.barisObrolan} onPress={() => ubah(item.id)}>
              <View style={s.avatar}><Text style={s.avatarTeks}>{awalNama(item.nama)}</Text></View>
              <Text style={[s.nama, { flex: 1 }]}>{item.nama}</Text>
              <View style={[s.centang, pilih && s.centangAktif]}>{pilih ? <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text> : null}</View>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const gunakanPilihan = () => {
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set())
  const ubah = useCallback((id: string) => setTerpilih(x => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const kosongkan = useCallback(() => setTerpilih(new Set()), [])
  return { terpilih, ubah, kosongkan }
}

export function BuatGrup({ sesi, anggota, kembali, selesai }: { sesi: Sesi; anggota: Anggota[]; kembali: () => void; selesai: (g: DetailGrup) => void }) {
  const [nama, setNama] = useState('')
  const { terpilih, ubah } = gunakanPilihan()
  const [sibuk, setSibuk] = useState(false)
  const bisa = nama.trim().length > 0 && terpilih.size > 0 && !sibuk
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul}>Grup baru</Text>
          <Text style={s.subjudul}>{terpilih.size} anggota dipilih</Text>
        </View>
      </View>
      <TextInput style={[s.formKolom, { marginHorizontal: 16, marginTop: 12 }]} value={nama} onChangeText={setNama} placeholder="Nama grup" maxLength={80} />
      <PilihAnggota daftar={anggota} terpilih={terpilih} ubah={ubah} />
      <View style={{ padding: 12 }}>
        <Pressable
          style={[s.tombol, { marginTop: 0 }, !bisa && { opacity: 0.4 }]}
          disabled={!bisa}
          onPress={async () => {
            setSibuk(true)
            try { selesai(await buatGrup(sesi.token, nama, [...terpilih])) } catch (e) { Alert.alert('Grup belum dibuat', (e as Error).message) } finally { setSibuk(false) }
          }}
        >
          {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={s.tombolTeks}>Buat grup</Text>}
        </Pressable>
      </View>
    </View>
  )
}

export function InfoGrup({ sesi, grupId, anggota, kembali, bubar, jumlahMedia, bukaGaleri, bukaProfilGrup }: {
  sesi: Sesi; grupId: string; anggota: Anggota[]; kembali: () => void; bubar: () => void
  /** Jumlah lampiran yang pernah dibagikan di grup ini (dari riwayat di perangkat). */
  jumlahMedia: number; bukaGaleri: () => void
  /** Membuka layar foto grup (admin grup boleh mengganti). */
  bukaProfilGrup: () => void
}) {
  const [g, setG] = useState<DetailGrup | null>(null)
  const [galat, setGalat] = useState('')
  const [menambah, setMenambah] = useState(false)
  const [ubahNama, setUbahNama] = useState<string | null>(null)
  const { terpilih, ubah, kosongkan } = gunakanPilihan()

  const muat = useCallback(async () => {
    try { setG(await detailGrup(sesi.token, grupId)); setGalat('') } catch (e) { setGalat((e as Error).message) }
  }, [sesi.token, grupId])
  useEffect(() => { muat() }, [muat])

  const adminAplikasi = sesi.peran === 'ADMIN' || sesi.peran === 'ADMIN_UTAMA'
  const pengelola = adminAplikasi || g?.peranSaya === 'ADMIN_GRUP'
  const jalankan = async (fn: () => Promise<unknown>, sesudah?: () => void) => {
    try { await fn(); if (sesudah) sesudah(); else await muat() } catch (e) { Alert.alert('Tidak berhasil', (e as Error).message) }
  }
  const konfirmasi = (judul: string, isi: string, teksYa: string, fn: () => void) =>
    Alert.alert(judul, isi, [{ text: 'Batal', style: 'cancel' }, { text: teksYa, style: 'destructive', onPress: fn }])

  if (!g) {
    return (
      <View style={s.root}>
        <View style={[s.header, s.barisHeader]}>
          <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
          <Text style={s.judul}>Info grup</Text>
        </View>
        {galat ? <Text style={s.galat}>{galat}</Text> : <ActivityIndicator style={{ margin: 32 }} />}
      </View>
    )
  }

  if (menambah) {
    const sudah = new Set(g.anggota.map(a => a.id))
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <View style={[s.header, s.barisHeader]}>
          <Pressable onPress={() => setMenambah(false)} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.judul}>Tambah anggota</Text>
            <Text style={s.subjudul}>{terpilih.size} dipilih</Text>
          </View>
        </View>
        <PilihAnggota daftar={anggota.filter(a => !sudah.has(a.id))} terpilih={terpilih} ubah={ubah} />
        <View style={{ padding: 12 }}>
          <Pressable
            style={[s.tombol, { marginTop: 0 }, !terpilih.size && { opacity: 0.4 }]}
            disabled={!terpilih.size}
            onPress={() => jalankan(() => tambahAnggotaGrup(sesi.token, g.id, [...terpilih]), () => { setMenambah(false); kosongkan(); muat() })}
          >
            <Text style={s.tombolTeks}>Tambahkan</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const kelolaAnggota = (a: DetailGrup['anggota'][number]) => {
    if (!pengelola || a.id === sesi.id) return
    const adminGrup = a.peran === 'ADMIN_GRUP'
    Alert.alert(a.nama, undefined, [
      {
        text: adminGrup ? 'Cabut admin grup' : 'Jadikan admin grup',
        onPress: () => jalankan(() => ubahPeranGrup(sesi.token, g.id, a.id, adminGrup ? 'ANGGOTA' : 'ADMIN_GRUP')),
      },
      {
        text: 'Keluarkan dari grup',
        style: 'destructive',
        onPress: () => konfirmasi('Keluarkan dari grup?', `${a.nama} tidak akan menerima pesan baru dari grup ini.`, 'Keluarkan', () => jalankan(() => keluarkanDariGrup(sesi.token, g.id, a.id))),
      },
      { text: 'Batal', style: 'cancel' },
    ])
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Pressable style={[s.barisHeader, { flex: 1 }]} onPress={bukaProfilGrup}>
          <Avatar jenis="grup" id={g.id} v={g.fotoV} nama={g.nama} ukuran={36} />
          <View style={{ flex: 1 }}>
            <Text style={s.judul} numberOfLines={1}>{g.nama}</Text>
            <Text style={s.subjudul}>{g.anggota.length} anggota · ketuk untuk foto grup</Text>
          </View>
        </Pressable>
      </View>
      <FlatList
        data={g.anggota}
        keyExtractor={a => a.id}
        ListHeaderComponent={(
          <View>
            <Pressable style={[s.barisObrolan, { justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#E9EDEF' }]} onPress={bukaGaleri}>
              <View style={{ flex: 1 }}>
                <Text style={s.nama}>Media dan dokumen</Text>
                <Text style={s.cuplikan}>{jumlahMedia ? `${jumlahMedia} berkas dibagikan` : 'Belum ada berkas dibagikan'}</Text>
              </View>
              <Text style={{ color: '#667781', fontSize: 20 }}>›</Text>
            </Pressable>
            {pengelola ? (
              ubahNama === null ? (
                <View style={{ padding: 16, gap: 8 }}>
                  <Pressable style={s.tombolTepi} onPress={() => setUbahNama(g.nama)}><Text style={s.tombolTepiTeks}>Ganti nama grup</Text></Pressable>
                  <Pressable style={s.tombolTepi} onPress={() => { kosongkan(); setMenambah(true) }}><Text style={s.tombolTepiTeks}>Tambah anggota</Text></Pressable>
                </View>
              ) : (
                <View style={{ padding: 16 }}>
                  <TextInput style={s.formKolom} value={ubahNama} onChangeText={setUbahNama} maxLength={80} autoFocus />
                  <View style={s.aksiBaris}>
                    <Pressable style={[s.aksi, s.aksiPenuh]} onPress={() => jalankan(() => ubahNamaGrup(sesi.token, g.id, ubahNama), () => { setUbahNama(null); muat() })}>
                      <Text style={[s.aksiTeks, s.aksiPenuhTeks]}>Simpan</Text>
                    </Pressable>
                    <Pressable style={s.aksi} onPress={() => setUbahNama(null)}><Text style={s.aksiTeks}>Batal</Text></Pressable>
                  </View>
                </View>
              )
            ) : null}
            <Text style={s.seksi}>ANGGOTA</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable style={s.barisObrolan} onPress={() => kelolaAnggota(item)}>
            <Avatar jenis="anggota" id={item.id} v={item.fotoV} nama={item.nama} />
            <View style={{ flex: 1 }}>
              <Text style={s.nama}>{item.nama}{item.id === sesi.id ? ' (Anda)' : ''}</Text>
              {item.peran === 'ADMIN_GRUP' ? <View style={s.lencanaPeran}><Text style={s.lencanaPeranTeks}>Admin grup</Text></View> : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={(
          <View style={{ padding: 16, gap: 8 }}>
            {g.peranSaya ? (
              <Pressable
                style={[s.tombolTepi, { borderColor: '#E53935' }]}
                onPress={() => konfirmasi('Keluar dari grup?', 'Anda tidak akan menerima pesan baru dari grup ini.', 'Keluar', () => jalankan(() => keluarkanDariGrup(sesi.token, g.id, sesi.id), bubar))}
              >
                <Text style={[s.tombolTepiTeks, { color: '#E53935' }]}>Keluar dari grup</Text>
              </Pressable>
            ) : null}
            {pengelola ? (
              <Pressable
                style={[s.tombolTepi, { borderColor: '#E53935' }]}
                onPress={() => konfirmasi('Hapus grup?', 'Grup dihapus untuk semua anggota dan tidak bisa dikembalikan.', 'Hapus grup', () => jalankan(() => hapusGrup(sesi.token, g.id), bubar))}
              >
                <Text style={[s.tombolTepiTeks, { color: '#E53935' }]}>Hapus grup</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  )
}
