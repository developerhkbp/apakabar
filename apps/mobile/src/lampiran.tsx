import { StatusBar } from 'expo-status-bar'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as Sharing from 'expo-sharing'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Signal from '../modules/signal-protocol/src'
import { adalahFoto, adalahVideo, type Lampiran } from './konten'

export const MAKS_BERKAS_PER_PESAN = 10
const MAKS_BYTE_BIASA = 25 * 1024 * 1024
const MAKS_BYTE_VIDEO = 64 * 1024 * 1024

/** Berkas yang dipilih pengguna dan belum diunggah. */
export type Terpilih = { uri: string; nama: string; mime: string; ukuran: number }

export const ukuranTeks = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

const batas = (mime: string) => (mime.startsWith('video/') ? MAKS_BYTE_VIDEO : MAKS_BYTE_BIASA)

/** Memeriksa berkas pilihan; mengembalikan yang lolos dan daftar alasan penolakan. */
function saring(berkas: Terpilih[], sudah: number): { lolos: Terpilih[]; ditolak: string[] } {
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
    const b = berkas[i]
    const media = b.mime.startsWith('image/') || b.mime.startsWith('video/')
    const th = media ? await Signal.thumbnail(b.uri, b.mime.startsWith('video/'), 200).catch(() => null) : null
    const u = await unggah(b.uri)
    hasil.push({ id: u.id, k: u.kunci, iv: u.iv, n: b.nama, m: b.mime, u: b.ukuran, ...(th ? { th } : {}) })
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
export function IsiLampiran({ daftar, buka, tekanLama }: { daftar: Lampiran[]; buka: (l: Lampiran) => void; tekanLama?: () => void }) {
  const media = daftar.filter(l => adalahFoto(l) || adalahVideo(l))
  const dokumen = daftar.filter(l => !(adalahFoto(l) || adalahVideo(l)))
  const sisi = media.length === 1 ? 230 : 112
  return (
    <View style={{ gap: 4 }}>
      {media.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, width: media.length === 1 ? 230 : 227 }}>
          {media.map(l => <PetakMedia key={l.id} l={l} ukuran={sisi} onPress={() => buka(l)} onLongPress={tekanLama} />)}
        </View>
      ) : null}
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
  const dokumen = !(adalahFoto(l) || adalahVideo(l))

  useEffect(() => {
    let batal = false
    setGalat('')
    ambil(l)
      .then(async p => {
        if (batal) return
        const u = p.startsWith('file://') ? p : `file://${p}`
        if (dokumen) {
          try { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(u, { mimeType: l.m, dialogTitle: l.n }) } catch { /* dibatalkan */ }
          if (!batal) tutup()
        } else setUri(u)
      })
      .catch(e => { if (!batal) setGalat((e as Error).message || 'Gagal membuka berkas') })
    return () => { batal = true }
  }, [l, ulang])

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 50 }]}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 10 }}>
        <Pressable onPress={tutup} hitSlop={14}><Text style={{ color: '#fff', fontSize: 24 }}>←</Text></Pressable>
        <Text style={{ color: '#fff', fontSize: 15, flex: 1 }} numberOfLines={1}>{l.n}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {galat ? (
          <View style={{ alignItems: 'center', padding: 24, gap: 14 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{galat}</Text>
            <Pressable onPress={() => setUlang(x => x + 1)} style={{ backgroundColor: '#128C7E', borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 }}>
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
          <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" />
        )}
      </View>
    </View>
  )
}
