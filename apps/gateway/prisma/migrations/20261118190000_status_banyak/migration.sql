DROP INDEX "StatusHarian_anggotaId_key";
CREATE INDEX "StatusHarian_anggotaId_kedaluwarsa_idx" ON "StatusHarian"("anggotaId", "kedaluwarsa");
