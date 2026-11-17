import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { detailGrup, type Pesan } from '../server'
import { awalNama, jam, s } from '../gaya'
import { ringkas } from '../konten'

const waktuLengkap = (t: number) => {
  const d = new Date(t)
  const hariIni = new Date().toDateString() === d.toDateString()
  return `${hariIni ? 'Hari ini' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${jam(t)}`
}

const Seksi = ({ judul, warna, daftar }: { judul: string; warna: string; daftar: { id: string; nama: string; waktu?: number }[] }) =>
  daftar.length ? (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: warna, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>{judul} ({daftar.length})</Text>
      {daftar.map(a => (
        <View key={a.id} style={s.barisObrolan}>
          <View style={[s.avatar, { width: 40, height: 40 }]}><Text style={s.avatarTeks}>{awalNama(a.nama)}</Text></View>
          <Text style={[s.nama, { flex: 1 }]}>{a.nama}</Text>
          {a.waktu ? <Text style={s.jamKecil}>{waktuLengkap(a.waktu)}</Text> : null}
        </View>
      ))}
    </View>
  ) : null

/** Info pesan: siapa yang sudah membaca, siapa yang sudah menerima, dan siapa yang belum. */
export function InfoPesan({ token, p, grupId, lawan, saya, kembali }: {
  token: string
  p: Pesan
  grupId?: string
  lawan?: { id: string; nama: string }
  saya: string
  kembali: () => void
}) {
  const [penerima, setPenerima] = useState<{ id: string; nama: string }[] | null>(lawan ? [lawan] : null)
  const [galat, setGalat] = useState('')
  useEffect(() => {
    if (!grupId) return
    detailGrup(token, grupId).then(d => setPenerima(d.anggota.filter(a => a.id !== saya).map(a => ({ id: a.id, nama: a.nama })))).catch(() => setGalat('Daftar anggota tidak dapat dimuat'))
  }, [grupId, token, saya])

  const baca = p.baca ?? {}
  const terima = p.terima ?? {}
  const dibaca = (penerima ?? []).filter(a => baca[a.id]).map(a => ({ ...a, waktu: baca[a.id] }))
  const sampai = (penerima ?? []).filter(a => !baca[a.id] && terima[a.id]).map(a => ({ ...a, waktu: terima[a.id] }))
  const belum = (penerima ?? []).filter(a => !baca[a.id] && !terima[a.id])

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Text style={s.judul}>Info pesan</Text>
      </View>
      <ScrollView>
        <View style={{ backgroundColor: '#EFE7DD', padding: 16 }}>
          <View style={[s.gelembung, s.keluar, { alignSelf: 'flex-end', maxWidth: '85%' }]}>
            <Text style={s.isi} numberOfLines={4}>{ringkas(p.teks) || 'Lampiran'}</Text>
            <Text style={s.meta}>{jam(p.waktu)}</Text>
          </View>
        </View>
        <Text style={{ color: '#667781', fontSize: 13, paddingHorizontal: 20, paddingTop: 14 }}>Dikirim {waktuLengkap(p.waktu)}</Text>
        {penerima === null && !galat ? <ActivityIndicator style={{ margin: 24 }} /> : null}
        {galat ? <Text style={s.galat}>{galat}</Text> : null}
        <Seksi judul="DIBACA OLEH" warna="#1E88E5" daftar={dibaca} />
        <Seksi judul="SAMPAI KE" warna="#667781" daftar={sampai} />
        <Seksi judul="BELUM SAMPAI" warna="#8696A0" daftar={belum} />
        <Text style={{ color: '#8696A0', fontSize: 12, padding: 20, lineHeight: 18 }}>
          Tanda baca dikirim lewat server sebagai penanda saja; isi pesan tetap terenkripsi ujung ke ujung.
        </Text>
      </ScrollView>
    </View>
  )
}
