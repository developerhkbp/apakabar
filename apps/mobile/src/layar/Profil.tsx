import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { Avatar, pilihFoto } from '../avatar'
import { HIJAU, HIJAU_TUA } from '../gaya'
import type { PeranAnggota, ProfilAnggota } from '../server'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** 6281234567890 → +62 812-3456-7890 */
function formatNomor(n: string) {
  const sisa = n.startsWith('62') ? n.slice(2) : n
  const potong = sisa.match(/^(\d{3})(\d{4})(\d+)$/)
  return `+${n.startsWith('62') ? '62 ' : ''}${potong ? `${potong[1]}-${potong[2]}-${potong[3]}` : sisa}`
}

function tanggal(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

const LABEL_PERAN: Record<PeranAnggota, string | null> = { USER: null, ADMIN: 'ADMIN', ADMIN_UTAMA: 'ADMIN UTAMA' }

function Baris({ ikon, judul, nilai, tekan }: { ikon: string; judul: string; nilai: string; tekan?: () => void }) {
  return (
    <Pressable disabled={!tekan} onPress={tekan} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6F0FB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 17 }}>{ikon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: '#667781' }}>{judul}</Text>
        <Text style={{ fontSize: 16, color: '#111B21', marginTop: 1 }}>{nilai}</Text>
      </View>
      {tekan ? <Text style={{ color: '#8696A0', fontSize: 20 }}>›</Text> : null}
    </Pressable>
  )
}

function Kartu({ judul, children }: { judul?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, marginTop: 12, borderWidth: 1, borderColor: '#E9EDEF' }}>
      {judul ? <Text style={{ fontSize: 12, fontWeight: '700', color: HIJAU_TUA, letterSpacing: 0.6, marginTop: 10 }}>{judul}</Text> : null}
      {children}
    </View>
  )
}

/**
 * Profil seseorang atau sebuah grup. Foto bisa diganti bila `bolehUbah`
 * (profil sendiri; atau grup oleh admin grup / admin aplikasi). Foto diperkecil di perangkat sebelum diunggah.
 * Untuk anggota, `muat` mengambil data lengkap (nomor HP, tanggal bergabung, grup bersama) dari server.
 */
export function Profil({ jenis, id, nama, subjudul, lencana, v, bolehUbah, simpanFoto, kembali, muat, kirimPesan, saya, online, tambahan }: {
  /** Bagian tambahan di bawah aksi cepat (mis. kartu status). */
  tambahan?: React.ReactNode
  jenis: 'anggota' | 'grup'
  id: string
  nama: string
  subjudul?: string
  lencana?: string
  v?: number
  bolehUbah: boolean
  simpanFoto: (data: string | null) => Promise<void>
  kembali: () => void
  muat?: () => Promise<ProfilAnggota>
  kirimPesan?: () => void
  saya?: boolean
  online?: boolean
}) {
  const [sibuk, setSibuk] = useState(false)
  const [data, setData] = useState<ProfilAnggota | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!muat) return
    let batal = false
    muat().then(d => { if (!batal) setData(d) }).catch(e => { if (!batal) setGalat((e as Error).message) })
    return () => { batal = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  const ubahFoto = () => {
    const pilih = () => jalankan(async () => (await pilihFoto()) ?? undefined)
    if (!v) { pilih(); return }
    Alert.alert('Foto profil', undefined, [
      { text: 'Pilih foto baru', onPress: pilih },
      { text: 'Hapus foto', style: 'destructive', onPress: () => jalankan(async () => null) },
      { text: 'Batal', style: 'cancel' },
    ])
  }

  const labelPeran = lencana ?? (data ? LABEL_PERAN[data.peran] : null)
  const gelap = '#0A2540'

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Sampul */}
        <View style={{ backgroundColor: gelap, paddingTop: 48, paddingBottom: 70, paddingHorizontal: 16 }}>
          <View style={{ position: 'absolute', right: -50, top: -30, width: 190, height: 190, borderRadius: 95, backgroundColor: HIJAU_TUA, opacity: 0.55 }} />
          <View style={{ position: 'absolute', left: -40, bottom: -60, width: 150, height: 150, borderRadius: 75, backgroundColor: HIJAU, opacity: 0.12 }} />
          <Pressable onPress={kembali} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '600' }}>{jenis === 'grup' ? 'Info grup' : saya ? 'Profil saya' : 'Profil'}</Text>
          </Pressable>
        </View>

        {/* Foto menumpuk di batas sampul */}
        <View style={{ alignItems: 'center', marginTop: -62 }}>
          <View style={{ padding: 5, backgroundColor: '#fff', borderRadius: 100, borderWidth: 1, borderColor: '#E9EDEF' }}>
            <Avatar jenis={jenis} id={id} v={v} nama={nama} ukuran={132} />
            {sibuk ? (
              <View style={{ position: 'absolute', left: 5, top: 5, width: 132, height: 132, borderRadius: 66, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
            {bolehUbah ? (
              <Pressable
                disabled={sibuk}
                onPress={ubahFoto}
                accessibilityLabel="Ubah foto"
                hitSlop={8}
                style={{ position: 'absolute', right: 2, bottom: 6, width: 42, height: 42, borderRadius: 21, backgroundColor: HIJAU_TUA, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3 }}
              >
                <Text style={{ fontSize: 18 }}>📷</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111B21', textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>{nama}</Text>
          {subjudul ? <Text style={{ color: '#667781', marginTop: 2 }}>{subjudul}</Text> : null}
          {online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: HIJAU }} />
              <Text style={{ color: HIJAU_TUA, fontWeight: '600' }}>online</Text>
            </View>
          ) : null}
          {labelPeran ? (
            <View style={{ backgroundColor: '#A67C00', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{labelPeran}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* Aksi cepat */}
          {jenis === 'anggota' && !saya && data ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              {kirimPesan ? (
                <Pressable onPress={kirimPesan} style={{ flex: 1, backgroundColor: HIJAU_TUA, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>💬  Kirim pesan</Text>
                </Pressable>
              ) : null}
              {data.nomorHp ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:+${data.nomorHp}`).catch(() => Alert.alert('Tidak dapat menelepon'))}
                  style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: HIJAU_TUA }}
                >
                  <Text style={{ color: HIJAU_TUA, fontWeight: '700' }}>📞  Telepon</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {tambahan}

          {/* Data anggota */}
          {muat ? (
            data ? (
              <>
                <Kartu judul="INFORMASI">
                  {data.nomorHp ? (
                    <Baris ikon="📱" judul="Nomor HP" nilai={formatNomor(data.nomorHp)} tekan={saya ? undefined : () => Linking.openURL(`tel:+${data.nomorHp}`).catch(() => {})} />
                  ) : null}
                  <Baris ikon="🗓" judul="Bergabung di ApaKabaR" nilai={tanggal(data.dibuatPada)} />
                  <Baris ikon="👥" judul="Grup diikuti" nilai={saya ? `${data.grupBersama.length} grup` : `${data.grupBersama.length} grup bersama Anda`} />
                </Kartu>
                {data.grupBersama.length ? (
                  <Kartu judul={saya ? 'GRUP SAYA' : 'GRUP BERSAMA'}>
                    {data.grupBersama.map(g => (
                      <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
                        <Avatar jenis="grup" id={g.id} v={g.fotoV} nama={g.nama} ukuran={42} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, color: '#111B21' }} numberOfLines={1}>{g.nama}</Text>
                          <Text style={{ fontSize: 12, color: '#667781' }}>{g.jumlah} anggota{g.peranDiGrup === 'ADMIN_GRUP' ? ' · admin grup' : ''}</Text>
                        </View>
                      </View>
                    ))}
                  </Kartu>
                ) : null}
              </>
            ) : galat ? (
              <Text style={{ color: '#E53935', textAlign: 'center', marginTop: 24 }}>{galat}</Text>
            ) : (
              <ActivityIndicator style={{ marginTop: 28 }} color={HIJAU_TUA} />
            )
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}
