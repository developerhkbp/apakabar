import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ActivityIndicator, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { Pesan } from '../server'
import { awalNama, jam, labelHari, sehari, s } from '../gaya'
import { buka, ringkas, type Lampiran } from '../konten'
import { GeserPesan } from '../geser'
import { BilahRekam } from '../suara'
import { TeksBertautan } from '../tautan'
import { IsiLampiran,Penampil, pilihDokumen, pilihFotoVideo, ukuranTeks, type Terpilih } from '../lampiran'

const EMOJI = (
  '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 😐 😑 😶 😏 😒 🙄 😬 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 ' +
  '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👏 🙌 👐 🤲 🤝 🙏 💪 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💞 💓 💗 💖 💘 💝 🔥 ✨ ⭐ 🌟 💫 🎉 🎊 🎁 🏆 🎶 🎵 ' +
  '⛪ ✝️ 🕊️ 📖 🕯️ 🌿 🌹 🌷 🌻 ☀️ 🌙 🌈 ☁️ ⚡ ❄️ 🌍 🍎 🍞 🍇 ☕ 🍰 🎂'
).split(' ')

type Baris = { t: 'hari'; id: string; label: string } | { t: 'pesan'; p: Pesan }

/** ✓ terkirim ke server, ✓✓ sudah sampai ke semua penerima, ✓✓ biru sudah dibaca semua penerima. */
function Centang({ p, total }: { p: Pesan; total: number }) {
  const baca = Object.keys(p.baca ?? {}).length
  const sampai = new Set([...Object.keys(p.terima ?? {}), ...Object.keys(p.baca ?? {})]).size
  const biru = total > 0 && baca >= total
  const ganda = total > 0 && sampai >= total
  return <Text style={{ color: biru ? '#34B7F1' : '#667781', fontWeight: '700' }}>{ganda ? '✓✓' : '✓'}</Text>
}

/** Percakapan 1:1 maupun grup. Untuk grup, `namaPengirim` menampilkan nama di atas gelembung masuk. */
export function Percakapan({ balasan, batalBalas, namaBalas, fotoPengirim, avatar, judul, subjudul, grup, jumlahPenerima, daftar, kirim, kirimLampiran, ambil, kembali, bukaInfo, namaPengirim, tekanLama, kirimUlang, geser, bilahIzin, bilahAtas, saya, sunting, batalSunting, simpanSunting }: {
  /** Pesan saya yang sedang diubah isinya (kolom ketik terisi teks lamanya). */
  sunting?: Pesan | null
  batalSunting?: () => void
  simpanSunting?: (p: Pesan, teksBaru: string) => void
  /** Bila ada, menggantikan kolom ketik (mis. harus minta izin dulu). */
  bilahIzin?: ReactNode
  /** Bilah di bawah header, mis. deretan status teman. */
  bilahAtas?: ReactNode
  /** Id saya, untuk menandai reaksi milik sendiri. */
  saya?: string
  judul: string
  subjudul?: string
  grup?: boolean
  /** Jumlah penerima selain saya (1 untuk percakapan pribadi); menentukan kapan centang jadi ✓✓. */
  jumlahPenerima: number
  daftar: Pesan[]
  /** Mengirim ulang pesan yang gagal (ketuk gelembung bertanda ⚠). */
  kirimUlang?: (p: Pesan) => void
  kirim: (t: string) => Promise<void>
  /** Mengenkripsi + mengunggah berkas lalu mengirim pesan berlampiran. Melempar galat bila gagal. */
  kirimLampiran: (teks: string, berkas: Terpilih[], progres: (n: number, total: number) => void) => Promise<void>
  /** Mengunduh + mendekripsi lampiran; mengembalikan jalur berkas lokal. */
  ambil: (l: Lampiran) => Promise<string>
  kembali: () => void
  bukaInfo?: () => void
  /** Foto di header (bulat 36); bila kosong tampil huruf awal. */
  avatar?: ReactNode
  namaPengirim?: (id: string) => string
  /** Foto kecil (±28) pengirim, ditampilkan di samping tiap pesan masuk. */
  fotoPengirim?: (id: string) => ReactNode
  /** Aksi geser pada pesan: kanan = balas, kiri = tombol Ubah/Teruskan/Favorit/Hapus. */
  geser?: { balas?: (p: Pesan) => void; ubah?: (p: Pesan) => void; teruskan: (p: Pesan) => void; favorit: (p: Pesan) => void; hapus: (p: Pesan) => void }
  /** Menu saat gelembung ditekan lama (mis. hapus pesan). */
  tekanLama?: (p: Pesan) => void
  /** Pesan yang sedang dibalas (ditampilkan di atas kolom ketik). */
  balasan?: Pesan | null
  batalBalas?: () => void
  /** Nama pengirim untuk kutipan balasan ("Anda" bila pesan saya). */
  namaBalas?: (id: string) => string
}) {
  const insets = useSafeAreaInsets()
  const daftarRef = useRef<FlatList<Baris>>(null)
  const [papan, setPapan] = useState(false)
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setPapan(true))
    const b = Keyboard.addListener('keyboardDidHide', () => setPapan(false))
    return () => { a.remove(); b.remove() }
  }, [])
  const [sorot, setSorot] = useState<string | null>(null)
  // Daftar tampilan: pesan disisipi pemisah hari ("Hari ini", "Kemarin", tanggal)
  const baris = useMemo(() => {
    const r: Baris[] = []
    daftar.forEach((p, i) => {
      if (i === 0 || !sehari(daftar[i - 1].waktu, p.waktu)) r.push({ t: 'hari', id: 'h' + p.id, label: labelHari(p.waktu) })
      r.push({ t: 'pesan', p })
    })
    return r
  }, [daftar])
  const lompat = (ref: string, dari: string) => {
    const i = baris.findIndex(b => b.t === 'pesan' && b.p.ref === ref && b.p.dari === dari)
    if (i < 0) { Alert.alert('Pesan asli tidak ditemukan', 'Mungkin sudah dihapus dari perangkat ini.'); return }
    daftarRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.4 })
    const id = (baris[i] as { p: Pesan }).p.id
    setSorot(id)
    setTimeout(() => setSorot(x => (x === id ? null : x)), 1600)
  }
  const [teks, setTeks] = useState('')
  // Mode ubah pesan: isi kolom ketik dengan teks lama; batal mengosongkannya lagi
  useEffect(() => { if (sunting) { setTeks(buka(sunting.teks).teks); setEmoji(false) } }, [sunting?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [emoji, setEmoji] = useState(false)
  const [terpilih, setTerpilih] = useState<Terpilih[]>([])
  const [progres, setProgres] = useState<string | null>(null)
  const [dibuka, setDibuka] = useState<Lampiran | null>(null)
  const [merekam, setMerekam] = useState(false)
  const kirimSuara = async (b: Terpilih) => {
    setMerekam(false)
    setProgres('Mengirim suara…')
    try {
      await kirimLampiran('', [b], () => {})
    } catch (e) {
      Alert.alert('Suara gagal dikirim', (e as Error).message || 'Periksa koneksi lalu coba lagi.')
    } finally {
      setProgres(null)
    }
  }

  const tambahBerkas = async (ambilPilihan: () => Promise<{ lolos: Terpilih[]; ditolak: string[] }>) => {
    try {
      const { lolos, ditolak } = await ambilPilihan()
      if (lolos.length) setTerpilih(x => [...x, ...lolos])
      if (ditolak.length) Alert.alert('Sebagian berkas tidak ditambahkan', ditolak.join(', '))
    } catch (e) {
      Alert.alert('Tidak dapat memilih berkas', (e as Error).message)
    }
  }
  const menuLampiran = () =>
    Alert.alert('Kirim lampiran', `Maksimal ${10} berkas per pesan. Foto & dokumen ≤ 25 MB, video ≤ 64 MB.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Foto / Video', onPress: () => tambahBerkas(() => pilihFotoVideo(terpilih.length)) },
      { text: 'Dokumen', onPress: () => tambahBerkas(() => pilihDokumen(terpilih.length)) },
    ])
  const kirimSemua = async () => {
    const t = teks.trim()
    if (progres) return
    if (sunting && simpanSunting) { if (!t) return; setTeks(''); simpanSunting(sunting, t); return }
    if (!terpilih.length) { if (!t) return; setTeks(''); kirim(t); return }
    const berkas = terpilih
    setProgres(`Mengunggah 1 dari ${berkas.length}…`)
    try {
      await kirimLampiran(t, berkas, (n, total) => setProgres(`Mengunggah ${n} dari ${total}…`))
      setTeks('')
      setTerpilih([])
    } catch (e) {
      Alert.alert('Lampiran gagal dikirim', (e as Error).message || 'Periksa koneksi lalu coba lagi.')
    } finally {
      setProgres(null)
    }
  }
  return (
    <KeyboardAvoidingView style={s.root} behavior="padding">
      <StatusBar style="light" />
      <View style={[s.header, s.barisHeader]}>
        <Pressable onPress={kembali} hitSlop={12}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
        <Pressable style={[s.barisHeader, { flex: 1 }]} onPress={bukaInfo} disabled={!bukaInfo}>
          {avatar ?? (
            <View style={[s.avatar, grup && s.avatarGrup, { width: 36, height: 36 }]}>
              <Text style={s.avatarTeks}>{awalNama(judul)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.judul} numberOfLines={1}>{judul}</Text>
            {subjudul ? <Text style={s.subjudul} numberOfLines={1}>{subjudul}</Text> : null}
          </View>
        </Pressable>
      </View>
      {bilahAtas}
      <View style={{ flex: 1, backgroundColor: '#E6EDF5' }}>
        <View style={s.sistem}>
          <Text style={s.sistemTeks}>
            🔒 Pesan dienkripsi ujung-ke-ujung. Tidak ada pihak di luar {grup ? 'grup' : 'percakapan'} ini, termasuk server, yang dapat membacanya.
          </Text>
        </View>
        <FlatList
          ref={daftarRef}
          data={baris}
          keyExtractor={b => (b.t === 'hari' ? b.id : b.p.id)}
          contentContainerStyle={{ padding: 8, gap: 4 }}
          onContentSizeChange={() => { if (!sorot) daftarRef.current?.scrollToEnd({ animated: true }) }}
          onScrollToIndexFailed={i => setTimeout(() => daftarRef.current?.scrollToIndex({ index: Math.min(i.index, baris.length - 1), animated: true }), 250)}
          renderItem={({ item: b }) => {
            if (b.t === 'hari') {
              return (
                <View style={{ alignSelf: 'center', backgroundColor: '#FFFFFFE6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 6 }}>
                  <Text style={{ fontSize: 12, color: '#54656f', fontWeight: '600' }}>{b.label}</Text>
                </View>
              )
            }
            const item = b.p
            const k = buka(item.teks)
            const p = k.pratinjau
            const gelembung = (
              <Pressable
                style={[s.gelembung, item.saya ? s.keluar : s.masuk, sorot === item.id ? { backgroundColor: '#FFF3B0' } : null]}
                onLongPress={tekanLama && !item.dihapus ? () => tekanLama(item) : undefined}
                onPress={item.saya && item.status === 'gagal' && !item.gagalJaringan && kirimUlang ? () => Alert.alert('Pesan belum terkirim', 'Kirim ulang pesan ini?', [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Kirim ulang', onPress: () => kirimUlang(item) },
                ]) : undefined}
              >
                {grup && !item.saya && namaPengirim ? <Text style={s.pengirim}>{namaPengirim(item.dari)}</Text> : null}
                {item.dihapus ? (
                  <Text style={s.dihapusTeks}>🚫 Pesan ini dihapus</Text>
                ) : (
                  <>
                    {k.diteruskan ? <Text style={{ fontSize: 11.5, fontStyle: 'italic', color: '#667781', marginBottom: 2 }}>↪ Diteruskan</Text> : null}
                    {k.balas ? (
                      <Pressable
                        onPress={() => lompat(k.balas!.r, k.balas!.d)}
                        style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderLeftWidth: 4, borderLeftColor: '#1976D2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 4, minWidth: 140 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1976D2' }} numberOfLines={1}>{namaBalas ? namaBalas(k.balas.d) : 'Pesan'}</Text>
                        <Text style={{ fontSize: 13, color: '#54656f' }} numberOfLines={2}>{k.balas.c || 'Pesan'}</Text>
                      </Pressable>
                    ) : null}
                    {p ? (
                      <Pressable style={s.kartuTautan} onPress={() => Linking.openURL(p.url).catch(() => {})}>
                        {p.gambar ? <Image source={{ uri: p.gambar }} style={s.kartuGambar} resizeMode="cover" /> : null}
                        <View style={s.kartuIsi}>
                          <Text style={s.kartuJudul} numberOfLines={2}>{p.judul}</Text>
                          {p.deskripsi ? <Text style={s.kartuDeskripsi} numberOfLines={3}>{p.deskripsi}</Text> : null}
                          {p.situs ? <Text style={s.kartuSitus} numberOfLines={1}>{p.situs}</Text> : null}
                        </View>
                      </Pressable>
                    ) : null}
                    {k.lampiran?.length ? <IsiLampiran daftar={k.lampiran} buka={setDibuka} ambil={ambil} tekanLama={tekanLama ? () => tekanLama(item) : undefined} /> : null}
                    {k.teks ? <Text style={[s.isi, k.lampiran?.length ? { marginTop: 4 } : null]}><TeksBertautan teks={k.teks} /></Text> : null}
                  </>
                )}
                {!item.dihapus && item.reaksi && Object.keys(item.reaksi).length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {Object.entries(Object.values(item.reaksi).reduce<Record<string, number>>((a, e) => ({ ...a, [e]: (a[e] ?? 0) + 1 }), {})).map(([e, n]) => (
                      <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, backgroundColor: saya && item.reaksi![saya] === e ? '#CFE3F8' : 'rgba(0,0,0,0.07)' }}>
                        <Text style={{ fontSize: 14 }}>{e}</Text>
                        {n > 1 ? <Text style={{ fontSize: 12, color: '#54656f', fontWeight: '600' }}>{n}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={s.meta}>
                  {item.favorit ? '★ ' : ''}{item.diubah ? 'diubah · ' : ''}{jam(item.waktu)}
                  {item.saya ? (item.status === 'gagal' ? (item.gagalJaringan ? '  🕓' : '  ⚠ ketuk untuk kirim ulang') : item.status === 'terkirim' || item.terima || item.baca ? '  ' : '  🕓') : ''}
                  {item.saya && item.status !== 'gagal' && (item.status === 'terkirim' || item.terima || item.baca) ? <Centang p={item} total={jumlahPenerima} /> : null}
                </Text>
              </Pressable>
            )
            // Foto kecil si pengirim di sisi kiri gelembung masuk
            const isiBaris = item.saya || !fotoPengirim ? gelembung : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, alignSelf: 'flex-start', maxWidth: '92%' }}>
                {fotoPengirim(item.dari)}
                {gelembung}
              </View>
            )
            if (!geser || item.dihapus || item.status === 'gagal') return isiBaris
            return (
              <GeserPesan
                balas={geser.balas && item.ref ? () => geser.balas!(item) : undefined}
                aksi={[
                  ...(geser.ubah && item.saya && item.ref ? [{ label: 'Ubah', warna: '#2E7D32', aksi: () => geser.ubah!(item) }] : []),
                  { label: 'Teruskan', warna: '#1976D2', aksi: () => geser.teruskan(item) },
                  { label: item.favorit ? 'Lepas' : 'Favorit', warna: '#F5A623', aksi: () => geser.favorit(item) },
                  { label: 'Hapus', warna: '#E53935', aksi: () => geser.hapus(item) },
                ]}
              >
                {isiBaris}
              </GeserPesan>
            )
          }}
        />
      </View>
      {bilahIzin ? bilahIzin : merekam ? <BilahRekam kirim={kirimSuara} batal={() => setMerekam(false)} bawah={papan ? 8 : Math.max(insets.bottom, 8) + 2} /> : <>
      {emoji ? (
        <View style={{ height: 230, backgroundColor: '#F7F8FA', borderTopWidth: 0.5, borderTopColor: '#D1D7DB' }}>
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 6 }} keyboardShouldPersistTaps="always">
            {EMOJI.map((e, n) => (
              <Pressable key={n} style={{ width: '12.5%', alignItems: 'center', paddingVertical: 6 }} onPress={() => setTeks(x => x + e)}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {terpilih.length ? (
        <View style={{ backgroundColor: '#F7F8FA', borderTopWidth: 0.5, borderTopColor: '#D1D7DB', paddingVertical: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 10 }}>
            {terpilih.map((b, n) => (
              <View key={b.uri + n} style={{ width: 76 }}>
                <View style={{ width: 76, height: 76, borderRadius: 8, backgroundColor: '#DDE3E6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {b.mime.startsWith('image/') ? <Image source={{ uri: b.uri }} style={{ width: 76, height: 76 }} /> : <Text style={{ fontSize: 28 }}>{b.mime.startsWith('video/') ? '🎥' : '📄'}</Text>}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 10, color: '#667781', marginTop: 2 }}>{ukuranTeks(b.ukuran)}</Text>
                {!progres ? (
                  <Pressable onPress={() => setTerpilih(x => x.filter((_, i) => i !== n))} hitSlop={8} style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#111B21', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <Text style={{ fontSize: 12, color: '#667781', paddingHorizontal: 12, marginTop: 4 }}>
            {progres ?? `${terpilih.length} berkas dipilih · tambahkan keterangan (opsional) lalu kirim`}
          </Text>
        </View>
      ) : null}
      {sunting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#E3E6E8' }}>
          <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#2E7D32' }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#2E7D32' }}>Mengubah pesan</Text>
            <Text style={{ fontSize: 13.5, color: '#54656f' }} numberOfLines={1}>{ringkas(sunting.teks) || 'Pesan'}</Text>
          </View>
          <Pressable onPress={() => { setTeks(''); batalSunting?.() }} hitSlop={10} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF0F1', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#667781', fontSize: 14 }}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      {balasan ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#E3E6E8' }}>
          <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#1976D2' }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1976D2' }} numberOfLines={1}>Membalas {namaBalas ? namaBalas(balasan.dari) : ''}</Text>
            <Text style={{ fontSize: 13.5, color: '#54656f' }} numberOfLines={1}>{ringkas(balasan.teks) || 'Pesan'}</Text>
          </View>
          <Pressable onPress={batalBalas} hitSlop={10} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF0F1', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#667781', fontSize: 14 }}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 8, paddingTop: 8, paddingBottom: papan ? 8 : Math.max(insets.bottom, 8) + 2, backgroundColor: '#EEF2F7' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 6, minHeight: 52, elevation: 1 }}>
          <Pressable onPress={() => { Keyboard.dismiss(); setEmoji(v => !v) }} hitSlop={6} style={{ width: 40, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, opacity: 0.55 }}>{emoji ? '⌨️' : '☺'}</Text>
          </Pressable>
          <TextInput
            style={{ flex: 1, fontSize: 16.5, color: '#111', paddingVertical: 14, paddingHorizontal: 2, minHeight: 52, maxHeight: 170, textAlignVertical: 'center' }}
            value={teks} onChangeText={setTeks} onFocus={() => setEmoji(false)}
            placeholder="Ketik pesan" placeholderTextColor="#8696A0" multiline
          />
          <Pressable onPress={menuLampiran} disabled={!!progres} hitSlop={6} style={{ width: 40, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 21, opacity: 0.55, transform: [{ rotate: '-45deg' }] }}>📎</Text>
          </Pressable>
        </View>
        <Pressable
          style={[{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center', elevation: 2 }, progres ? { opacity: 0.5 } : null]}
          onPress={!sunting && !teks.trim() && !terpilih.length && !progres ? () => { Keyboard.dismiss(); setEmoji(false); setMerekam(true) } : kirimSemua}
        >
          {progres ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: !sunting && !teks.trim() && !terpilih.length ? 22 : 20, marginLeft: !sunting && !teks.trim() && !terpilih.length ? 0 : 2 }}>{sunting ? '✓' : !teks.trim() && !terpilih.length ? '🎤' : '➤'}</Text>}
        </Pressable>
      </View>
      </>}
      {dibuka ? <Penampil l={dibuka} ambil={ambil} tutup={() => setDibuka(null)} /> : null}
    </KeyboardAvoidingView>
  )
}
