import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Anggota, RingkasGrup } from '../server'
import { Avatar } from '../avatar'
import { ringkas } from '../konten'
import { s } from '../gaya'

type Tujuan = { kunci: string; nama: string; grup: boolean; id: string; v?: number }

/** Memilih satu atau beberapa percakapan/grup tujuan untuk meneruskan sebuah pesan. */
export function Teruskan({ anggota, grup, isi, kunciAsal, kirim, kembali }: {
  anggota: Anggota[]
  grup: RingkasGrup[]
  /** Isi pesan mentah yang diteruskan (untuk pratinjau). */
  isi: string
  /** Percakapan asal; tidak ditawarkan sebagai tujuan. */
  kunciAsal: string
  kirim: (tujuan: string[]) => Promise<void>
  kembali: () => void
}) {
  const insets = useSafeAreaInsets()
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState<string[]>([])
  const [mengirim, setMengirim] = useState(false)
  const semua = useMemo<Tujuan[]>(() => [
    ...grup.map(g => ({ kunci: 'g:' + g.id, nama: g.nama, grup: true, id: g.id, v: g.fotoV })),
    ...anggota.map(a => ({ kunci: a.id, nama: a.nama, grup: false, id: a.id, v: a.fotoV })),
  ].filter(t => t.kunci !== kunciAsal), [anggota, grup, kunciAsal])
  const q = cari.trim().toLowerCase()
  // Anggota bisa ribuan: tampilkan grup + hasil pencarian saja, maksimal 60 baris
  const data = (q ? semua.filter(t => t.nama.toLowerCase().includes(q)) : semua.filter(t => t.grup)).slice(0, 60)
  const ganti = (k: string) => setPilih(x => (x.includes(k) ? x.filter(i => i !== k) : [...x, k]))

  const kirimSekarang = async () => {
    if (!pilih.length || mengirim) return
    setMengirim(true)
    try { await kirim(pilih) } finally { setMengirim(false) }
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul}>Teruskan ke…</Text>
          <Text style={s.subjudul} numberOfLines={1}>{pilih.length ? `${pilih.length} dipilih` : ringkas(isi) || 'Pilih tujuan'}</Text>
        </View>
      </View>
      <TextInput
        style={{ backgroundColor: '#F0F2F5', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11, marginHorizontal: 14, marginVertical: 10, fontSize: 15.5 }}
        value={cari} onChangeText={setCari} placeholder="Cari nama atau grup" placeholderTextColor="#8696A0"
      />
      <FlatList
        data={data}
        keyExtractor={t => t.kunci}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={!q && data.length ? <Text style={s.seksi}>GRUP · cari nama untuk mengirim ke orang</Text> : undefined}
        ListEmptyComponent={<Text style={s.kosong}>{q ? 'Tidak ada yang cocok.' : 'Ketik nama untuk mencari tujuan.'}</Text>}
        renderItem={({ item }) => {
          const aktif = pilih.includes(item.kunci)
          return (
            <Pressable style={s.barisObrolan} onPress={() => ganti(item.kunci)}>
              <Avatar jenis={item.grup ? 'grup' : 'anggota'} id={item.id} v={item.v} nama={item.nama} />
              <View style={{ flex: 1 }}>
                <Text style={s.nama} numberOfLines={1}>{item.nama}</Text>
                <Text style={s.cuplikan}>{item.grup ? 'Grup' : 'Obrolan pribadi'}</Text>
              </View>
              <View style={[s.centang, aktif && s.centangAktif]}>{aktif ? <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text> : null}</View>
            </Pressable>
          )
        }}
      />
      {pilih.length ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E3E6E8' }}>
          <Pressable onPress={kirimSekarang} style={{ backgroundColor: '#128C7E', borderRadius: 28, paddingVertical: 14, alignItems: 'center', opacity: mengirim ? 0.6 : 1 }}>
            {mengirim ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Kirim ke {pilih.length} tujuan</Text>}
          </Pressable>
        </View>
      ) : <View style={{ height: insets.bottom }} />}
    </View>
  )
}
