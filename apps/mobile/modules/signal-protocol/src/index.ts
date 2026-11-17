import { requireNativeModule } from 'expo'

/** Paket prekey publik yang diunggah ke server (semua byte dalam base64). */
export type PaketPrekey = {
  deviceId: number
  regId: number
  identitas: string
  signedPreKey: { id: number; pub: string; sig: string }
  kyber: { id: number; pub: string; sig: string }
  oneTime: { id: number; pub: string }[]
}

/** Prekey lawan bicara dari server untuk memulai sesi (satu prekey sekali-pakai atau null). */
export type BundleLawan = Omit<PaketPrekey, 'oneTime'> & { nama: string; oneTime: { id: number; pub: string } | null }

export type Ciphertext = { jenis: number; isi: string }

type Native = {
  versi(): string
  ada(): boolean
  daftar(jumlahOtp: number): Promise<PaketPrekey>
  buatPrekeyBaru(jumlah: number): Promise<{ id: number; pub: string }[]>
  jumlahPrekey(): number
  punyaSesi(dengan: string): boolean
  mulaiSesi(bundle: BundleLawan): Promise<void>
  enkripsi(untuk: string, teks: string): Promise<Ciphertext>
  dekripsi(dari: string, jenis: number, isi: string): Promise<string>
  buatKunciGrup(idGrup: string): Promise<string>
  terimaKunciGrup(dari: string, kunci: string): Promise<void>
  enkripsiGrup(idGrup: string, teks: string): Promise<string>
  dekripsiGrup(dari: string, isi: string): Promise<string>
  /** Token FCM perangkat ini. */
  tokenPush(): Promise<string>
  /** Brankas terenkripsi (Android Keystore) untuk data aplikasi. */
  simpan(nama: string, nilai: string): Promise<void>
  baca(nama: string): Promise<string | null>
  hapusSemua(): Promise<void>
  /** Enkripsi AES-256-GCM per 64 KB lalu unggah blob ke gateway. */
  unggahBerkas(sumber: string, url: string, token: string): Promise<{ id: string; kunci: string; iv: string; ukuran: number }>
  /** Unduh blob, dekripsi, simpan di penyimpanan privat aplikasi; mengembalikan jalur berkas. */
  unduhBerkas(url: string, token: string, kunci: string, iv: string, namaFile: string): Promise<string>
  /** JPEG kecil (data URI) dari foto/video. */
  thumbnail(sumber: string, video: boolean, maks: number): Promise<string | null>
  ukuranBerkas(sumber: string): number
}

export default requireNativeModule<Native>('SignalProtocol')
