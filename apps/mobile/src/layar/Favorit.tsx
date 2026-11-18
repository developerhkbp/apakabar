import { StatusBar } from 'expo-status-bar'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Pesan } from '../server'
import { ringkas } from '../konten'
import { s, waktuDaftar } from '../gaya'

export type ItemFavorit = { kunci: string; p: Pesan; tempat: string; pengirim: string }

/** Daftar pesan berbintang dari semua percakapan; ketuk untuk membuka percakapannya. */
export function Favorit({ daftar, buka, lepas, kembali }: {
  daftar: ItemFavorit[]
  buka: (kunci: string) => void
  lepas: (kunci: string, p: Pesan) => void
  kembali: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul}>Pesan berbintang</Text>
          <Text style={s.subjudul}>{daftar.length} pesan · tersimpan di perangkat ini</Text>
        </View>
      </View>
      <FlatList
        data={daftar}
        keyExtractor={x => x.kunci + x.p.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={<Text style={s.kosong}>Belum ada pesan berbintang. Geser pesan ke kiri lalu ketuk Favorit.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => buka(item.kunci)} style={{ backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 14, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#1976D2' }} numberOfLines={1}>{item.pengirim} · {item.tempat}</Text>
              <Text style={{ fontSize: 12, color: '#8696A0' }}>{waktuDaftar(item.p.waktu)}</Text>
            </View>
            <Text style={{ fontSize: 15, color: '#111B21', marginTop: 4 }} numberOfLines={4}>{ringkas(item.p.teks) || 'Pesan'}</Text>
            <Pressable onPress={() => lepas(item.kunci, item.p)} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
              <Text style={{ fontSize: 12.5, color: '#E53935' }}>★ Hapus dari favorit</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  )
}
