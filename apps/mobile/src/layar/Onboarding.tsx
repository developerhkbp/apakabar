import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Logo, Wordmark } from '../logo'

const HALAMAN = [
  { lencana: '', judul: 'Selamat datang di ApaKabaR', isi: 'Kirim pesan kepada sesama anggota dengan cepat, ringan, dan dengan tampilan yang sudah Anda kenal.' },
  { lencana: '🔒', judul: 'Terenkripsi ujung ke ujung', isi: 'Setiap pesan diamankan dengan Protokol Signal. Hanya Anda dan lawan bicara yang dapat membacanya. Server pun tidak bisa.' },
  { lencana: '👥', judul: 'Grup hingga 2.000 anggota', isi: 'Admin membuat grup, menyetujui anggota baru, dan dapat menghapus pesan yang tidak pantas di grup.' },
  { lencana: '😊', judul: 'Lebih dari sekadar teks', isi: 'Kirim emoji, tautan dengan pratinjau, foto, dan video. Hapus pesan untuk semua orang atau hanya untuk diri sendiri. Tangkapan layar dilarang demi kerahasiaan.' },
]

export function Onboarding({ selesai }: { selesai: () => void }) {
  const [i, setI] = useState(0)
  const h = HALAMAN[i]
  const akhir = i === HALAMAN.length - 1
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 28, paddingTop: 56, paddingBottom: 36 }}>
      <StatusBar style="dark" />
      <View style={{ alignItems: 'flex-end', height: 24 }}>
        {!akhir ? <Pressable onPress={selesai} hitSlop={12}><Text style={{ color: '#667781', fontSize: 15 }}>Lewati</Text></Pressable> : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {i === 0 ? <View style={{ alignItems: 'center', gap: 14 }}><Logo ukuran={120} /><Wordmark tinggi={44} varian="gelap" /></View> : <Text style={{ fontSize: 72 }}>{h.lencana}</Text>}
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#111B21', textAlign: 'center' }}>{h.judul}</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: '#54656F', textAlign: 'center' }}>{h.isi}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {HALAMAN.map((_, n) => (
          <View key={n} style={{ width: n === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: n === i ? '#0B4F8A' : '#D1D7DB' }} />
        ))}
      </View>
      <Pressable
        style={{ backgroundColor: '#0B4F8A', borderRadius: 24, paddingVertical: 14, alignItems: 'center' }}
        onPress={() => (akhir ? selesai() : setI(i + 1))}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{akhir ? 'Mulai' : 'Berikutnya'}</Text>
      </Pressable>
    </View>
  )
}
