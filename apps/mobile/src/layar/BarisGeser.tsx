import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { Animated, PanResponder, Pressable, Text, View } from 'react-native'

export type AksiGeser = { label: string; warna: string; onPress: () => void }

const LEBAR_TOMBOL = 78

/**
 * Baris yang bisa digeser ke kiri untuk memunculkan tombol aksi di sisi kanan.
 * Hanya satu baris yang terbuka: induk memegang `terbuka` dan mengubahnya lewat `onBuka` / `onTutup`.
 */
export function BarisGeser({
  aksi, terbuka, onBuka, onTutup, onPress, children,
}: {
  aksi: AksiGeser[]
  terbuka: boolean
  onBuka: () => void
  onTutup: () => void
  onPress: () => void
  children: ReactNode
}) {
  const lebar = aksi.length * LEBAR_TOMBOL
  const geser = useRef(new Animated.Value(0)).current
  const awal = useRef(0)
  const terbukaRef = useRef(terbuka)
  const lebarRef = useRef(lebar)
  const cb = useRef({ onBuka, onTutup })
  terbukaRef.current = terbuka
  lebarRef.current = lebar
  cb.current = { onBuka, onTutup }

  const animasi = (ke: number) =>
    Animated.spring(geser, { toValue: ke, useNativeDriver: true, bounciness: 0, speed: 20 }).start()

  useEffect(() => { animasi(terbuka ? -lebar : 0) }, [terbuka, lebar]) // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => lebarRef.current > 0 && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => { awal.current = terbukaRef.current ? -lebarRef.current : 0 },
    onPanResponderMove: (_, g) => {
      const x = Math.max(-lebarRef.current, Math.min(0, awal.current + g.dx))
      geser.setValue(x)
    },
    onPanResponderRelease: (_, g) => {
      const x = awal.current + g.dx
      const buka = x < -lebarRef.current / 2 || g.vx < -0.5
      if (buka && !terbukaRef.current) cb.current.onBuka()
      else if (!buka && terbukaRef.current) cb.current.onTutup()
      else animasi(buka ? -lebarRef.current : 0)
    },
    onPanResponderTerminate: () => animasi(terbukaRef.current ? -lebarRef.current : 0),
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ overflow: 'hidden', backgroundColor: '#fff' }}>
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: lebar, flexDirection: 'row' }}>
        {aksi.map(a => (
          <Pressable
            key={a.label}
            style={{ width: LEBAR_TOMBOL, backgroundColor: a.warna, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
            onPress={() => { onTutup(); a.onPress() }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ transform: [{ translateX: geser }], backgroundColor: '#fff' }} {...pan.panHandlers}>
        <Pressable onPress={() => (terbuka ? onTutup() : onPress())}>{children}</Pressable>
      </Animated.View>
    </View>
  )
}
