import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type ItemMenu = { label: string; bahaya?: boolean; aksi: () => void }

/**
 * Menu tekan-lama pada pesan (Info pesan, Hapus…). Berupa tampilan biasa, bukan Alert/Modal:
 * Alert Android hanya memuat 3 tombol, dan jendela terpisah tidak tercakup perlindungan tangkapan layar.
 */
export function MenuPesan({ item, tutup }: { item: ItemMenu[]; tutup: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <Pressable onPress={tutup} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0008', justifyContent: 'flex-end', zIndex: 60 }}>
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 8, paddingBottom: 16 + insets.bottom }}>
        {item.map(x => (
          <Pressable key={x.label} onPress={() => { tutup(); x.aksi() }} style={{ paddingVertical: 15, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 16, color: x.bahaya ? '#E53935' : '#111B21' }}>{x.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={tutup} style={{ paddingVertical: 15, paddingHorizontal: 24, borderTopWidth: 0.5, borderTopColor: '#E9EDEF' }}>
          <Text style={{ fontSize: 16, color: '#667781' }}>Batal</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}
