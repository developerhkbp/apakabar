import { Linking, Text } from 'react-native'

const POLA = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi

/** Pecah teks menjadi potongan biasa dan tautan; tanda baca di ujung tautan dikembalikan ke teks biasa. */
export function TeksBertautan({ teks, warna = '#0B57D0' }: { teks: string; warna?: string }) {
  const bagian = teks.split(POLA)
  return (
    <>
      {bagian.map((b, i) => {
        if (i % 2 === 0) return b
        const m = /[).,;:!?'"\]]+$/.exec(b)
        const url = m ? b.slice(0, b.length - m[0].length) : b
        const sisa = m ? m[0] : ''
        const buka = () => Linking.openURL(/^https?:\/\//i.test(url) ? url : `https://${url}`).catch(() => {})
        return (
          <Text key={i}>
            <Text onPress={buka} style={{ color: warna, textDecorationLine: 'underline' }}>{url}</Text>
            {sisa}
          </Text>
        )
      })}
    </>
  )
}
