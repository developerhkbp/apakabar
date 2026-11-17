import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { Avatar, pilihFoto } from '../avatar'
import { s } from '../gaya'

/**
 * Profil seseorang atau sebuah grup. Foto bisa diganti bila `bolehUbah`
 * (profil sendiri; atau grup oleh admin grup / admin aplikasi). Foto diperkecil di perangkat sebelum diunggah.
 */
export function Profil({ jenis, id, nama, subjudul, lencana, v, bolehUbah, simpanFoto, kembali }: {
  jenis: 'anggota' | 'grup'
  id: string
  nama: string
  subjudul?: string
  lencana?: string
  v?: number
  bolehUbah: boolean
  simpanFoto: (data: string | null) => Promise<void>
  kembali: () => void
}) {
  const [sibuk, setSibuk] = useState(false)
  /** `ambil` mengembalikan undefined bila dibatalkan, null untuk menghapus, atau data foto. */
  const jalankan = async (ambil: () => Promise<string | null | undefined>) => {
    setSibuk(true)
    try {
      const d = await ambil()
      if (d === undefined) return
      await simpanFoto(d)
    } catch (e) {
      Alert.alert('Foto gagal disimpan', (e as Error).message || 'Periksa koneksi lalu coba lagi.')
    } finally {
      setSibuk(false)
    }
  }
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Text style={s.judul}>{jenis === 'grup' ? 'Info grup' : 'Profil'}</Text>
      </View>
      <View style={{ alignItems: 'center', padding: 28, gap: 10 }}>
        <Avatar jenis={jenis} id={id} v={v} nama={nama} ukuran={168} />
        <Text style={{ fontSize: 22, fontWeight: '600', color: '#111B21', textAlign: 'center', marginTop: 8 }}>{nama}</Text>
        {subjudul ? <Text style={{ color: '#667781' }}>{subjudul}</Text> : null}
        {lencana ? (
          <View style={{ backgroundColor: '#A67C00', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{lencana}</Text>
          </View>
        ) : null}
        {bolehUbah ? (
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 18 }}>
            <Pressable style={s.tombolTepi} disabled={sibuk} onPress={() => jalankan(async () => (await pilihFoto()) ?? undefined)}>
              {sibuk ? <ActivityIndicator /> : <Text style={s.tombolTepiTeks}>{v ? 'Ganti foto' : 'Pilih foto'}</Text>}
            </Pressable>
            {v ? (
              <Pressable
                style={[s.tombolTepi, { borderColor: '#E53935' }]}
                disabled={sibuk}
                onPress={() => Alert.alert('Hapus foto?', undefined, [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Hapus', style: 'destructive', onPress: () => jalankan(async () => null) },
                ])}
              >
                <Text style={[s.tombolTepiTeks, { color: '#E53935' }]}>Hapus foto</Text>
              </Pressable>
            ) : null}
            <Text style={{ color: '#8696A0', fontSize: 12, textAlign: 'center' }}>Foto otomatis diperkecil sebelum diunggah.</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
