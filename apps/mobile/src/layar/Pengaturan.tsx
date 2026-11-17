import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import type { Sesi } from '../server'
import { Avatar } from '../avatar'
import { s } from '../gaya'
import { Logo, Wordmark } from '../logo'

const VERSI = '1.0.0'

const Baris = ({ judul, isi, onPress, merah }: { judul: string; isi?: string; onPress?: () => void; merah?: boolean }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={{ paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: '#E9EDEF' }}>
    <Text style={{ fontSize: 16, color: merah ? '#E53935' : '#111B21' }}>{judul}</Text>
    {isi ? <Text style={{ fontSize: 13, color: '#667781', marginTop: 3, lineHeight: 18 }}>{isi}</Text> : null}
  </Pressable>
)

const Seksi = ({ t }: { t: string }) => (
  <Text style={{ fontSize: 13, fontWeight: '700', color: '#075E54', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>{t}</Text>
)

export function Pengaturan({ sesi, fotoV, bukaProfil, kembali, keluar }: { sesi: Sesi; fotoV?: number; bukaProfil: () => void; kembali: () => void; keluar: () => void }) {
  const [tentang, setTentang] = useState(false)
  const peran = sesi.peran === 'ADMIN_UTAMA' ? 'Admin utama' : sesi.peran === 'ADMIN' ? 'Admin' : 'Anggota'

  if (tentang) {
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <View style={[s.header, s.barisHeader]}>
          <Pressable onPress={() => setTentang(false)} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
          <Text style={s.judul}>Tentang aplikasi</Text>
        </View>
        <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 28, gap: 14 }}>
          <Logo ukuran={110} />
          <Wordmark tinggi={40} varian="gelap" />
          <Text style={{ color: '#667781' }}>Versi {VERSI}</Text>
          <Text style={{ fontSize: 15, lineHeight: 23, color: '#3B4A54', textAlign: 'center' }}>
            Aplikasi pesan tertutup untuk percakapan pribadi dan grup. Pendaftaran hanya untuk nomor yang telah didaftarkan dan disetujui admin.
          </Text>
          <View style={{ backgroundColor: '#E7F5EE', borderRadius: 12, padding: 16, alignSelf: 'stretch' }}>
            <Text style={{ fontWeight: '700', color: '#075E54', marginBottom: 6 }}>🔒 Enkripsi ujung ke ujung</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: '#3B4A54' }}>
              Pesan dienkripsi di perangkat pengirim dan hanya dapat dibuka di perangkat penerima, memakai Protokol Signal (Double Ratchet untuk percakapan pribadi dan Sender Keys untuk grup). Kunci tidak pernah meninggalkan perangkat Anda; server hanya meneruskan data terenkripsi.
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#8696A0' }}>© {new Date().getFullYear()} ApaKabaR</Text>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Text style={s.judul}>Pengaturan</Text>
      </View>
      <ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 }}>
          <Pressable onPress={bukaProfil} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
            <Avatar jenis="anggota" id={sesi.id} v={fotoV} nama={sesi.nama} ukuran={64} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: '600', color: '#111B21' }}>{sesi.nama}</Text>
              <Text style={{ color: '#667781', marginTop: 2 }}>{peran}</Text>
              <Text style={{ color: '#128C7E', marginTop: 2, fontSize: 13 }}>Ubah foto profil ›</Text>
            </View>
          </Pressable>
        </View>
        <Seksi t="KEAMANAN" />
        <Baris judul="Enkripsi ujung ke ujung" isi="Semua pesan dilindungi Protokol Signal. Hanya Anda dan lawan bicara yang dapat membacanya." />
        <Baris judul="Tangkapan layar dilarang" isi="Layar aplikasi tidak dapat difoto atau direkam. Pratinjau di daftar aplikasi terbaru juga disembunyikan." />
        <Baris judul="Satu perangkat per akun" isi="Akun hanya aktif di satu perangkat. Masuk di perangkat baru akan mengeluarkan perangkat lama." />
        <Seksi t="PESAN" />
        <Baris judul="Menghapus pesan" isi="Tekan lama sebuah pesan untuk menghapusnya untuk Anda sendiri atau untuk semua orang." />
        <Seksi t="LAINNYA" />
        <Baris judul="Tentang aplikasi" isi={`Versi ${VERSI}`} onPress={() => setTentang(true)} />
        <Baris
          judul="Keluar"
          merah
          onPress={() => Alert.alert('Keluar?', 'Kunci dan riwayat pesan di perangkat ini akan dihapus.', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Keluar', style: 'destructive', onPress: keluar },
          ])}
        />
      </ScrollView>
    </View>
  )
}
