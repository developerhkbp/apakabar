import { StatusBar } from 'expo-status-bar'
import { useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { Pesan } from '../server'
import { awalNama, jam, s } from '../gaya'
import { buka, type Lampiran } from '../konten'
import { IsiLampiran, Penampil, pilihDokumen, pilihFotoVideo, ukuranTeks, type Terpilih } from '../lampiran'

const EMOJI = (
  '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 😐 😑 😶 😏 😒 🙄 😬 😔 😪 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 ' +
  '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👏 🙌 👐 🤲 🤝 🙏 💪 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💞 💓 💗 💖 💘 💝 🔥 ✨ ⭐ 🌟 💫 🎉 🎊 🎁 🏆 🎶 🎵 ' +
  '⛪ ✝️ 🕊️ 📖 🕯️ 🌿 🌹 🌷 🌻 ☀️ 🌙 🌈 ☁️ ⚡ ❄️ 🌍 🍎 🍞 🍇 ☕ 🍰 🎂'
).split(' ')

/** ✓ terkirim ke server, ✓✓ sudah sampai ke semua penerima, ✓✓ biru sudah dibaca semua penerima. */
function Centang({ p, total }: { p: Pesan; total: number }) {
  const baca = Object.keys(p.baca ?? {}).length
  const sampai = new Set([...Object.keys(p.terima ?? {}), ...Object.keys(p.baca ?? {})]).size
  const biru = total > 0 && baca >= total
  const ganda = total > 0 && sampai >= total
  return <Text style={{ color: biru ? '#34B7F1' : '#667781', fontWeight: '700' }}>{ganda ? '✓✓' : '✓'}</Text>
}

/** Percakapan 1:1 maupun grup. Untuk grup, `namaPengirim` menampilkan nama di atas gelembung masuk. */
export function Percakapan({ fotoPengirim, avatar, judul, subjudul, grup, jumlahPenerima, daftar, kirim, kirimLampiran, ambil, kembali, bukaInfo, namaPengirim, tekanLama }: {
  judul: string
  subjudul?: string
  grup?: boolean
  /** Jumlah penerima selain saya (1 untuk percakapan pribadi); menentukan kapan centang jadi ✓✓. */
  jumlahPenerima: number
  daftar: Pesan[]
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
  /** Menu saat gelembung ditekan lama (mis. hapus pesan). */
  tekanLama?: (p: Pesan) => void
}) {
  const [teks, setTeks] = useState('')
  const [emoji, setEmoji] = useState(false)
  const [terpilih, setTerpilih] = useState<Terpilih[]>([])
  const [progres, setProgres] = useState<string | null>(null)
  const [dibuka, setDibuka] = useState<Lampiran | null>(null)

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
  const daftarRef = useRef<FlatList<Pesan>>(null)
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
      <View style={{ flex: 1, backgroundColor: '#EFE7DD' }}>
        <View style={s.sistem}>
          <Text style={s.sistemTeks}>
            🔒 Pesan dienkripsi ujung-ke-ujung. Tidak ada pihak di luar {grup ? 'grup' : 'percakapan'} ini, termasuk server, yang dapat membacanya.
          </Text>
        </View>
        <FlatList
          ref={daftarRef}
          data={daftar}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 8, gap: 4 }}
          onContentSizeChange={() => daftarRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const k = buka(item.teks)
            const p = k.pratinjau
            const gelembung = (
              <Pressable
                style={[s.gelembung, item.saya ? s.keluar : s.masuk]}
                onLongPress={tekanLama && !item.dihapus ? () => tekanLama(item) : undefined}
              >
                {grup && !item.saya && namaPengirim ? <Text style={s.pengirim}>{namaPengirim(item.dari)}</Text> : null}
                {item.dihapus ? (
                  <Text style={s.dihapusTeks}>🚫 Pesan ini dihapus</Text>
                ) : (
                  <>
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
                    {k.lampiran?.length ? <IsiLampiran daftar={k.lampiran} buka={setDibuka} tekanLama={tekanLama ? () => tekanLama(item) : undefined} /> : null}
                    {k.teks ? <Text style={[s.isi, k.lampiran?.length ? { marginTop: 4 } : null]}>{k.teks}</Text> : null}
                  </>
                )}
                <Text style={s.meta}>
                  {jam(item.waktu)}
                  {item.saya ? (item.status === 'gagal' ? '  ⚠' : item.status === 'terkirim' || item.terima || item.baca ? '  ' : '  🕓') : ''}
                  {item.saya && item.status !== 'gagal' && (item.status === 'terkirim' || item.terima || item.baca) ? <Centang p={item} total={jumlahPenerima} /> : null}
                </Text>
              </Pressable>
            )
            // Foto kecil si pengirim di sisi kiri gelembung masuk
            if (item.saya || !fotoPengirim) return gelembung
            return (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, alignSelf: 'flex-start', maxWidth: '92%' }}>
                {fotoPengirim(item.dari)}
                {gelembung}
              </View>
            )
          }}
        />
      </View>
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
      <View style={s.bar}>
        <Pressable onPress={menuLampiran} disabled={!!progres} hitSlop={8} style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 24 }}>📎</Text>
        </Pressable>
        <Pressable onPress={() => { Keyboard.dismiss(); setEmoji(v => !v) }} hitSlop={8} style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 24 }}>{emoji ? '⌨️' : '😊'}</Text>
        </Pressable>
        <TextInput style={s.kolom} value={teks} onChangeText={setTeks} onFocus={() => setEmoji(false)} placeholder="Ketik pesan" multiline />
        <Pressable style={[s.kirim, progres ? { opacity: 0.5 } : null]} onPress={kirimSemua}>
          {progres ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>}
        </Pressable>
      </View>
      {dibuka ? <Penampil l={dibuka} ambil={ambil} tutup={() => setDibuka(null)} /> : null}
    </KeyboardAvoidingView>
  )
}
