import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Avatar } from '../avatar'
import type { PermintaanObrolan, StatusKontak } from '../server'

const tombol = (warna: string, terang = false) => ({
  flex: 1, paddingVertical: 12, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const,
  backgroundColor: terang ? '#fff' : warna, borderWidth: terang ? 1 : 0, borderColor: warna,
})

/** Pengganti kolom ketik di percakapan 1:1 selama belum ada izin saling berkirim pesan. */
export function BilahIzin({ nama, status, sibuk, minta, terima, tolak, blokir, bukaBlokir }: {
  nama: string
  status: StatusKontak | null
  sibuk: boolean
  minta: () => void
  terima: () => void
  tolak: () => void
  blokir: () => void
  bukaBlokir: () => void
}) {
  const insets = useSafeAreaInsets()
  let isi: React.ReactNode
  if (status === null) {
    isi = <ActivityIndicator color="#1976D2" />
  } else if (status === 'BELUM') {
    isi = (
      <>
        <Text style={t.judul}>Belum pernah berbincang dengan {nama}</Text>
        <Text style={t.isi}>Minta izin dulu. Pesan baru bisa dikirim setelah {nama} menerima.</Text>
        <View style={t.baris}>
          <Pressable style={tombol('#1976D2')} onPress={minta} disabled={sibuk}><Text style={t.tombolTeks}>Minta izin kirim pesan</Text></Pressable>
        </View>
        <Pressable onPress={blokir} hitSlop={8}><Text style={t.tautan}>Blokir {nama}</Text></Pressable>
      </>
    )
  } else if (status === 'SAYA_MINTA') {
    isi = (
      <>
        <Text style={t.judul}>Menunggu {nama} menerima</Text>
        <Text style={t.isi}>Permintaan sudah dikirim. Anda bisa mengirim pesan begitu diterima.</Text>
      </>
    )
  } else if (status === 'DIA_MINTA') {
    isi = (
      <>
        <Text style={t.judul}>{nama} ingin mengirim pesan kepada Anda</Text>
        <Text style={t.isi}>Setelah Anda terima, kalian bisa saling berkirim pesan.</Text>
        <View style={t.baris}>
          <Pressable style={tombol('#1976D2')} onPress={terima} disabled={sibuk}><Text style={t.tombolTeks}>Terima</Text></Pressable>
          <Pressable style={tombol('#667781', true)} onPress={tolak} disabled={sibuk}><Text style={[t.tombolTeks, { color: '#54656f' }]}>Tolak</Text></Pressable>
        </View>
        <Pressable onPress={blokir} hitSlop={8}><Text style={t.tautan}>Blokir {nama}</Text></Pressable>
      </>
    )
  } else if (status === 'DIBLOKIR_SAYA') {
    isi = (
      <>
        <Text style={t.judul}>{nama} Anda blokir</Text>
        <Text style={t.isi}>Buka blokir untuk berbincang kembali.</Text>
        <View style={t.baris}>
          <Pressable style={tombol('#1976D2')} onPress={bukaBlokir} disabled={sibuk}><Text style={t.tombolTeks}>Buka blokir</Text></Pressable>
        </View>
      </>
    )
  } else return null
  return (
    <View style={{ backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#D1D7DB', paddingHorizontal: 18, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 12) + 4, gap: 8, alignItems: 'center' }}>
      {isi}
    </View>
  )
}

/** Blok di beranda: orang yang meminta izin untuk mengirim pesan kepada saya. */
export function BarisPermintaan({ daftar, buka }: { daftar: PermintaanObrolan[]; buka: (p: PermintaanObrolan) => void }) {
  if (!daftar.length) return null
  return (
    <View style={{ backgroundColor: '#EAF2FC', borderBottomWidth: 0.5, borderBottomColor: '#D1DCEA', paddingVertical: 6 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1976D2', paddingHorizontal: 16, paddingVertical: 4 }}>PERMINTAAN PESAN ({daftar.length})</Text>
      {daftar.map(p => (
        <Pressable key={p.id} onPress={() => buka(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Avatar jenis="anggota" id={p.id} v={p.fotoV} nama={p.nama} ukuran={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111B21' }} numberOfLines={1}>{p.nama}</Text>
            <Text style={{ fontSize: 13, color: '#54656f' }}>Ingin mengirim pesan · ketuk untuk menjawab</Text>
          </View>
          <Text style={{ color: '#8696A0', fontSize: 20 }}>›</Text>
        </Pressable>
      ))}
    </View>
  )
}

/** Tombol Blokir / Buka blokir di profil anggota lain. */
export function KartuBlokir({ nama, diblokir, ubah }: { nama: string; diblokir: boolean; ubah: () => void }) {
  return (
    <Pressable onPress={ubah} style={{ marginTop: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: diblokir ? '#1976D2' : '#E53935', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 15.5, fontWeight: '600', color: diblokir ? '#1976D2' : '#E53935' }}>{diblokir ? `Buka blokir ${nama}` : `Blokir ${nama}`}</Text>
    </Pressable>
  )
}

const t = {
  judul: { fontSize: 15.5, fontWeight: '700' as const, color: '#111B21', textAlign: 'center' as const },
  isi: { fontSize: 13.5, color: '#54656f', textAlign: 'center' as const },
  baris: { flexDirection: 'row' as const, gap: 10, alignSelf: 'stretch' as const, marginTop: 4 },
  tombolTeks: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
  tautan: { color: '#E53935', fontSize: 13.5, marginTop: 4 },
}
