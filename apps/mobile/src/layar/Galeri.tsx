import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native'
import type { Pesan } from '../server'
import { s } from '../gaya'
import { adalahFoto, adalahVideo, buka, type Lampiran } from '../konten'
import { PetakMedia, Penampil, ukuranTeks } from '../lampiran'

/** Galeri semua media dan dokumen yang dibagikan dalam sebuah grup (dari riwayat di perangkat ini). */
export function Galeri({ judul, daftar, namaPengirim, ambil, kembali }: {
  judul: string
  daftar: Pesan[]
  namaPengirim: (id: string) => string
  ambil: (l: Lampiran) => Promise<string>
  kembali: () => void
}) {
  const [tab, setTab] = useState<'media' | 'dokumen'>('media')
  const [dibuka, setDibuka] = useState<Lampiran | null>(null)
  const { width } = useWindowDimensions()
  const kolom = 3
  const sisi = Math.floor((width - 4 * (kolom + 1)) / kolom)

  // terbaru di atas
  const semua = useMemo(() => {
    const hasil: { l: Lampiran; dari: string; waktu: number }[] = []
    for (const p of daftar) {
      if (p.dihapus) continue
      for (const l of buka(p.teks).lampiran ?? []) hasil.push({ l, dari: p.saya ? 'Anda' : namaPengirim(p.dari), waktu: p.waktu })
    }
    return hasil.reverse()
  }, [daftar, namaPengirim])
  const media = semua.filter(x => adalahFoto(x.l) || adalahVideo(x.l))
  const dokumen = semua.filter(x => !(adalahFoto(x.l) || adalahVideo(x.l)))

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.judul}>Media dan dokumen</Text>
          <Text style={s.subjudul} numberOfLines={1}>{judul}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E9EDEF' }}>
        {(['media', 'dokumen'] as const).map(t => (
          <Pressable key={t} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: tab === t ? '#1976D2' : 'transparent' }} onPress={() => setTab(t)}>
            <Text style={{ fontWeight: '600', color: tab === t ? '#0B4F8A' : '#667781' }}>
              {t === 'media' ? `Media (${media.length})` : `Dokumen (${dokumen.length})`}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'media' ? (
        <FlatList
          key="media"
          data={media}
          numColumns={kolom}
          keyExtractor={(x, i) => x.l.id + i}
          contentContainerStyle={{ padding: 2, gap: 4 }}
          columnWrapperStyle={{ gap: 4, paddingHorizontal: 2 }}
          ListEmptyComponent={<Text style={s.kosong}>Belum ada foto atau video yang dibagikan.</Text>}
          renderItem={({ item }) => <PetakMedia l={item.l} ukuran={sisi} onPress={() => setDibuka(item.l)} />}
        />
      ) : (
        <FlatList
          key="dokumen"
          data={dokumen}
          keyExtractor={(x, i) => x.l.id + i}
          ListEmptyComponent={<Text style={s.kosong}>Belum ada dokumen yang dibagikan.</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.barisObrolan} onPress={() => setDibuka(item.l)}>
              <Text style={{ fontSize: 28 }}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.nama} numberOfLines={1}>{item.l.n}</Text>
                <Text style={s.cuplikan}>{ukuranTeks(item.l.u)} · {item.dari} · {new Date(item.waktu).toLocaleDateString('id-ID')}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
      {dibuka ? <Penampil l={dibuka} ambil={ambil} tutup={() => setDibuka(null)} /> : null}
    </View>
  )
}
