import { Image } from 'react-native'

/** Ikon aplikasi (assets/icon.png) dengan sudut membulat. */
export function Logo({ ukuran = 96 }: { ukuran?: number }) {
  return (
    <Image
      source={require('../assets/icon.png')}
      style={{ width: ukuran, height: ukuran, borderRadius: ukuran * 0.22 }}
      accessibilityLabel="ApaKabaR"
    />
  )
}

const KATA = {
  terang: require('../assets/wordmark-terang.png'), // untuk latar hijau tua
  putih: require('../assets/wordmark-putih.png'), // untuk latar emas (header admin)
  gelap: require('../assets/wordmark-gelap.png'), // untuk latar putih
} as const

/** Tulisan "ApaKabaR" sebagai gambar bermerek (rasio 4,88:1). */
export function Wordmark({ tinggi = 30, varian = 'terang' }: { tinggi?: number; varian?: keyof typeof KATA }) {
  return <Image source={KATA[varian]} style={{ height: tinggi, width: tinggi * 4.88 }} resizeMode="contain" accessibilityLabel="ApaKabaR" />
}
