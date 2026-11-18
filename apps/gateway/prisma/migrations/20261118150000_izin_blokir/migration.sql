CREATE TYPE "StatusIzin" AS ENUM ('MENUNGGU', 'DITERIMA', 'DITOLAK');

CREATE TABLE "IzinObrolan" (
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "pemintaId" TEXT NOT NULL,
    "status" "StatusIzin" NOT NULL DEFAULT 'MENUNGGU',
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubahPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IzinObrolan_pkey" PRIMARY KEY ("aId","bId")
);

CREATE TABLE "Blokir" (
    "pemblokirId" TEXT NOT NULL,
    "diblokirId" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blokir_pkey" PRIMARY KEY ("pemblokirId","diblokirId")
);

CREATE TABLE "RiwayatObrolan" (
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "aKlaim" BOOLEAN NOT NULL DEFAULT false,
    "bKlaim" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RiwayatObrolan_pkey" PRIMARY KEY ("aId","bId")
);

CREATE INDEX "IzinObrolan_bId_idx" ON "IzinObrolan"("bId");
CREATE INDEX "Blokir_diblokirId_idx" ON "Blokir"("diblokirId");
