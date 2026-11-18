CREATE TABLE "StatusHarian" (
    "id" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "teks" TEXT NOT NULL,
    "suasana" TEXT,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kedaluwarsa" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusHarian_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatusKomentar" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "teks" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusKomentar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatusHarian_anggotaId_key" ON "StatusHarian"("anggotaId");
CREATE INDEX "StatusHarian_kedaluwarsa_idx" ON "StatusHarian"("kedaluwarsa");
CREATE INDEX "StatusKomentar_statusId_dibuatPada_idx" ON "StatusKomentar"("statusId", "dibuatPada");

ALTER TABLE "StatusHarian" ADD CONSTRAINT "StatusHarian_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusKomentar" ADD CONSTRAINT "StatusKomentar_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "StatusHarian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusKomentar" ADD CONSTRAINT "StatusKomentar_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
