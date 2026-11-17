import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { Avatar } from '../avatar'
import { s } from '../gaya'
import type { Anggota } from '../server'

const TINGGI = 72

/** Seluruh anggota (bisa ribuan) untuk memulai obrolan baru: dicari dulu, dan dirender malas (virtualisasi). */
export function Kontak({ anggota, pilih, kembali }: { anggota: Anggota[]; pilih: (a: Anggota) => void; kembali: () => void }) {
  const [cari, setCari] = useState('')
  const q = cari.trim().toLowerCase()
  const tampil = useMemo(() => (q ? anggota.filter(a => a.nama.toLowerCase().includes(q)) : anggota), [anggota, q])
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul}>Obrolan baru</Text>
          <Text style={s.subjudul}>{q ? `${tampil.length} dari ${anggota.length}` : `${anggota.length}`} anggota</Text>
        </View>
      </View>
      <TextInput style={s.cari} value={cari} onChangeText={setCari} placeholder="Cari nama anggota" autoFocus />
      <FlatList
        data={tampil}
        keyExtractor={a => a.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={7}
        getItemLayout={(_, i) => ({ length: TINGGI, offset: TINGGI * i, index: i })}
        ListEmptyComponent={<Text style={s.kosong}>{q ? 'Tidak ada yang cocok.' : 'Belum ada anggota lain yang aktif.'}</Text>}
        renderItem={({ item }) => (
          <Pressable style={[s.barisObrolan, { height: TINGGI }]} onPress={() => pilih(item)}>
            <Avatar jenis="anggota" id={item.id} v={item.fotoV} nama={item.nama} />
            <Text style={[s.nama, { flex: 1 }]} numberOfLines={1}>{item.nama}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}
