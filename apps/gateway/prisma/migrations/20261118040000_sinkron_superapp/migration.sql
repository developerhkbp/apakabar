ALTER TABLE "Anggota"
  ADD COLUMN "sumberCalonId" TEXT,
  ADD COLUMN "jenisSumber" TEXT,
  ADD COLUMN "grupOtomatis" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "fotoSuperapp" TEXT;
CREATE UNIQUE INDEX "Anggota_sumberCalonId_key" ON "Anggota"("sumberCalonId");
ALTER TABLE "Grup" ADD COLUMN "kunci" TEXT;
CREATE UNIQUE INDEX "Grup_kunci_key" ON "Grup"("kunci");
