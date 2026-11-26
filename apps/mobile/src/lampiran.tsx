import { StatusBar } from 'expo-status-bar'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as Sharing from 'expo-sharing'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, ToastAndroid, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import Signal from '../modules/signal-protocol/src'
import { adalahAudio, adalahFoto, adalahVideo, type Lampiran } from './konten'
import { PemutarSuara } from './suara'

export const MAKS_BERKAS_PER_PESAN = 10
const MAKS_BYTE_BIASA = 25 * 1024 * 1024
const MAKS_BYTE_VIDEO = 64 * 1024 * 1024

/** Berkas yang dipilih pengguna dan belum diunggah. */
export type Terpilih = { uri: string; nama: string; mime: string; ukuran: number; durasi?: number }

export const ukuranTeks = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

const batas = (mime: string) => (mime.startsWith('video/') ? MAKS_BYTE_VIDEO : MAKS_BYTE_BIASA)

/** Memeriksa berkas pilihan; mengembalikan yang lolos dan daftar alasan penolakan. */
export function saring(berkas: Terpilih[], sudah: number): { lolos: Terpilih[]; ditolak: string[] } {
  const lolos: Terpilih[] = []
  const ditolak: string[] = []
  for (const b of berkas) {
    if (sudah + lolos.length >= MAKS_BERKAS_PER_PESAN) { ditolak.push(`${b.nama}: maksimal ${MAKS_BERKAS_PER_PESAN} berkas per pesan`); continue }
    if (!b.ukuran) { ditolak.push(`${b.nama}: berkas kosong`); continue }
    if (b.ukuran > batas(b.mime)) { ditolak.push(`${b.nama}: melebihi ${b.mime.startsWith('video/') ? '64' : '25'} MB`); continue }
    lolos.push(b)
  }
  return { lolos, ditolak }
}

export async function pilihFotoVideo(sudah: number): Promise<{ lolos: Terpilih[]; ditolak: string[] }> {
  const sisa = MAKS_BERKAS_PER_PESAN - sudah
  if (sisa <= 0) return { lolos: [], ditolak: [`Maksimal ${MAKS_BERKAS_PER_PESAN} berkas per pesan`] }
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: sisa,
    quality: 0.85,
  })
  if (r.canceled) return { lolos: [], ditolak: [] }
  return saring(
    r.assets.map(a => {
      const mime = a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg')
      return { uri: a.uri, nama: a.fileName ?? `${a.type === 'video' ? 'video' : 'foto'}-${Date.now()}`, mime, ukuran: a.fileSize ?? Signal.ukuranBerkas(a.uri) }
    }),
    sudah,
  )
}

export async function pilihDokumen(sudah: number): Promise<{ lolos: Terpilih[]; ditolak: string[] }> {
  if (sudah >= MAKS_BERKAS_PER_PESAN) return { lolos: [], ditolak: [`Maksimal ${MAKS_BERKAS_PER_PESAN} berkas per pesan`] }
  const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' })
  if (r.canceled) return { lolos: [], ditolak: [] }
  return saring(
    r.assets.map(a => ({ uri: a.uri, nama: a.name, mime: a.mimeType ?? 'application/octet-stream', ukuran: a.size ?? Signal.ukuranBerkas(a.uri) })),
    sudah,
  )
}

/** Mengenkripsi dan mengunggah semua berkas (berurutan agar memori hemat); mengembalikan lampiran untuk dimasukkan ke pesan. */
export async function unggahSemua(
  unggah: (uri: string) => Promise<{ id: string; kunci: string; iv: string; ukuran: number }>,
  berkas: Terpilih[],
  progres: (n: number, total: number) => void,
): Promise<Lampiran[]> {
  const hasil: Lampiran[] = []
  for (let i = 0; i < berkas.length; i++) {
    progres(i + 1, berkas.length)
    let b = berkas[i]
    // HEIC/HEIF diubah ke JPEG supaya terbuka di semua perangkat; bila gagal, kirim apa adanya
    if (/^image\/hei[cf]/i.test(b.mime) || /\.hei[cf]$/i.test(b.nama)) {
      try {
        const jpeg = await Signal.keJpeg(b.uri)
        if (jpeg) b = { ...b, uri: jpeg, mime: 'image/jpeg', nama: b.nama.replace(/\.hei[cf]$/i, '') + '.jpg', ukuran: Signal.ukuranBerkas(jpeg) }
      } catch { /* build lama tanpa fungsi ini */ }
    }
    const media = b.mime.startsWith('image/') || b.mime.startsWith('video/')
    const th = media ? await Signal.thumbnail(b.uri, b.mime.startsWith('video/'), 200).catch(() => null) : null
    const u = await unggah(b.uri)
    hasil.push({ id: u.id, k: u.kunci, iv: u.iv, n: b.nama, m: b.mime, u: b.ukuran, ...(th ? { th } : {}), ...(b.durasi ? { d: b.durasi } : {}) })
  }
  return hasil
}

const ikonBerkas = (l: Lampiran) => (adalahVideo(l) ? '🎥' : adalahFoto(l) ? '🖼️' : '📄')

/** Petak thumbnail satu lampiran media (foto/video). */
export function PetakMedia({ l, ukuran, onPress, onLongPress }: { l: Lampiran; ukuran: number; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ width: ukuran, height: ukuran, backgroundColor: '#CFD8DC', borderRadius: 6, overflow: 'hidden' }}>
      {l.th ? <Image source={{ uri: l.th }} style={{ width: ukuran, height: ukuran }} resizeMode="cover" /> : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 30 }}>{ikonBerkas(l)}</Text></View>
      )}
      {adalahVideo(l) ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>▶</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  )
}

/** Isi lampiran di dalam gelembung: grid thumbnail untuk foto/video, baris untuk dokumen. */
export function IsiLampiran({ daftar, buka, tekanLama, ambil }: { daftar: Lampiran[]; buka: (l: Lampiran) => void; tekanLama?: () => void; ambil?: (l: Lampiran) => Promise<string> }) {
  const media = daftar.filter(l => adalahFoto(l) || adalahVideo(l))
  const suara = ambil ? daftar.filter(adalahAudio) : []
  const dokumen = daftar.filter(l => !(adalahFoto(l) || adalahVideo(l)) && !suara.includes(l))
  const sisi = media.length === 1 ? 230 : 112
  return (
    <View style={{ gap: 4 }}>
      {media.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, width: media.length === 1 ? 230 : 227 }}>
          {media.map(l => <PetakMedia key={l.id} l={l} ukuran={sisi} onPress={() => buka(l)} onLongPress={tekanLama} />)}
        </View>
      ) : null}
      {suara.map(l => <PemutarSuara key={l.id} l={l} ambil={ambil!} tekanLama={tekanLama} />)}
      {dokumen.map(l => (
        <Pressable key={l.id} onPress={() => buka(l)} onLongPress={tekanLama} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0000000D', borderRadius: 8, padding: 10, width: 230 }}>
          <Text style={{ fontSize: 26 }}>📄</Text>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, color: '#111B21', fontWeight: '500' }}>{l.n}</Text>
            <Text style={{ fontSize: 12, color: '#667781' }}>{ukuranTeks(l.u)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const jarak = (t: readonly { pageX: number; pageY: number }[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY)

/** Gambar yang bisa diperbesar: cubit dua jari, geser saat diperbesar, ketuk dua kali untuk zoom/kembali. */
function GambarZoom({ uri }: { uri: string }) {
  const [tf, setTf] = useState({ s: 1, x: 0, y: 0 })
  const keadaan = useRef({ s: 1, x: 0, y: 0, awalJarak: 0, awalS: 1, awalX: 0, awalY: 0, ketukTerakhir: 0 })
  const terapkan = (s: number, x: number, y: number) => {
    const k = keadaan.current
    const bs = Math.min(5, Math.max(1, s))
    k.s = bs
    k.x = bs === 1 ? 0 : x
    k.y = bs === 1 ? 0 : y
    setTf({ s: k.s, x: k.x, y: k.y })
  }
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        const k = keadaan.current
        k.awalJarak = 0
        k.awalS = k.s
        k.awalX = k.x
        k.awalY = k.y
        const t = e.nativeEvent.touches
        if (t.length === 1) {
          const sekarang = Date.now()
          if (sekarang - k.ketukTerakhir < 280) {
            if (k.s > 1) terapkan(1, 0, 0)
            else terapkan(2.5, 0, 0)
            k.ketukTerakhir = 0
          } else k.ketukTerakhir = sekarang
        }
      },
      onPanResponderMove: (e, g) => {
        const k = keadaan.current
        const t = e.nativeEvent.touches
        if (t.length >= 2) {
          const d = jarak(t)
          if (!k.awalJarak) { k.awalJarak = d; k.awalS = k.s; k.awalX = k.x; k.awalY = k.y; return }
          terapkan(k.awalS * (d / k.awalJarak), k.x, k.y)
        } else if (k.s > 1 && !k.awalJarak) {
          terapkan(k.s, k.awalX + g.dx, k.awalY + g.dy)
        }
      },
    }),
  ).current
  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Image source={{ uri }} style={{ flex: 1, transform: [{ translateX: tf.x }, { translateY: tf.y }, { scale: tf.s }] }} resizeMode="contain" />
    </View>
  )
}

function PemutarVideo({ uri }: { uri: string }) {
  const p = useVideoPlayer(uri, x => { x.play() })
  return <VideoView player={p} style={{ flex: 1 }} nativeControls contentFit="contain" />
}

/**
 * Penampil layar penuh. Sengaja berupa tampilan biasa (bukan Modal) agar tetap tercakup FLAG_SECURE
 * milik jendela aplikasi — jendela Modal terpisah tidak ikut terlindungi dari tangkapan layar.
 */
export function Penampil({ l, ambil, tutup }: { l: Lampiran; ambil: (l: Lampiran) => Promise<string>; tutup: () => void }) {
  const [uri, setUri] = useState<string | null>(null)
  const [galat, setGalat] = useState('')
  const [ulang, setUlang] = useState(0)
  const [menyimpan, setMenyimpan] = useState(false)
  const dokumen = !(adalahFoto(l) || adalahVideo(l))

  useEffect(() => {
    let batal = false
    setGalat('')
    ambil(l)
      .then(async p => {
        if (batal) return
        let u = p.startsWith('file://') ? p : `file://${p}`
        // Foto HEIC/HEIF (dari pengirim lain/build lama) dibuka lewat salinan JPEG agar tampil di semua perangkat
        if (!dokumen && /^image\/hei[cf]/i.test(l.m)) {
          try { const j = await Signal.keJpeg(u); if (j) u = `file://${j}` } catch { /* pakai berkas asli */ }
        }
        if (dokumen) {
          try { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(u, { mimeType: l.m, dialogTitle: l.n }) } catch { /* dibatalkan */ }
          if (!batal) tutup()
        } else setUri(u)
      })
      .catch(e => { if (!batal) setGalat((e as Error).message || 'Gagal membuka berkas') })
    return () => { batal = true }
  }, [l, ulang])

  const simpan = async () => {
    if (!uri || menyimpan) return
    setMenyimpan(true)
    try {
      const heif = /^image\/hei[cf]/i.test(l.m)
      const nama = heif ? l.n.replace(/\.hei[cf]$/i, '') + '.jpg' : l.n
      const mime = heif ? 'image/jpeg' : l.m
      const ok = await Signal.simpanKeGaleri(uri, nama, mime)
      ToastAndroid.show(ok ? 'Tersimpan di galeri (album Apa Kabar)' : 'Gagal menyimpan ke galeri', ToastAndroid.SHORT)
    } catch {
      ToastAndroid.show('Gagal menyimpan. Perbarui aplikasi lalu coba lagi.', ToastAndroid.LONG)
    }
    setMenyimpan(false)
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 50 }]}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 10 }}>
        <Pressable onPress={tutup} hitSlop={14}><Text style={{ color: '#fff', fontSize: 24 }}>←</Text></Pressable>
        <Text style={{ color: '#fff', fontSize: 15, flex: 1 }} numberOfLines={1}>{l.n}</Text>
        {uri && !dokumen ? (
          <Pressable onPress={simpan} hitSlop={14} disabled={menyimpan} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF26', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{menyimpan ? 'Menyimpan…' : '⬇ Unduh'}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {galat ? (
          <View style={{ alignItems: 'center', padding: 24, gap: 14 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{galat}</Text>
            <Pressable onPress={() => setUlang(x => x + 1)} style={{ backgroundColor: '#1976D2', borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Coba lagi</Text>
            </Pressable>
          </View>
        ) : !uri ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            {l.th && !dokumen ? <Image source={{ uri: l.th }} style={{ width: 240, height: 240, opacity: 0.5 }} resizeMode="contain" /> : null}
            <ActivityIndicator color="#fff" size="large" />
            <Text style={{ color: '#ccc' }}>Mengunduh dan membuka kunci…</Text>
          </View>
        ) : adalahVideo(l) ? (
          <PemutarVideo uri={uri} />
        ) : (
          <GambarZoom uri={uri} />
        )}
      </View>
    </View>
  )
}
