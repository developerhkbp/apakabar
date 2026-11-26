import { useRef, useState, type ReactNode } from 'react'
import { Animated, PanResponder, Pressable, Text, View } from 'react-native'

export type AksiGeser = { label: string; warna: string; aksi: () => void }

const LEBAR_TOMBOL = 70
/** Warna dasar latar percakapan; lapisan yang bergeser memakai warna ini agar tombol hanya terlihat saat baris ditarik. */
const LATAR = '#E6EDF5'
const AMBANG_BALAS = 56
const BATAS_BALAS = 80

/**
 * Pesan yang bisa digeser: ke kanan = balas (kembali sendiri ke posisi semula),
 * ke kiri = memunculkan deretan tombol aksi berblok warna setinggi baris, bergaya Kelola Anggota (Ubah, Teruskan, Favorit, Hapus). Hanya memakai API bawaan React Native.
 */
export function GeserPesan({ children, balas, aksi }: { children: ReactNode; balas?: () => void; aksi: AksiGeser[] }) {
  const x = useRef(new Animated.Value(0)).current
  const terbuka = useRef(false)
  const [terbukaS, setTerbukaS] = useState(false)
  const lebar = aksi.length * LEBAR_TOMBOL
  const terbaru = useRef({ balas, lebar })
  terbaru.current = { balas, lebar }

  const pindah = (ke: number, buka: boolean) => {
    terbuka.current = buka
    setTerbukaS(buka)
    Animated.spring(x, { toValue: ke, useNativeDriver: true, bounciness: 0, speed: 18 }).start()
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const { balas: b, lebar: l } = terbaru.current
        let v = (terbuka.current ? -l : 0) + g.dx
        if (v > 0) v = b ? Math.min(v * 0.6, BATAS_BALAS) : 0
        if (v < -l) v = -l + (v + l) * 0.3
        x.setValue(v)
      },
      onPanResponderRelease: (_, g) => {
        const { balas: b, lebar: l } = terbaru.current
        const v = (terbuka.current ? -l : 0) + g.dx
        if (b && v * 0.6 > AMBANG_BALAS) { b(); pindah(0, false) }
        else if (l > 0 && v < -l / 2) pindah(-l, true)
        else pindah(0, false)
      },
      onPanResponderTerminate: () => pindah(0, false),
    }),
  ).current

  return (
    <View style={{ overflow: 'hidden' }}>
      {balas ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', opacity: x.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' }) }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#0000001F', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: '#3B4A54' }}>↩</Text>
          </View>
        </Animated.View>
      ) : null}
      {/* Tombol berblok warna setinggi baris di sisi kanan, terbuka saat baris digeser ke kiri. */}
      <View
        pointerEvents={terbukaS ? 'auto' : 'none'}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: lebar, flexDirection: 'row' }}
      >
        {aksi.map(a => (
          <Pressable
            key={a.label}
            onPress={() => { pindah(0, false); a.aksi() }}
            style={{ width: LEBAR_TOMBOL, backgroundColor: a.warna, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: LATAR }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}
