import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { GalatApi, segarkanStatus, type Sesi } from '../server'
import { HIJAU_TUA, s } from '../gaya'

/** Ditampilkan setelah nomor terverifikasi tetapi admin belum menyetujui. Terbuka otomatis begitu disetujui. */
export function Menunggu({ sesi, onAktif, onKeluar }: { sesi: Sesi; onAktif: (s: Sesi) => void; onKeluar: () => void }) {
  const [memeriksa, setMemeriksa] = useState(false)
  const [catatan, setCatatan] = useState('')

  const periksa = useCallback(async () => {
    setMemeriksa(true)
    try {
      const baru = await segarkanStatus(sesi)
      if (baru.status === 'AKTIF') onAktif(baru)
      else setCatatan(`Terakhir diperiksa ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`)
    } catch (e) {
      if (e instanceof GalatApi && e.status === 401) onKeluar() // akses dicabut atau perangkat diganti
      else setCatatan('Belum bisa terhubung ke server. Akan dicoba lagi.')
    } finally {
      setMemeriksa(false)
    }
  }, [sesi, onAktif, onKeluar])

  useEffect(() => {
    periksa()
    const t = setInterval(periksa, 8000)
    return () => clearInterval(t)
  }, [periksa])

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <View style={s.tengah}>
        <Text style={s.besar}>⏳</Text>
        <Text style={s.masukJudul}>Menunggu persetujuan admin</Text>
        <Text style={s.masukUrai}>
          Nomor HP Anda sudah terverifikasi, {sesi.nama}. Admin HKBP perlu menyetujui akun Anda sebelum bisa mulai mengobrol.
          Halaman ini akan terbuka otomatis setelah disetujui.
        </Text>
        {catatan ? <Text style={s.info}>{catatan}</Text> : null}
        <Pressable style={[s.tombol, { alignSelf: 'stretch' }, memeriksa && { opacity: 0.5 }]} disabled={memeriksa} onPress={periksa}>
          {memeriksa ? <ActivityIndicator color="#fff" /> : <Text style={s.tombolTeks}>Periksa sekarang</Text>}
        </Pressable>
        <Pressable onPress={onKeluar} hitSlop={12}><Text style={{ color: HIJAU_TUA, fontSize: 14 }}>Keluar</Text></Pressable>
      </View>
    </View>
  )
}
