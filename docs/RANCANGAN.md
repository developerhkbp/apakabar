# ApaKabaR — Rancangan

Aplikasi pesan tertutup khusus pelayan HKBP, terenkripsi ujung ke ujung (protokol Signal).
Status: rancangan awal (belum ada kode). Diperbarui 2026-11-12.

## 1. Keputusan yang sudah diambil

| Hal | Keputusan |
|---|---|
| Pengguna | Pelayan HKBP (±3000), data sudah terisi dari tabel `Pelayan` superapp |
| Platform | Android dan iOS (satu basis kode Expo + modul native libsignal) |
| Cakupan v1 | Chat teks 1:1 dan grup, kanal pengumuman. Tanpa media dan panggilan |
| Peran | USER dan ADMIN; admin lebih dari satu, dua tingkat (lihat §5) |
| Hosting | Google Cloud (proyek `hkbp-superapp-prod`, GKE `hkbp-superapp-cluster`), service terpisah |
| Verifikasi | OTP lewat WhatsApp, **dikirim langsung oleh server** (lihat §3) |
| Folder kerja | `D:\Documents\HKBP\apakabar` (repo terpisah dari superapp) |

Keputusan tambahan (2026-11-17):
- Nomor WABA **sama** dengan superapp (§3 tetap, tetapi tanpa nomor terpisah; pantau kuota dan quality rating bersama).
- **Satu perangkat per pelayan** di v1.
- Notifikasi (iOS dan Android) hanya menampilkan "Pesan baru", tanpa isi/pengirim.
- Repo terpisah `apakabar` di `D:\Documents\HKBPpakabar`.
- **Tampilan dan perilaku dibuat persis seperti WhatsApp** (tata letak, ikon, warna, gelembung, centang, urutan layar) supaya pelayan tidak bingung. Lihat `docs/UI-WHATSAPP.md`.
- Urutan kerja: tahap 0 (prototipe protokol) dulu, karena risiko teknis terbesar.

## 2. Arsitektur

```
Klien (Expo) ──WSS──► Load Balancer ──► apakabar-gateway (NestJS)
                                           │            │
                                      Redis kecil   PostgreSQL (schema/DB terpisah)
                                           │
                                   FCM/APNs (push tanpa isi)
                                   WhatsApp Cloud API (OTP)
```

- Server hanya relay ciphertext, direktori prekey, dan antrean pesan offline (dihapus setelah diterima atau 30 hari).
- Kunci privat hanya di perangkat (Keystore/Keychain; di iOS tanpa sinkronisasi iCloud). Database lokal dienkripsi (SQLCipher).
- Skala: ±1000–1500 koneksi bersamaan, 2 replika kecil cukup. Redis dipakai untuk pub/sub antar-pod.
- Auth sendiri (token pendek + refresh terikat perangkat), tidak memakai JWT superapp.

## 3. Aktivasi dan OTP langsung (beda dari superapp)

Superapp: pengguna **mengirim** pesan `LOGIN-xxxx` ke nomor WA HKBP, lalu server membalas kode di jendela 24 jam (gratis).
ApaKabaR: pengguna memasukkan nomor di aplikasi, server **mengirim kode langsung** ke WhatsApp nomor itu.

Konsekuensi: pesan dikirim dari bisnis lebih dulu, jadi **wajib memakai template WhatsApp kategori AUTHENTICATION** yang disetujui Meta (dengan tombol "Salin kode"; Android bisa autofill).

Alur:
1. Anggota awal diimpor dari `Pelayan` berstatus AKTIF yang punya `hp`/`hp2` (dinormalisasi E.164 `628xxx`) → status `DIUNDANG`.
2. Pelayan buka aplikasi, isi nomor → `POST /auth/otp/minta`.
3. Server cek nomor ada di daftar anggota. Respons selalu generik ("Jika nomor terdaftar, kode dikirim lewat WhatsApp") agar daftar anggota tidak bisa ditebak.
4. Server membuat kode 6 digit dengan `crypto.randomInt`, menyimpan **hash HMAC** (bukan kode asli), TTL 5 menit, lalu mengirim template lewat Cloud API.
5. Pelayan memasukkan kode → `POST /auth/otp/verifikasi` → status `AKTIF` → klien membangkitkan kunci Signal dan mengunggah prekey → sesi terikat perangkat.
6. Nomor yang tidak ada di daftar tidak mendapat kode. Admin bisa menambahkannya lewat antrean `MENUNGGU`.

Pengamanan OTP:
- Maks. 5 percobaan per kode; jeda 60 detik antar permintaan; batas per nomor (mis. 5/jam) dan per IP.
- Kode sekali pakai; permintaan baru membatalkan kode lama.
- Cadangan bila WhatsApp gagal terkirim: kode aktivasi manual dari admin (bukan SMS di v1).
- Catatan: kode OTP di superapp dibuat dengan `Math.random` dan disimpan polos. Untuk ApaKabaR jangan disalin; pakai `crypto.randomInt` dan simpan hash.

Hal yang perlu disiapkan di Meta:
- Template AUTHENTICATION (mis. `apakabar_kode`) dan persetujuannya.
- Nomor pengirim: usulan **nomor/WABA terpisah dari superapp** agar webhook, kuota, dan *quality rating* tidak tercampur. Token sistem disimpan di Secret Manager.
- Batas pesan yang dimulai bisnis per 24 jam bergantung pada tingkat akun dan verifikasi bisnis. Aktivasi 3000 pelayan sebaiknya dijadwalkan bertahap per distrik, bukan sekaligus.
- Biaya per pesan kategori authentication mengikuti tarif Meta. Karena OTP hanya dikirim sekali per pelayan (dan saat ganti HP), totalnya kecil.
- Status gagal kirim (mis. nomor tidak punya WhatsApp) datang lewat webhook; tampilkan ke admin sebagai "perlu ditangani".

## 4. Kunci, pesan, grup

- Per perangkat: identity key, signed prekey (diputar berkala), one-time prekey (batch 100, diisi ulang otomatis).
- 1:1: X3DH + Double Ratchet. Server menyimpan ciphertext sampai dikirim.
- Grup: Sender Keys. Anggota keluar/ditambah → kunci grup diputar. Grup biasa maks. ±256 anggota; siaran ke ribuan orang lewat **kanal pengumuman satu arah** (hanya admin yang menulis).
- Grup otomatis dari tabel `Penugasan` (distrik, resort, pimpinan, biro, lembaga). Perubahan massal dijalankan sebagai job terjadwal.
- Peringatan "kode keamanan berubah" saat identity key lawan bicara berganti.
- Ganti HP = aktivasi ulang; riwayat lama tidak ikut (backup terenkripsi ditunda).
- Metadata (siapa ke siapa, kapan) tetap terlihat server. Sealed Sender ditunda.

## 5. Peran

| Tingkat | Bisa | Tidak bisa |
|---|---|---|
| USER | Chat 1:1/grup, buat grup, laporkan pesan | Kelola anggota |
| ADMIN | Setujui/tangguhkan anggota, kelola grup & kanal, lihat laporan | Angkat admin, hapus akun permanen |
| ADMIN UTAMA | Semua di atas + angkat/cabut admin, hapus akun, reset perangkat, atur sinkron sumber data | — |

Tidak ada peran yang bisa membaca isi pesan. Aturan tambahan: audit log yang tidak bisa diubah; aksi berisiko (hapus akun, keluarkan dari semua grup) butuh persetujuan dua admin; daftar admin disimpan di ApaKabaR sendiri.

## 6. Sinkron dengan data pelayan

- Pelayan menjadi nonaktif/pensiun → otomatis `DITANGGUHKAN`, sesi dicabut, dikeluarkan dari grup.
- Pelayan baru → masuk daftar `DIUNDANG`.
- Laporan "perlu dilengkapi" untuk pelayan tanpa `hp` valid atau dengan nomor ganda.

## 7. Model data server (ringkas)

`Anggota` (id, nomorHp, nama, sumberPelayanId, status, peran) · `Perangkat` (identityKey, signedPrekey, registrationId, pushToken) · `OneTimePrekey` · `OtpPermintaan` (nomor, hashKode, kedaluwarsa, percobaan) · `Grup`/`GrupAnggota` (versi keanggotaan) · `PesanAntrean` (ciphertext, ttl) · `Laporan` · `AuditAdmin`.
Tidak ada tabel berisi isi pesan terbaca.

## 8. Tahapan

0. Prototipe libsignal — risiko teknis terbesar.
   - **Selesai 2026-11-17 (Node):** `prototype/` membuktikan X3DH + Double Ratchet (1:1), pesan tidak berurutan, dan Sender Keys (grup) memakai `@signalapp/libsignal-client` 0.108.0; relay hanya melihat ciphertext. Jalankan `node prototype/uji.mjs`.
   - **Selesai 2026-11-17 (Android):** `apps/mobile` (Expo 58) + modul `modules/signal-protocol` membungkus `libsignal-android` 0.86.5. Skenario yang sama lulus semua di dua emulator Android 16 (`ApaKabaR_A`, `ApaKabaR_B`). iOS belum.
   - **Catatan teknis:** libsignal butuh core library desugaring (`plugins/with-desugaring.js`); `local.properties` harus memakai `sdk.dir=C:/Android/SDK` (garis miring biasa). Gradle tidak jalan di sandbox sesi (loopback), jalankan di terminal sendiri.
   - **Sebelumnya (rencana HP):** `@signalapp/libsignal-client` hanya untuk Node, tidak ada binding React Native resmi. Rencana: Expo Module sendiri membungkus `org.signal:libsignal-android` (Maven Central, terakhir 0.86.5) dan `LibSignalClient` iOS (dari repo signalapp/libsignal), dibangun lewat EAS Build. iOS tidak bisa diuji di Windows.
1. Impor anggota dari `Pelayan`, laporan kualitas data HP.
2. Gateway: OTP WhatsApp langsung, sesi, prekey, relay WebSocket, push, deploy ke GKE.
3. Chat 1:1 lalu grup (+ grup otomatis dari penugasan, kanal pengumuman).
4. Panel admin, safety number, pelaporan, rate limit, audit.
5. Uji keamanan, uji coba satu distrik, lalu seluruh pelayan.
6. Lanjutan: media terenkripsi, backup, multi-device.

## 9. Risiko

- Binding libsignal di React Native (Android dan iOS) — buktikan dulu lewat prototipe.
- Lisensi libsignal AGPL-3.0 — cek sebelum distribusi store.
- Persetujuan template dan batas pengiriman Meta bisa menunda aktivasi massal.
- Kehilangan HP = kehilangan riwayat; pengguna harus diberi tahu sejak awal.
- Moderasi sulit karena E2EE; andalkan fitur laporan dari pengguna.

## Status gateway (2026-11-17)

`apps/gateway` (NestJS 11 + Prisma 7 + Postgres privat di port 5433) berjalan dan lulus `npm run uji` (11 pengujian ujung-ke-ujung dengan dua klien libsignal sungguhan):
OTP (HMAC, TTL 5 menit, 5 percobaan, respons generik), satu perangkat per anggota (token lama gugur saat perangkat diganti), prekey sekali-pakai dihabiskan saat diambil, relay WebSocket `/ws?token=` dengan antrean offline 30 hari dan dedup `idKlien`, isi yang lewat server hanya ciphertext.

Env pengembangan: `OTP_PENGIRIM=dev` (kode dicatat di log dan digemakan di respons), `OTP_JEDA_DETIK`, `OTP_MAKS_PER_JAM`. Untuk produksi: `OTP_PENGIRIM=whatsapp` + `WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE_OTP`.
Protokol WS klien→server memakai format Nest: `{event:'kirim'|'ack', data:{...}}`; server→klien `{t:'siap'|'masuk'|'terkirim'|'galat'}`.

## Status aplikasi + gateway (2026-11-17)

Dua emulator Android (A dan B) berhasil login lewat OTP dan saling berkirim pesan lewat gateway: pesan dienkripsi libsignal native di perangkat, server hanya meneruskan ciphertext. Kode: `apps/mobile/src/server.ts` (klien API + relay) dan `App.tsx` (login, daftar kontak, percakapan bergaya WhatsApp).
Jalankan: gateway `npm run dev` (apps/gateway), `adb reverse tcp:3101 tcp:3101` per emulator.
Penyimpanan (Android) selesai dan terverifikasi di 2 emulator (2026-11-17): kunci Signal, sesi, token, dan riwayat pesan disimpan terenkripsi AES-256-GCM, kunci AES di Android Keystore. Setelah app dimatikan paksa dan dibuka lagi: tetap masuk tanpa OTP, riwayat utuh, pesan yang dikirim saat penerima mati tetap terdekripsi, balasan sesudah restart berjalan.

Push "Pesan baru" selesai dan terverifikasi di emulator (2026-11-17): proyek Firebase `apakabar-hkbp` (tanpa Analytics/Gemini), aplikasi mendaftarkan token FCM ke `PUT /perangkat/push`, gateway mengirim push hanya bila penerima tidak terhubung via WebSocket (jeda 5 detik per penerima), isi tetap "Pesan baru" tanpa pengirim/isi. Token yang tidak berlaku dibersihkan otomatis. Catatan uji: aplikasi yang di-force-stop tidak menerima FCM (perilaku Android); uji dengan `adb shell am kill`. Berkas rahasia `firebase-key.json` dan `google-services.json` di-gitignore. Ikon notifikasi masih bawaan.

## Status admin + grup (2026-11-17)

Gateway: 35 pengujian ujung-ke-ujung lulus (`test/uji-admin.mjs`). Impor pelayan: 3210 anggota berstatus `DIUNDANG`, 22 ditolak karena nomor HP tidak valid.
Alur keanggotaan: DIUNDANG → verifikasi OTP → MENUNGGU → admin menyetujui → AKTIF; DITANGGUHKAN = diblokir (bisa dibuka kembali); "keluarkan" menghapus permanen.
Peran aplikasi: USER, ADMIN, ADMIN_UTAMA (hanya admin utama yang boleh menambah nomor/nama, mengangkat-mencabut admin, dan mengeluarkan). Peran grup: ANGGOTA, ADMIN_GRUP. Admin aplikasi dan admin grup bisa mengubah nama, menambah/mengeluarkan anggota, mengangkat admin grup, dan menghapus grup.
Grup memakai Sender Keys: kunci dibagikan lewat sesi 1:1 (`\u0001SKDM:`), `idDistribusi` diputar saat anggota dikeluarkan.
Aplikasi (terverifikasi di 2 emulator): halaman "Menunggu persetujuan admin" yang terbuka otomatis setelah disetujui, lencana jumlah menunggu di menu admin, Kelola anggota (setujui, blokir, buka blokir, jadikan/cabut admin, keluarkan, tambah), grup baru, pesan grup dua arah dengan nama pengirim, badge belum dibaca, keluar.
Blokir terbukti langsung menendang perangkat ke halaman masuk.

Batas: grup maksimal 2000 anggota (diputuskan pemilik, 2026-11-17) dan relay 2500 pesan/menit per koneksi. Pengiriman pertama ke grup besar membagikan kunci grup satu per satu lewat sesi 1:1 (sampai 2000 pesan kecil), jadi bisa memakan beberapa menit di perangkat pengirim; pesan berikutnya cepat. Kanal siaran untuk ±3000 pelayan belum dirancang.
Sebelum produksi: hapus 4 akun uji 62811000000(1-4), matikan `OTP_PENGIRIM=dev`, ganti ikon notifikasi.

Belum: iOS (libsignal binding, APNs, Keychain), pengiriman OTP WhatsApp sungguhan, deploy GKE.

## Status lampiran, tanda baca, foto (2026-11-17)

- **Lampiran** (maks 10 berkas/pesan; 25 MB per berkas, 64 MB per video): dienkripsi AES-256-GCM per 64 KB di perangkat pengirim, blob acak diunggah ke `POST /berkas` (disimpan di disk gateway, kedaluwarsa 30 hari; pindah ke R2 saat produksi). Kunci dan IV hanya ada di dalam pesan E2EE. Penerima mengunduh saat diketuk, mendekripsi, menyimpan di penyimpanan privat (dihapus saat keluar). Thumbnail dibuat di perangkat. Galeri media/dokumen ada di Info grup. Penampil berupa tampilan biasa (bukan Modal) agar tercakup FLAG_SECURE.
- **Tanda baca**: ✓ terkirim ke server, ✓✓ abu sampai ke semua penerima, ✓✓ biru dibaca semua. Server hanya meneruskan penanda (pesan kontrol jenis 6), bukan isi. Tekan lama pesan sendiri → **Info pesan** (dibaca / sampai / belum, per orang beserta waktunya).
- **Foto profil dan foto grup**: dipilih, dipotong persegi, dan diperkecil ke ±320 px JPEG di perangkat sebelum diunggah (server menolak non-JPEG atau >64 KB). Disimpan di kolom `foto`/`fotoV` (Anggota, Grup); alamat `GET /foto/{anggota|grup}/:id?v=` ikut versi sehingga cache klien selalu segar. Foto grup hanya boleh diganti admin grup atau admin aplikasi. Setiap pengguna punya layar Profil (foto, nama, lencana admin).
- **Beranda**: hanya memuat obrolan yang sudah berjalan, yang terbaru di atas. Ribuan anggota tidak dibuat daftar panjang: dicari lewat kolom cari (maks 30 hasil) atau dipilih dari tombol **Obrolan baru** (daftar tervirtualisasi + pencarian).
- Uji: `uji-e2e` 11, `uji-admin` 44, `uji-berkas` 7, `uji-foto` 11.

## Redis: relay antar-replika & pembatas OTP (2026-11-17)

Opsional lewat `REDIS_URL` (tanpa itu gateway berjalan di memori satu proses, seperti sebelumnya).
- **Relay antar-replika:** kanal pub/sub `apakabar:relay`. Pesan untuk anggota yang tersambung di replika lain diterbitkan ke kanal; replika pemilik koneksi mengantarnya. Kehadiran dicatat di kunci `online:<id>` (isi = id instans, TTL 90 dtk, diperbarui tiap 30 dtk) sehingga replika mana pun tahu apakah penerima online (jika tidak → push FCM). Koneksi baru seorang anggota menutup koneksi lamanya di replika lain (kode 4001); pencabutan akses (`putuskan`) juga lintas replika.
- **Pembatas OTP per IP:** `OTP_MAKS_PER_IP_JAM` (bawaan 30/jam), penghitung Redis `hitung:otp-ip:<ip>`. Di belakang ingress set `TRUST_PROXY=1` agar IP klien dibaca dari `X-Forwarded-For`.
- Pesan tetap disimpan di Postgres (antrean) sehingga Redis hanya mempercepat pengantaran langsung; bila Redis mati, pengantaran lintas replika gagal tetapi pesan tetap diantre dan terkirim saat penerima tersambung lagi.
- Uji: `npx ts-node --transpile-only test/uji-redis.ts` (dua replika + Redis tiruan, 9 pemeriksaan).
- Produksi: gunakan Redis yang sudah ada di cluster (`hkbp-redis-node-*`) dengan prefiks kunci terpisah (`apakabar:`/`online:`/`hitung:`), atau instance khusus.
