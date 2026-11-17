-- CreateEnum
CREATE TYPE "StatusAnggota" AS ENUM ('DIUNDANG', 'MENUNGGU', 'AKTIF', 'DITANGGUHKAN');

-- CreateEnum
CREATE TYPE "PeranAnggota" AS ENUM ('USER', 'ADMIN', 'ADMIN_UTAMA');

-- CreateTable
CREATE TABLE "Anggota" (
    "id" TEXT NOT NULL,
    "nomorHp" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "sumberPelayanId" TEXT,
    "status" "StatusAnggota" NOT NULL DEFAULT 'DIUNDANG',
    "peran" "PeranAnggota" NOT NULL DEFAULT 'USER',
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anggota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perangkat" (
    "id" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "identityKey" TEXT NOT NULL,
    "signedPreKeyId" INTEGER NOT NULL,
    "signedPreKey" TEXT NOT NULL,
    "signedPreKeySig" TEXT NOT NULL,
    "kyberPreKeyId" INTEGER NOT NULL,
    "kyberPreKey" TEXT NOT NULL,
    "kyberPreKeySig" TEXT NOT NULL,
    "pushToken" TEXT,
    "versiToken" INTEGER NOT NULL DEFAULT 0,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Perangkat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimePrekey" (
    "id" TEXT NOT NULL,
    "perangkatId" TEXT NOT NULL,
    "keyId" INTEGER NOT NULL,
    "kunci" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimePrekey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpPermintaan" (
    "id" TEXT NOT NULL,
    "nomorHp" TEXT NOT NULL,
    "hashKode" TEXT NOT NULL,
    "kedaluwarsa" TIMESTAMP(3) NOT NULL,
    "percobaan" INTEGER NOT NULL DEFAULT 0,
    "terpakai" BOOLEAN NOT NULL DEFAULT false,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "OtpPermintaan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesanAntrean" (
    "id" TEXT NOT NULL,
    "penerimaId" TEXT NOT NULL,
    "pengirimId" TEXT NOT NULL,
    "jenis" INTEGER NOT NULL,
    "isi" TEXT NOT NULL,
    "idKlien" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kedaluwarsa" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PesanAntrean_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Anggota_nomorHp_key" ON "Anggota"("nomorHp");

-- CreateIndex
CREATE UNIQUE INDEX "Perangkat_anggotaId_key" ON "Perangkat"("anggotaId");

-- CreateIndex
CREATE UNIQUE INDEX "OneTimePrekey_perangkatId_keyId_key" ON "OneTimePrekey"("perangkatId", "keyId");

-- CreateIndex
CREATE INDEX "OtpPermintaan_nomorHp_dibuatPada_idx" ON "OtpPermintaan"("nomorHp", "dibuatPada");

-- CreateIndex
CREATE INDEX "PesanAntrean_penerimaId_dibuatPada_idx" ON "PesanAntrean"("penerimaId", "dibuatPada");

-- CreateIndex
CREATE UNIQUE INDEX "PesanAntrean_pengirimId_idKlien_key" ON "PesanAntrean"("pengirimId", "idKlien");

-- AddForeignKey
ALTER TABLE "Perangkat" ADD CONSTRAINT "Perangkat_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimePrekey" ADD CONSTRAINT "OneTimePrekey_perangkatId_fkey" FOREIGN KEY ("perangkatId") REFERENCES "Perangkat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesanAntrean" ADD CONSTRAINT "PesanAntrean_penerimaId_fkey" FOREIGN KEY ("penerimaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
