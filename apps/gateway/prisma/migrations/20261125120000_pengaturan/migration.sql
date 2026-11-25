CREATE TABLE "Pengaturan" (
    "kunci" TEXT NOT NULL,
    "nilai" TEXT NOT NULL,
    "diubahPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pengaturan_pkey" PRIMARY KEY ("kunci")
);
