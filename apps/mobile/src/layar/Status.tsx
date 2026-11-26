import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Avatar } from '../avatar'
import { HIJAU, HIJAU_TUA, s, waktuDaftar } from '../gaya'
import type { Anggota, ArsipStatus, KomentarStatus, StatusHarian } from '../server'

export const PERTANYAAN_STATUS = 'Apa Kabar Anda Hari Ini?'
const SUASANA = ['😊', '🙏', '💪', '😴', '😔', '🤒']
const MAKS_STATUS = 280

/** Sisa waktu tayang status, mis. "berakhir 5 jam lagi". */
function sisaWaktu(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'berakhir'
  const jam = Math.floor(ms / 3600_000)
  return jam >= 1 ? `berakhir ${jam} jam lagi` : `berakhir ${Math.max(1, Math.floor(ms / 60_000))} menit lagi`
}

type Saya = { id: string; nama: string; v?: number }

/** Kolom tulis status gaya Facebook: foto sendiri + kolom ketik langsung "Apa kabar Anda hari ini?"; pilihan suasana dan tombol Bagikan muncul saat mengetik. */
function KolomTulisStatus({ saya, tambah }: { saya?: Saya; tambah: (teks: string, suasana?: string) => Promise<void> }) {
  const [teks, setTeks] = useState('')
  const [suasana, setSuasana] = useState<string | undefined>()
  const [fokus, setFokus] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const terbuka = fokus || teks.length > 0
  const kirim = async () => {
    if (sibuk || !teks.trim()) return
    setSibuk(true)
    try {
      await tambah(teks.trim(), suasana)
      setTeks(''); setSuasana(undefined); setFokus(false); Keyboard.dismiss()
    } catch (e) { Alert.alert('Status gagal dibagikan', (e as Error).message || 'Periksa koneksi lalu coba lagi.') } finally { setSibuk(false) }
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: terbuka ? 'flex-start' : 'center', gap: 10 }}>
        {saya ? <Avatar jenis="anggota" id={saya.id} v={saya.v} nama={saya.nama} ukuran={42} /> : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#DFE5E7' }} />}
        <TextInput
          value={teks}
          onChangeText={setTeks}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          maxLength={MAKS_STATUS}
          multiline
          placeholder={PERTANYAAN_STATUS}
          placeholderTextColor="#667781"
          style={{ flex: 1, minHeight: 42, maxHeight: 140, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 21, backgroundColor: '#F0F2F5', borderWidth: 1, borderColor: fokus ? HIJAU : '#E4E6E7', fontSize: 15.5, color: '#111B21', textAlignVertical: 'center' }}
        />
      </View>
      {terbuka ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {SUASANA.map(e => (
            <Pressable key={e} onPress={() => setSuasana(suasana === e ? undefined : e)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: suasana === e ? '#CFE6FA' : '#F0F2F5', borderWidth: suasana === e ? 2 : 0, borderColor: HIJAU }}>
              <Text style={{ fontSize: 18 }}>{e}</Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable
            disabled={sibuk || !teks.trim()}
            onPress={kirim}
            style={{ borderRadius: 20, paddingVertical: 9, paddingHorizontal: 18, backgroundColor: HIJAU_TUA, opacity: sibuk || !teks.trim() ? 0.45 : 1 }}
          >
            {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Bagikan</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

/** Lembar penyusun status baru (dipakai dari beranda dan dari Profil saya). */
export function PenyusunStatus({ tampil, tutup, simpan }: { tampil: boolean; tutup: () => void; simpan: (teks: string, suasana?: string) => Promise<void> }) {
  const insets = useSafeAreaInsets()
  const [teks, setTeks] = useState('')
  const [suasana, setSuasana] = useState<string | undefined>()
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => { if (tampil) { setTeks(''); setSuasana(undefined) } }, [tampil])

  const kirim = async () => {
    if (sibuk || !teks.trim()) return
    setSibuk(true)
    try { await simpan(teks.trim(), suasana); tutup() } catch (e) { Alert.alert('Status gagal dibagikan', (e as Error).message || 'Periksa koneksi lalu coba lagi.') } finally { setSibuk(false) }
  }

  return (
    <Modal visible={tampil} transparent animationType="slide" onRequestClose={tutup}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }} behavior="padding">
        <Pressable style={{ flex: 1 }} onPress={tutup} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 18 + insets.bottom, gap: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: HIJAU_TUA, letterSpacing: 0.6 }}>STATUS BARU</Text>
          <Text style={{ fontSize: 19, fontWeight: '700', color: '#111B21' }}>{PERTANYAAN_STATUS}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {SUASANA.map(e => (
              <Pressable key={e} onPress={() => setSuasana(suasana === e ? undefined : e)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: suasana === e ? '#CFE6FA' : '#F0F2F5', borderWidth: suasana === e ? 2 : 0, borderColor: HIJAU }}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={teks}
            onChangeText={setTeks}
            maxLength={MAKS_STATUS}
            multiline
            autoFocus
            placeholder="Ceritakan kabar Anda hari ini…"
            placeholderTextColor="#8696A0"
            style={{ minHeight: 90, maxHeight: 180, textAlignVertical: 'top', fontSize: 16, color: '#111B21', backgroundColor: '#F7F9FB', borderRadius: 12, padding: 12 }}
          />
          <Text style={{ fontSize: 12, color: '#8696A0', textAlign: 'right' }}>{teks.length}/{MAKS_STATUS}</Text>
          <Pressable
            disabled={sibuk || !teks.trim()}
            onPress={kirim}
            style={{ borderRadius: 24, paddingVertical: 13, alignItems: 'center', backgroundColor: HIJAU_TUA, opacity: sibuk || !teks.trim() ? 0.5 : 1 }}
          >
            {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Bagikan status</Text>}
          </Pressable>
          <Text style={{ color: '#8696A0', fontSize: 12 }}>Tampil 24 jam untuk orang yang satu grup dengan Anda (selain grup Pelayan). Status Admin Utama terlihat semua orang. Boleh membagikan beberapa status. Status dan komentar tidak dienkripsi ujung ke ujung.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** Kartu di Profil saya: semua status saya yang masih tayang, tombol tambah, lihat komentar, dan hapus. */
export function KartuStatusSaya({ daftar, riwayat, tambah, hapus, hapusRiwayat, buka, saya }: {
  saya?: Saya
  daftar: StatusHarian[]
  /** Status lama yang sudah berakhir 24 jam tetapi masih tersimpan di HP ini. */
  riwayat: ArsipStatus[]
  tambah: (teks: string, suasana?: string) => Promise<void>
  hapus: (id: string) => Promise<void>
  hapusRiwayat: (id: string) => void
  buka: (id: string) => void
}) {
  const [banyak, setBanyak] = useState(false)
  const tampilRiwayat = banyak ? riwayat : riwayat.slice(0, 5)
  const [sibuk, setSibuk] = useState(false)
  const hapusStatus = (id: string) => Alert.alert('Hapus status?', 'Komentar pada status ini juga ikut terhapus.', [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive',
      onPress: async () => {
        setSibuk(true)
        try { await hapus(id) } catch (e) { Alert.alert('Gagal menghapus', (e as Error).message || 'Periksa koneksi lalu coba lagi.') } finally { setSibuk(false) }
      },
    },
  ])

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#E9EDEF', gap: 10 }}>
      <KolomTulisStatus saya={saya} tambah={tambah} />
      {daftar.length ? <Text style={{ fontSize: 12, fontWeight: '700', color: HIJAU_TUA, letterSpacing: 0.6, marginTop: 4 }}>STATUS SAYA ({daftar.length})</Text> : null}
      {daftar.map(st => (
        <View key={st.id} style={{ backgroundColor: '#F7F9FB', borderRadius: 12, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 16, color: '#111B21', lineHeight: 22 }}>{st.suasana ? `${st.suasana}  ` : ''}{st.teks}</Text>
          <Text style={{ fontSize: 12, color: '#8696A0' }}>{waktuDaftar(new Date(st.dibuatPada).getTime())} · {sisaWaktu(st.kedaluwarsa)} · {st.jumlahKomentar} komentar</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => buka(st.id)} style={{ flex: 1, borderRadius: 20, paddingVertical: 9, alignItems: 'center', backgroundColor: HIJAU_TUA }}><Text style={{ color: '#fff', fontWeight: '700' }}>Lihat komentar</Text></Pressable>
            <Pressable disabled={sibuk} onPress={() => hapusStatus(st.id)} style={{ borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E53935' }}><Text style={{ color: '#E53935', fontWeight: '600' }}>Hapus</Text></Pressable>
          </View>
        </View>
      ))}
      {riwayat.length ? (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#667781', letterSpacing: 0.6 }}>RIWAYAT DI HP INI ({riwayat.length})</Text>
          <Text style={{ fontSize: 12, color: '#8696A0' }}>Status yang sudah berakhir 24 jam hanya Anda yang bisa melihat, dan tersimpan di HP ini saja.</Text>
          {tampilRiwayat.map(a => (
            <View key={a.id} style={{ backgroundColor: '#F7F9FB', borderRadius: 12, padding: 12, gap: 6 }}>
              <Text style={{ fontSize: 15, color: '#111B21', lineHeight: 21 }}>{a.suasana ? `${a.suasana}  ` : ''}{a.teks}</Text>
              <Text style={{ fontSize: 12, color: '#8696A0' }}>{waktuDaftar(new Date(a.dibuatPada).getTime())}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  disabled={sibuk}
                  onPress={async () => { setSibuk(true); try { await tambah(a.teks, a.suasana ?? undefined) } catch (e) { Alert.alert('Gagal membagikan', (e as Error).message || 'Periksa koneksi lalu coba lagi.') } finally { setSibuk(false) } }}
                  style={{ flex: 1, borderRadius: 20, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: HIJAU }}
                ><Text style={{ color: HIJAU_TUA, fontWeight: '600' }}>Bagikan lagi</Text></Pressable>
                <Pressable
                  onPress={() => Alert.alert('Hapus dari riwayat?', 'Hanya dihapus dari HP ini.', [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: () => hapusRiwayat(a.id) }])}
                  style={{ borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E53935' }}
                ><Text style={{ color: '#E53935', fontWeight: '600' }}>Hapus</Text></Pressable>
              </View>
            </View>
          ))}
          {riwayat.length > 5 ? (
            <Pressable onPress={() => setBanyak(v => !v)} style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: HIJAU_TUA, fontWeight: '600' }}>{banyak ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${riwayat.length})`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** Deretan status di beranda: kartu "Tambah status" paling depan, lalu status sendiri, lalu teman. Selalu tampil agar status mudah ditambah. */
export function BarisStatus({ daftar, anggota, buka, tambah, saya }: { saya?: Saya; daftar: StatusHarian[]; anggota: Anggota[]; buka: (id: string) => void; tambah: (teks: string, suasana?: string) => Promise<void> }) {
  // Satu kartu per orang (status terbarunya, plus jumlah status) supaya deretan tetap ringkas walau status sudah banyak.
  const orang = useMemo(() => {
    const m = new Map<string, StatusHarian[]>()
    for (const x of daftar) { const l = m.get(x.anggotaId); if (l) l.push(x); else m.set(x.anggotaId, [x]) }
    return [...m.values()].map(l => l.sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada)))
  }, [daftar])
  const fotoV = useMemo(() => new Map(anggota.map(a => [a.id, a.fotoV])), [anggota])
  return (
    <View style={{ paddingTop: 6, paddingBottom: 4 }}>
      <View style={{ backgroundColor: '#fff', marginHorizontal: 12, marginTop: 4, marginBottom: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E9EDEF' }}>
        <KolomTulisStatus saya={saya} tambah={tambah} />
      </View>
      {orang.length ? <Text style={[s.seksi, { marginBottom: 2 }]}>STATUS</Text> : null}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        data={orang}
        keyExtractor={l => l[0].anggotaId}
        initialNumToRender={6}
        windowSize={5}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
        renderItem={({ item: l }) => {
          const x = l[0]
          return (
            <Pressable onPress={() => buka(x.id)} style={{ width: 168, backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 1, borderWidth: 1, borderColor: x.saya ? HIJAU : '#E9EDEF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Avatar jenis="anggota" id={x.anggotaId} v={fotoV.get(x.anggotaId)} nama={x.nama} ukuran={34} />
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: '#111B21' }} numberOfLines={1}>{x.saya ? 'Status saya' : x.nama}</Text>
                {l.length > 1 ? <View style={{ backgroundColor: HIJAU_TUA, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>{l.length}</Text></View> : null}
              </View>
              <Text style={{ fontSize: 14, color: '#111B21', marginTop: 8, lineHeight: 19 }} numberOfLines={3}>{x.suasana ? `${x.suasana} ` : ''}{x.teks}</Text>
              <Text style={{ fontSize: 11.5, color: '#8696A0', marginTop: 6 }}>{x.jumlahKomentar ? `${x.jumlahKomentar} komentar · ` : ''}{waktuDaftar(new Date(x.dibuatPada).getTime())}</Text>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

/** Versi ringkas BarisStatus untuk di atas layar percakapan: lingkaran foto kecil, satu per orang. */
export function BarisStatusRingkas({ daftar, anggota, buka, tambah, saya }: { saya?: Saya; daftar: StatusHarian[]; anggota: Anggota[]; buka: (id: string) => void; tambah: (teks: string, suasana?: string) => Promise<void> }) {
  const [menulis, setMenulis] = useState(false)
  const orang = useMemo(() => {
    const m = new Map<string, StatusHarian[]>()
    for (const x of daftar) { const l = m.get(x.anggotaId); if (l) l.push(x); else m.set(x.anggotaId, [x]) }
    return [...m.values()].map(l => l.sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada)))
  }, [daftar])
  const fotoV = useMemo(() => new Map(anggota.map(a => [a.id, a.fotoV])), [anggota])
  return (
    <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: "#e4e6e7", paddingVertical: 8 }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        data={orang}
        keyExtractor={l => l[0].anggotaId}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}
        ListHeaderComponent={
          <Pressable onPress={() => setMenulis(true)} accessibilityLabel="Tulis status" style={{ alignItems: 'center', width: 58, marginRight: 14 }}>
            <View>
              {saya ? <Avatar jenis="anggota" id={saya.id} v={saya.v} nama={saya.nama} ukuran={44} /> : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#DFE5E7' }} />}
              <View style={{ position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: HIJAU_TUA, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '700' }}>+</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: HIJAU_TUA, marginTop: 3 }} numberOfLines={1}>Kabar saya</Text>
          </Pressable>
        }
        renderItem={({ item: l }) => {
          const x = l[0]
          return (
            <Pressable onPress={() => buka(x.id)} style={{ alignItems: 'center', width: 58 }}>
              <View style={{ padding: 2, borderRadius: 26, borderWidth: 2, borderColor: x.saya ? HIJAU : HIJAU_TUA }}>
                <Avatar jenis="anggota" id={x.anggotaId} v={fotoV.get(x.anggotaId)} nama={x.nama} ukuran={40} />
              </View>
              <Text style={{ fontSize: 11, color: '#54656f', marginTop: 3 }} numberOfLines={1}>{x.saya ? 'Saya' : x.nama.split(' ')[0]}</Text>
            </Pressable>
          )
        }}
      />
      <PenyusunStatus tampil={menulis} tutup={() => setMenulis(false)} simpan={tambah} />
    </View>
  )
}

/** Satu status beserta komentarnya. */
export function DetailStatus({ status, saudara, pilih, anggota, saya, muat, kirim, hapusKomentar, hapusStatus, kembali, berubah }: {
  status: StatusHarian
  /** Semua status aktif milik orang yang sama, terbaru dulu; pilih = pindah ke salah satunya. */
  saudara: StatusHarian[]
  pilih: (id: string) => void
  anggota: Anggota[]
  saya: string
  muat: () => Promise<KomentarStatus[]>
  kirim: (teks: string) => Promise<KomentarStatus>
  hapusKomentar: (id: string) => Promise<void>
  /** Hanya untuk status milik sendiri. */
  hapusStatus?: () => Promise<void>
  kembali: () => void
  berubah: () => void
}) {
  const insets = useSafeAreaInsets()
  const [daftar, setDaftar] = useState<KomentarStatus[] | null>(null)
  const [galat, setGalat] = useState('')
  const [isi, setIsi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [papan, setPapan] = useState(false)
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setPapan(true))
    const b = Keyboard.addListener('keyboardDidHide', () => setPapan(false))
    return () => { a.remove(); b.remove() }
  }, [])

  const ambil = useCallback(() => {
    muat().then(d => { setDaftar(d); setGalat('') }).catch(e => setGalat((e as Error).message || 'Gagal memuat komentar'))
  }, [muat])
  useEffect(() => {
    ambil()
    const t = setInterval(ambil, 20_000)
    return () => clearInterval(t)
  }, [ambil])

  const kirimKomentar = async () => {
    const t = isi.trim()
    if (!t || sibuk) return
    setSibuk(true)
    try {
      const k = await kirim(t)
      setDaftar(d => [...(d ?? []), k])
      setIsi('')
      berubah()
    } catch (e) {
      Alert.alert('Komentar gagal dikirim', (e as Error).message || 'Periksa koneksi lalu coba lagi.')
    } finally { setSibuk(false) }
  }

  const hapus = (k: KomentarStatus) => {
    if (k.anggotaId !== saya && !status.saya) return
    Alert.alert('Hapus komentar?', undefined, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => hapusKomentar(k.id).then(() => { setDaftar(d => (d ?? []).filter(x => x.id !== k.id)); berubah() }).catch(e => Alert.alert('Gagal menghapus', (e as Error).message)) },
    ])
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior="padding">
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul} numberOfLines={1}>{status.saya ? 'Status saya' : `Status ${status.nama}`}</Text>
          <Text style={s.subjudul}>{sisaWaktu(status.kedaluwarsa)}</Text>
        </View>
        {saudara.length > 1 ? (() => {
          const i = saudara.findIndex(x => x.id === status.id)
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable disabled={i >= saudara.length - 1} onPress={() => pilih(saudara[i + 1].id)} hitSlop={10} style={{ opacity: i >= saudara.length - 1 ? 0.35 : 1 }}><Text style={{ color: '#fff', fontSize: 22 }}>‹</Text></Pressable>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{saudara.length - i}/{saudara.length}</Text>
              <Pressable disabled={i <= 0} onPress={() => pilih(saudara[i - 1].id)} hitSlop={10} style={{ opacity: i <= 0 ? 0.35 : 1 }}><Text style={{ color: '#fff', fontSize: 22 }}>›</Text></Pressable>
            </View>
          )
        })() : null}
        {hapusStatus ? (
          <Pressable
            hitSlop={12}
            onPress={() => Alert.alert('Hapus status?', 'Komentar pada status ini juga ikut terhapus.', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Hapus', style: 'destructive', onPress: () => hapusStatus().then(kembali).catch(e => Alert.alert('Gagal menghapus', (e as Error).message || 'Periksa koneksi lalu coba lagi.')) },
            ])}
          ><Text style={{ color: '#fff', fontSize: 20 }}>🗑</Text></Pressable>
        ) : null}
      </View>
      <FlatList
        data={daftar ?? []}
        keyExtractor={k => k.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListHeaderComponent={
          <View style={{ backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar jenis="anggota" id={status.anggotaId} v={anggota.find(a => a.id === status.anggotaId)?.fotoV} nama={status.nama} ukuran={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111B21' }} numberOfLines={1}>{status.nama}</Text>
                <Text style={{ fontSize: 12, color: '#8696A0' }}>{waktuDaftar(new Date(status.dibuatPada).getTime())}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: HIJAU_TUA, marginTop: 14, letterSpacing: 0.4 }}>{PERTANYAAN_STATUS.toUpperCase()}</Text>
            <Text style={{ fontSize: 18, color: '#111B21', marginTop: 4, lineHeight: 25 }}>{status.suasana ? `${status.suasana}  ` : ''}{status.teks}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#667781', marginTop: 16 }}>{status.saya ? 'Komentar' : 'Komentar Anda'}{daftar ? ` (${daftar.length})` : ''}</Text>
            {!status.saya ? <Text style={{ fontSize: 12, color: '#8696A0', marginTop: 4 }}>Komentar bersifat pribadi: hanya Anda dan {status.nama} yang bisa membacanya.</Text> : null}
            {galat ? <Text style={{ color: '#E53935', marginTop: 8 }}>{galat}</Text> : null}
            {!daftar && !galat ? <ActivityIndicator style={{ marginTop: 12 }} color={HIJAU_TUA} /> : null}
            {daftar && !daftar.length ? <Text style={{ color: '#8696A0', marginTop: 8 }}>{status.saya ? 'Belum ada komentar.' : 'Anda belum berkomentar.'}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => hapus(item)} style={{ flexDirection: 'row', gap: 10, marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 14, padding: 12 }}>
            <Avatar jenis="anggota" id={item.anggotaId} v={anggota.find(a => a.id === item.anggotaId)?.fotoV} nama={item.nama} ukuran={34} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: '#111B21' }} numberOfLines={1}>{item.anggotaId === saya ? 'Anda' : item.nama}</Text>
                <Text style={{ fontSize: 11.5, color: '#8696A0' }}>{waktuDaftar(new Date(item.dibuatPada).getTime())}</Text>
              </View>
              <Text style={{ fontSize: 15, color: '#111B21', marginTop: 2 }}>{item.teks}</Text>
            </View>
          </Pressable>
        )}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: papan ? 10 : 10 + insets.bottom, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E9EDEF' }}>
        <TextInput
          value={isi}
          onChangeText={setIsi}
          maxLength={300}
          multiline
          placeholder={status.saya ? 'Tulis komentar…' : `Balas status ${status.nama}…`}
          placeholderTextColor="#8696A0"
          style={{ flex: 1, maxHeight: 110, fontSize: 15.5, color: '#111B21', backgroundColor: '#F0F2F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }}
        />
        <Pressable onPress={kirimKomentar} disabled={sibuk || !isi.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: HIJAU_TUA, alignItems: 'center', justifyContent: 'center', opacity: sibuk || !isi.trim() ? 0.5 : 1 }}>
          {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
