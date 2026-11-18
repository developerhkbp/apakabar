# ApaKabaR — Daftar fitur (v1.0.4)

Aplikasi pesan tertutup untuk pelayan HKBP, terenkripsi ujung ke ujung (protokol Signal). Daftar ini disusun dari kode yang ada di `apps/mobile` dan `apps/gateway`.

## 1. Akses dan keamanan

| Fitur | Keterangan |
|---|---|
| Masuk dengan nomor HP | Pelayan memasukkan nomor, server mengirim kode 6 digit lewat WhatsApp (OTP). Respons selalu generik agar daftar anggota tidak bisa ditebak. |
| Hanya nomor terdaftar | Anggota awal diimpor dari data pelayan superapp dan disinkronkan tiap hari. |
| Persetujuan admin | Setelah nomor terverifikasi, anggota masuk layar "Menunggu"; terbuka otomatis begitu admin menyetujui. |
| Satu perangkat per akun | Sesi terikat perangkat; token pendek dengan refresh. |
| Enkripsi ujung ke ujung | Server hanya meneruskan teks terenkripsi; kunci hanya ada di perangkat. Grup memakai Sender Key. |
| Notifikasi tanpa isi | Push (FCM) hanya menampilkan "Pesan baru", tanpa nama pengirim dan isi. |
| Antrean pesan offline | Pesan disimpan terenkripsi di server sampai diterima (maks. 30 hari). |

## 2. Percakapan

| Fitur | Keterangan |
|---|---|
| Obrolan pribadi 1:1 dan grup | Gelembung hijau (keluar) dan putih (masuk), tampilan mengikuti WhatsApp. |
| Status pesan | Jam, terkirim, diterima, dibaca (centang). |
| Info pesan | Siapa yang sudah membaca, menerima, dan belum (berguna di grup). |
| Balas pesan | Kutipan pesan di dalam gelembung; ketuk kutipan untuk melompat ke pesan asli (disorot). Bilah "Membalas…" di atas kolom ketik. |
| Teruskan pesan | Pilih banyak tujuan (grup atau orang) sekaligus; ditandai "↪ Diteruskan". |
| Hapus pesan | Hapus untuk saya, dan hapus untuk semua. |
| Pemisah hari | "Hari ini", "Kemarin", atau tanggal. |
| Kirim ulang | Pesan yang gagal terkirim bisa dikirim ulang. |
| Pratinjau tautan | Tautan di pesan menampilkan judul, deskripsi, dan gambar kecil; diambil oleh pengirim sehingga penerima tidak menghubungi situs. |
| Emoji | Papan emoji di kolom ketik. |
| Status online | "online" tampil di header obrolan pribadi. |
| Kolom ketik | Kolom lebar dengan tombol emoji dan lampiran di dalamnya, tombol kirim bulat. |

## 3. Lampiran

| Fitur | Keterangan |
|---|---|
| Foto, video, dokumen | Hingga 10 berkas per pesan. |
| Batas ukuran | 25 MB per berkas; video 64 MB. |
| Terenkripsi | Berkas dienkripsi AES-256-GCM di perangkat pengirim sebelum diunggah; kunci hanya di dalam pesan. |
| Thumbnail | Foto dan video punya thumbnail kecil; tampil sebagai petak (grid). |
| Galeri grup | Semua media dan dokumen yang pernah dibagikan di sebuah grup. |
| Penyimpanan | Blob terenkripsi di Google Cloud Storage; berkas kedaluwarsa dibersihkan otomatis. |

## 4. Grup

| Fitur | Keterangan |
|---|---|
| Buat dan kelola grup | Buat grup, ubah nama, tambah dan keluarkan anggota (dengan pencarian dan kotak centang). |
| Foto grup | Admin grup bisa mengganti foto grup. |
| Grup otomatis | Keanggotaan dihitung dari data superapp (tohonan, distrik, LPP, kantor pusat). Anggota yang jabatannya pindah otomatis keluar dari grup lama dan masuk grup baru. Hanya anggota aktif yang dimasukkan. |
| Kontak | Seluruh anggota (bisa ribuan) dicari lebih dulu, daftar dirender malas agar ringan. |

## 5. Profil

| Fitur | Keterangan |
|---|---|
| Profil | Nama, nomor (diformat), dan foto profil. |
| Foto profil | Ambil dari kamera atau galeri, dipotong persegi dan diperkecil (±320 px) di perangkat. Bisa dihapus. |
| Foto dari superapp | Alamat foto profil superapp disimpan dan dipakai sebagai foto bawaan. |
| Pengaturan dan Tentang | Layar pengaturan dasar dan informasi aplikasi. |

## 6. Admin (di dalam aplikasi)

| Fitur | Keterangan |
|---|---|
| Daftar anggota per status | Tab: Menunggu, Belum masuk, Aktif, Diblokir. Dengan pencarian dan halaman. |
| Setujui | Satu per satu atau banyak sekaligus. |
| Blokir dan buka blokir | Anggota yang diblokir tidak bisa memakai aplikasi. |
| Hapus dan tambah anggota | Tambah manual, ubah data, hapus. |
| Detail anggota | Data ApaKabaR dicocokkan dengan jabatan, tempat bertugas, dan foto dari superapp. |
| Ringkasan | Jumlah anggota per status. |
| Sinkron | Menjalankan sinkronisasi dari superapp secara manual dan melihat hasilnya. |

## 7. Otomatis di server

| Fitur | Keterangan |
|---|---|
| Sinkron harian 04:00 WIB | Menambah pelayan dan calon pelayan baru (status "Belum masuk"), menyimpan alamat foto profil, menghitung ulang grup otomatis. Nomor HP dan nama yang sudah ada tidak ditimpa. |
| Relay pesan realtime | WebSocket antar-replika (Redis), kirim, ack, baca, dan hapus. |
| Push notifikasi | Hanya saat penerima sedang tidak tersambung. |
| Pembersihan | Pesan antre dan blob lampiran kedaluwarsa dihapus. |

## 8. Belum ada (sengaja ditunda atau belum dibuat)

Panggilan suara/video, status/cerita, kanal pengumuman, tautan undangan grup, pencarian di dalam obrolan, bintangi pesan, bisukan dan sematkan obrolan, serta pengaturan privasi (terakhir dilihat, tanda dibaca). Beberapa di antaranya tercantum di `docs/UI-WHATSAPP.md` sebagai target tampilan, tapi belum ada kodenya.
