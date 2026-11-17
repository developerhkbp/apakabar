import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState } from 'react'
import { Image, Text, View } from 'react-native'
import Signal from '../modules/signal-protocol/src'
import { awalNama, s } from './gaya'
import { BASE } from './server'

let tokenFoto = ''
/** Token terbaru untuk mengunduh foto (alamat foto dilindungi login). */
export const setTokenFoto = (t: string) => { tokenFoto = t }

/** Foto bulat; bila belum ada foto (atau gagal dimuat) tampil huruf awal. `v` = versi foto, ikut di alamat agar cache segar. */
export function Avatar({ jenis, id, v, nama, ukuran = 48 }: { jenis: 'anggota' | 'grup'; id: string; v?: number; nama: string; ukuran?: number }) {
  const [galat, setGalat] = useState(false)
  useEffect(() => setGalat(false), [v, id])
  const bulat = { width: ukuran, height: ukuran, borderRadius: ukuran / 2 }
  if (v && !galat) {
    return (
      <Image
        source={{ uri: `${BASE}/foto/${jenis}/${id}?v=${v}`, headers: { Authorization: `Bearer ${tokenFoto}` } }}
        style={[bulat, { backgroundColor: '#DFE5E7' }]}
        onError={() => setGalat(true)}
      />
    )
  }
  return (
    <View style={[s.avatar, jenis === 'grup' && s.avatarGrup, bulat]}>
      <Text style={[s.avatarTeks, { fontSize: Math.round(ukuran * 0.38) }]}>{awalNama(nama)}</Text>
    </View>
  )
}

/** Memilih foto, memotong persegi, lalu memperkecil ke ±320 px JPEG di perangkat sebelum diunggah. */
export async function pilihFoto(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
  if (r.canceled || !r.assets[0]) return null
  const kecil = await Signal.thumbnail(r.assets[0].uri, false, 320)
  if (!kecil) throw new Error('Foto tidak dapat diproses')
  return kecil.replace(/^data:image\/jpeg;base64,/, '')
}
