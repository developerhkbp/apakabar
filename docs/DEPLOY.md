# Deploy ApaKabaR ke GKE (draf — belum dijalankan)

Namespace `hkbp`, Postgres produksi yang sama (database terpisah `apakabar`), Redis `hkbp-redis`. Manifes: `deploy/k8s/apakabar.yaml`.

1. **Database**: `CREATE DATABASE apakabar;` + role khusus `apakabar` (hanya berhak atas database itu). Jangan memakai kredensial superapp.
2. **Secret `apakabar-secret`** (dibuat manual, jangan di-commit): `DATABASE_URL` (lewat pgbouncer, `?pgbouncer=true`), `DATABASE_URL_LANGSUNG` (langsung ke Postgres, untuk migrasi), `REDIS_URL`, `JWT_SECRET`, `OTP_SECRET` (acak baru, jangan pakai milik superapp), `WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE_OTP`. Opsional `apakabar-firebase` berisi `firebase-key.json`.
3. **Gambar**: build `apps/gateway/Dockerfile`, dorong ke `asia-southeast2-docker.pkg.dev/hkbp-superapp-prod/hkbp-superapp/apakabar-gateway`.
4. **Migrasi**: jalankan Job `apakabar-migrasi` (langsung ke Postgres, bukan pgbouncer).
5. **Data awal**: impor daftar pelayan (`npm run impor`) dan buat admin utama pertama lewat SQL.
6. **DNS + sertifikat** untuk host HTTPRoute; lalu terapkan Deployment, Service, HTTPRoute, GCPBackendPolicy.
7. **Lampiran**: disimpan di bucket GCS superapp (`hkbp-superapp-assets`) dengan awalan `apakabar/berkas/`, lewat Workload Identity (`hkbp-api-sa`). Periksa bahwa akun layanan itu boleh menulis/menghapus objek di awalan tersebut, dan jangan buat awalan itu publik. Opsional: aturan siklus hidup bucket untuk awalan itu (hapus > 31 hari). Jalur GCS belum diuji (uji lokal memakai disk).
8. **Sebelum dipakai**: ganti `BASE` di aplikasi mobile; hapus akun uji.
