import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import Signal from '../modules/signal-protocol/src'
import type { Lampiran } from './konten'
import type { Terpilih } from './lampiran'

/** Batas durasi satu rekaman (detik). */
export const MAKS_DETIK_SUARA = 300

const waktu = (detik: number) => `${Math.floor(detik / 60)}:${String(Math.floor(detik % 60)).padStart(2, '0')}`

/** Pemutar pesan suara di dalam gelembung: berkas diunduh + didekripsi saat pertama diputar. */
export function PemutarSuara({ l, ambil, tekanLama }: { l: Lampiran; ambil: (l: Lampiran) => Promise<string>; tekanLama?: () => void }) {
  const pemutar = useAudioPlayer(null)
  const st = useAudioPlayerStatus(pemutar)
  const [memuat, setMemuat] = useState(false)
  const [siap, setSiap] = useState(false)
  const total = st.duration || l.d || 0
  const sampai = st.didJustFinish || (siap && total > 0 && st.currentTime >= total - 0.15)

  const tekan = async () => {
    if (memuat) return
    if (!siap) {
      setMemuat(true)
      try {
        const p = await ambil(l)
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
        pemutar.replace({ uri: p.startsWith('file://') ? p : `file://${p}` })
        setSiap(true)
        pemutar.play()
      } catch (e) {
        Alert.alert('Suara tidak dapat diputar', (e as Error).message || 'Periksa koneksi lalu coba lagi.')
      } finally {
        setMemuat(false)
      }
      return
    }
    if (st.playing) { pemutar.pause(); return }
    if (sampai) await pemutar.seekTo(0)
    pemutar.play()
  }

  const maju = total > 0 ? Math.min(1, st.currentTime / total) : 0
  return (
    <Pressable onPress={tekan} onLongPress={tekanLama} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 230, paddingVertical: 4 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center' }}>
        {memuat ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 17 }}>{st.playing ? '❚❚' : '▶'}</Text>}
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          <View style={{ width: `${maju * 100}%`, height: 4, backgroundColor: '#1976D2' }} />
        </View>
        <Text style={{ fontSize: 12, color: '#667781' }}>
          🎤 {siap && (st.playing || st.currentTime > 0) ? `${waktu(st.currentTime)} / ${waktu(total)}` : total ? waktu(total) : 'Pesan suara'}
        </Text>
      </View>
    </Pressable>
  )
}

/** Bilah perekam (menggantikan kolom ketik): langsung merekam saat tampil; ✕ membatalkan, ➤ mengirim. */
export function BilahRekam({ kirim, batal, bawah }: { kirim: (b: Terpilih) => void; batal: () => void; bawah: number }) {
  const perekam = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [detik, setDetik] = useState(0)
  const [siap, setSiap] = useState(false)
  const mulai = useRef(0)
  const selesaiRef = useRef(false)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      try {
        const izin = await requestRecordingPermissionsAsync()
        if (!izin.granted) {
          Alert.alert('Izin mikrofon diperlukan', 'Aktifkan izin mikrofon untuk ApaKabaR di pengaturan perangkat agar bisa merekam suara.')
          batal()
          return
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
        await perekam.prepareToRecordAsync()
        if (!hidup) return
        perekam.record()
        mulai.current = Date.now()
        setSiap(true)
      } catch (e) {
        if (hidup) { Alert.alert('Tidak dapat merekam', (e as Error).message || 'Coba lagi.'); batal() }
      }
    })()
    return () => {
      hidup = false
      if (!selesaiRef.current) { try { perekam.stop() } catch { /* belum mulai */ } }
      setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const akhiri = async () => {
    if (selesaiRef.current || !siap) return
    selesaiRef.current = true
    const lama = Math.max(1, Math.round((Date.now() - mulai.current) / 1000))
    try {
      await perekam.stop()
      const uri = perekam.uri
      if (!uri) throw new Error('Rekaman tidak tersimpan')
      kirim({ uri, nama: `suara-${Date.now()}.m4a`, mime: 'audio/mp4', ukuran: Signal.ukuranBerkas(uri), durasi: lama })
    } catch (e) {
      Alert.alert('Rekaman gagal', (e as Error).message || 'Coba lagi.')
      batal()
    }
  }

  useEffect(() => {
    if (!siap) return
    const t = setInterval(() => {
      const d = Math.floor((Date.now() - mulai.current) / 1000)
      setDetik(d)
      if (d >= MAKS_DETIK_SUARA) akhiri()
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siap])

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 8, paddingBottom: bawah, backgroundColor: '#EEF2F7' }}>
      <Pressable onPress={batal} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 1 }}>
        <Text style={{ fontSize: 18, color: '#E53935' }}>🗑</Text>
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 16, height: 52, elevation: 1 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: detik % 2 === 0 ? '#E53935' : '#F2A3A1' }} />
        <Text style={{ fontSize: 17, color: '#111B21', fontVariant: ['tabular-nums'] }}>{waktu(detik)}</Text>
        <Text style={{ fontSize: 13, color: '#667781', flex: 1 }} numberOfLines={1}>{siap ? 'Merekam…' : 'Menyiapkan…'}</Text>
      </View>
      <Pressable onPress={akhiri} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center', elevation: 2, opacity: siap ? 1 : 0.5 }}>
        <Text style={{ color: '#fff', fontSize: 20, marginLeft: 2 }}>➤</Text>
      </Pressable>
    </View>
  )
}
