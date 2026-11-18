import { StyleSheet } from 'react-native'

export const HIJAU_TUA = '#0B4F8A'
export const HIJAU = '#42A5F5'
export const GELEMBUNG_KELUAR = '#D6EAFF'
export const LATAR_OBROLAN = '#E6EDF5'
export const EMAS_TUA = '#A67C00'
export const MERAH = '#E53935'
export const ABU = '#667781'

export const jam = (t: number) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const awalHari = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const selisihHari = (t: number) => Math.round((awalHari(Date.now()) - awalHari(t)) / 86400000)

/** Pemisah hari di dalam percakapan: Hari ini, Kemarin, nama hari (7 hari terakhir), atau tanggal. */
export const labelHari = (t: number) => {
  const n = selisihHari(t)
  if (n <= 0) return 'Hari ini'
  if (n === 1) return 'Kemarin'
  const d = new Date(t)
  if (n < 7) return HARI[d.getDay()]
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}
export const sehari = (a: number, b: number) => awalHari(a) === awalHari(b)

/** Waktu di daftar obrolan: jam bila hari ini, selain itu Kemarin / nama hari / tanggal. */
export const waktuDaftar = (t: number) => {
  const n = selisihHari(t)
  if (n <= 0) return jam(t)
  if (n === 1) return 'Kemarin'
  const d = new Date(t)
  if (n < 7) return HARI[d.getDay()]
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
}

/** Huruf awal untuk avatar; gelar di depan nama dilewati. */
export const awalNama = (nama: string) => nama.replace(/^(Pdt\.|St\.|Gr\.|Pdt|St|Gr|Dr\.|Ds\.)\s*/i, '').charAt(0).toUpperCase() || '?'

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: HIJAU_TUA, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16 },
  barisHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  judul: { color: '#fff', fontSize: 20, fontWeight: '600' },
  subjudul: { color: '#CFE3F7', fontSize: 12, marginTop: 2 },
  masukIsi: { flex: 1, padding: 28, paddingTop: 96, gap: 14 },
  masukJudul: { fontSize: 20, fontWeight: '600', color: HIJAU_TUA, textAlign: 'center' },
  masukUrai: { fontSize: 14, color: ABU, textAlign: 'center', lineHeight: 20 },
  input: { borderBottomWidth: 2, borderColor: HIJAU, fontSize: 20, paddingVertical: 8, color: '#111' },
  info: { color: ABU, textAlign: 'center', fontSize: 13 },
  galat: { color: MERAH, textAlign: 'center', fontSize: 14 },
  tombol: { marginTop: 8, backgroundColor: HIJAU, borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  tombolTeks: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tombolTepi: { marginTop: 8, borderRadius: 24, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: HIJAU },
  tombolTepiTeks: { color: HIJAU_TUA, fontSize: 16, fontWeight: '600' },
  kosong: { textAlign: 'center', color: ABU, padding: 32 },
  barisObrolan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e4e6e7' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DFE5E7', alignItems: 'center', justifyContent: 'center' },
  avatarGrup: { backgroundColor: '#BBDEFB' },
  avatarTeks: { fontSize: 18, fontWeight: '600', color: HIJAU_TUA },
  nama: { fontSize: 16, fontWeight: '600', color: '#111' },
  cuplikan: { fontSize: 14, color: ABU, marginTop: 2 },
  jamKecil: { fontSize: 12, color: ABU },
  lencana: { backgroundColor: HIJAU, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  lencanaTeks: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sistem: { alignSelf: 'center', backgroundColor: '#FFF3C4', borderRadius: 8, padding: 8, margin: 8, maxWidth: '90%' },
  sistemTeks: { fontSize: 12, color: '#54656f', textAlign: 'center' },
  gelembung: { maxWidth: '80%', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  keluar: { alignSelf: 'flex-end', backgroundColor: GELEMBUNG_KELUAR },
  masuk: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  pengirim: { fontSize: 12, fontWeight: '700', color: HIJAU_TUA, marginBottom: 1 },
  isi: { fontSize: 15, color: '#111' },
  meta: { fontSize: 11, color: ABU, alignSelf: 'flex-end', marginTop: 2 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, backgroundColor: LATAR_OBROLAN },
  kolom: { flex: 1, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, maxHeight: 120 },
  kirim: { width: 44, height: 44, borderRadius: 22, backgroundColor: HIJAU_TUA, alignItems: 'center', justifyContent: 'center' },
  // pencarian, tab, aksi
  cari: { backgroundColor: '#F0F2F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 12, marginVertical: 8, fontSize: 15 },
  tab: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e4e6e7' },
  tabItem: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  tabAktif: { borderColor: HIJAU_TUA },
  tabTeks: { fontSize: 13, color: ABU, fontWeight: '600' },
  tabTeksAktif: { color: HIJAU_TUA },
  seksi: { backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingVertical: 6, fontSize: 12, color: ABU, fontWeight: '700' },
  aksiBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  aksi: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: HIJAU },
  aksiTeks: { fontSize: 13, fontWeight: '600', color: HIJAU_TUA },
  aksiBahaya: { borderColor: MERAH },
  aksiBahayaTeks: { color: MERAH },
  aksiPenuh: { backgroundColor: HIJAU },
  aksiPenuhTeks: { color: '#fff' },
  lencanaPeran: { alignSelf: 'flex-start', backgroundColor: '#E3F0FD', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3 },
  lencanaPeranTeks: { fontSize: 11, color: HIJAU_TUA, fontWeight: '700' },
  formKolom: { borderBottomWidth: 1, borderColor: '#cfd4d6', fontSize: 16, paddingVertical: 6, color: '#111', marginBottom: 10 },
  centang: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#b0b8bc', alignItems: 'center', justifyContent: 'center' },
  centangAktif: { backgroundColor: HIJAU, borderColor: HIJAU },
  tabirMenu: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { position: 'absolute', top: 70, right: 12, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 4, minWidth: 200, elevation: 8 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  menuTeks: { fontSize: 15, color: '#111' },
  tengah: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  besar: { fontSize: 56 },
  kartuTautan: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden', marginBottom: 4, minWidth: 220 },
  kartuGambar: { width: '100%', height: 130, backgroundColor: '#ddd' },
  kartuIsi: { paddingHorizontal: 8, paddingVertical: 6, gap: 1 },
  kartuJudul: { fontSize: 14, fontWeight: '600', color: '#111' },
  kartuDeskripsi: { fontSize: 12.5, color: '#444' },
  kartuSitus: { fontSize: 12, color: ABU },
  dihapusTeks: { fontSize: 14, fontStyle: 'italic', color: ABU },
})

/** Admin memakai header berwarna emas agar langsung terlihat; dipanggil saat peran berubah. */
export function setTemaAdmin(admin: boolean) {
  const b = s as { header: object; subjudul: object }
  b.header = { ...s.header, backgroundColor: admin ? EMAS_TUA : HIJAU_TUA }
  b.subjudul = { ...s.subjudul, color: admin ? '#FFF1C7' : '#CFE3F7' }
}
