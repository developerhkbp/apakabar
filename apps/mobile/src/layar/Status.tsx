import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Avatar } from '../avatar'
import { HIJAU, HIJAU_TUA, s, waktuDaftar } from '../gaya'
import type { Anggota, KomentarStatus, StatusHarian } from '../server'

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

/** Kartu di Profil saya: menjawab "Apa Kabar Anda Hari Ini?", mengganti atau menghapus status. */
export function KartuStatusSaya({ status, simpan, hapus, buka }: {
  status: StatusHarian | null
  simpan: (teks: string, suasana?: string) => Promise<void>
  hapus: () => Promise<void>
  buka: () => void
}) {
  const [teks, setTeks] = useState(status?.teks ?? '')
  const [suasana, setSuasana] = useState<string | undefined>(status?.suasana ?? undefined)
  const [sibuk, setSibuk] = useState(false)
  const [mengubah, setMengubah] = useState(!status)
  useEffect(() => { if (status) { setTeks(status.teks); setSuasana(status.suasana ?? undefined); setMengubah(false) } else setMengubah(true) }, [status?.id, status?.teks])

  const jalan = async (fn: () => Promise<void>) => {
    setSibuk(true)
    try { await fn() } catch (e) { Alert.alert('Status gagal disimpan', (e as Error).message || 'Periksa koneksi lalu coba lagi.') } finally { setSibuk(false) }
  }

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#E9EDEF' }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: HIJAU_TUA, letterSpacing: 0.6 }}>STATUS</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111B21', marginTop: 4 }}>{PERTANYAAN_STATUS}</Text>
      {status && !mengubah ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          <Text style={{ fontSize: 16, color: '#111B21', lineHeight: 22 }}>{status.suasana ? `${status.suasana}  ` : ''}{status.teks}</Text>
          <Text style={{ fontSize: 12, color: '#8696A0' }}>{waktuDaftar(new Date(status.dibuatPada).getTime())} · {sisaWaktu(status.kedaluwarsa)} · {status.jumlahKomentar} komentar</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={buka} style={{ flex: 1, borderRadius: 22, paddingVertical: 10, alignItems: 'center', backgroundColor: HIJAU_TUA }}><Text style={{ color: '#fff', fontWeight: '700' }}>Lihat komentar</Text></Pressable>
            <Pressable onPress={() => setMengubah(true)} style={{ borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: HIJAU }}><Text style={{ color: HIJAU_TUA, fontWeight: '600' }}>Ubah</Text></Pressable>
            <Pressable
              disabled={sibuk}
              onPress={() => Alert.alert('Hapus status?', 'Komentar pada status ini juga ikut terhapus.', [
                { text: 'Batal', style: 'cancel' },
                { text: 'Hapus', style: 'destructive', onPress: () => jalan(hapus) },
              ])}
              style={{ borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E53935' }}
            ><Text style={{ color: '#E53935', fontWeight: '600' }}>Hapus</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 10, gap: 10 }}>
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
            placeholder="Ceritakan kabar Anda hari ini…"
            placeholderTextColor="#8696A0"
            style={{ minHeight: 80, textAlignVertical: 'top', fontSize: 16, color: '#111B21', backgroundColor: '#F7F9FB', borderRadius: 12, padding: 12 }}
          />
          <Text style={{ fontSize: 12, color: '#8696A0', textAlign: 'right' }}>{teks.length}/{MAKS_STATUS}</Text>
          <Pressable
            disabled={sibuk || !teks.trim()}
            onPress={() => jalan(async () => { await simpan(teks.trim(), suasana); setMengubah(false) })}
            style={{ borderRadius: 24, paddingVertical: 12, alignItems: 'center', backgroundColor: HIJAU_TUA, opacity: sibuk || !teks.trim() ? 0.5 : 1 }}
          >
            {sibuk ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{status ? 'Perbarui status' : 'Bagikan status'}</Text>}
          </Pressable>
          <Text style={{ color: '#8696A0', fontSize: 12 }}>Tampil 24 jam untuk teman satu grup buatan (bukan grup bawaan). Status dan komentar tidak dienkripsi ujung ke ujung.</Text>
        </View>
      )}
    </View>
  )
}

/** Deretan status di beranda: milik sendiri lebih dulu, lalu teman. Hanya dirender bila ada status. */
export function BarisStatus({ daftar, anggota, buka }: { daftar: StatusHarian[]; anggota: Anggota[]; buka: (id: string) => void }) {
  if (!daftar.length) return null
  return (
    <View style={{ paddingTop: 6, paddingBottom: 4 }}>
      <Text style={[s.seksi, { marginBottom: 2 }]}>STATUS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
        {daftar.map(x => (
          <Pressable key={x.id} onPress={() => buka(x.id)} style={{ width: 168, backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 1, borderWidth: 1, borderColor: x.saya ? HIJAU : '#E9EDEF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar jenis="anggota" id={x.anggotaId} v={anggota.find(a => a.id === x.anggotaId)?.fotoV} nama={x.nama} ukuran={34} />
              <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: '#111B21' }} numberOfLines={1}>{x.saya ? 'Status saya' : x.nama}</Text>
            </View>
            <Text style={{ fontSize: 14, color: '#111B21', marginTop: 8, lineHeight: 19 }} numberOfLines={3}>{x.suasana ? `${x.suasana} ` : ''}{x.teks}</Text>
            <Text style={{ fontSize: 11.5, color: '#8696A0', marginTop: 6 }}>{x.jumlahKomentar ? `${x.jumlahKomentar} komentar · ` : ''}{waktuDaftar(new Date(x.dibuatPada).getTime())}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

/** Satu status beserta komentarnya. */
export function DetailStatus({ status, anggota, saya, muat, kirim, hapusKomentar, kembali, berubah }: {
  status: StatusHarian
  anggota: Anggota[]
  saya: string
  muat: () => Promise<KomentarStatus[]>
  kirim: (teks: string) => Promise<KomentarStatus>
  hapusKomentar: (id: string) => Promise<void>
  kembali: () => void
  berubah: () => void
}) {
  const insets = useSafeAreaInsets()
  const [daftar, setDaftar] = useState<KomentarStatus[] | null>(null)
  const [galat, setGalat] = useState('')
  const [isi, setIsi] = useState('')
  const [sibuk, setSibuk] = useState(false)

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
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul} numberOfLines={1}>{status.saya ? 'Status saya' : `Status ${status.nama}`}</Text>
          <Text style={s.subjudul}>{sisaWaktu(status.kedaluwarsa)}</Text>
        </View>
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
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#667781', marginTop: 16 }}>Komentar{daftar ? ` (${daftar.length})` : ''}</Text>
            {galat ? <Text style={{ color: '#E53935', marginTop: 8 }}>{galat}</Text> : null}
            {!daftar && !galat ? <ActivityIndicator style={{ marginTop: 12 }} color={HIJAU_TUA} /> : null}
            {daftar && !daftar.length ? <Text style={{ color: '#8696A0', marginTop: 8 }}>Belum ada komentar. Jadilah yang pertama.</Text> : null}
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: 10 + insets.bottom, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E9EDEF' }}>
        <TextInput
          value={isi}
          onChangeText={setIsi}
          maxLength={300}
          multiline
          placeholder="Tulis komentar…"
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
