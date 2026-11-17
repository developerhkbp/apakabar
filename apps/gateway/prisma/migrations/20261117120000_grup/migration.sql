-- CreateEnum
CREATE TYPE "PeranGrup" AS ENUM ('ANGGOTA', 'ADMIN_GRUP');

-- DropIndex
DROP INDEX "PesanAntrean_pengirimId_idKlien_key";

-- AlterTable
ALTER TABLE "PesanAntrean" ADD COLUMN     "grupId" TEXT;

-- CreateTable
CREATE TABLE "Grup" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "idDistribusi" TEXT NOT NULL,
    "dibuatOleh" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnggotaGrup" (
    "grupId" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "peran" "PeranGrup" NOT NULL DEFAULT 'ANGGOTA',
    "bergabungPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnggotaGrup_pkey" PRIMARY KEY ("grupId","anggotaId")
);

-- CreateIndex
CREATE INDEX "AnggotaGrup_anggotaId_idx" ON "AnggotaGrup"("anggotaId");

-- CreateIndex
CREATE UNIQUE INDEX "PesanAntrean_pengirimId_idKlien_penerimaId_key" ON "PesanAntrean"("pengirimId", "idKlien", "penerimaId");

-- AddForeignKey
ALTER TABLE "AnggotaGrup" ADD CONSTRAINT "AnggotaGrup_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "Grup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnggotaGrup" ADD CONSTRAINT "AnggotaGrup_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

