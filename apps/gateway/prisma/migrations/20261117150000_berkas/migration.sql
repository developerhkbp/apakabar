-- CreateTable
CREATE TABLE "Berkas" (
    "id" TEXT NOT NULL,
    "pengunggah" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kedaluwarsa" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Berkas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Berkas_kedaluwarsa_idx" ON "Berkas"("kedaluwarsa");
