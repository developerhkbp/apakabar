package expo.modules.signalprotocol

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Penyimpanan berkas terenkripsi. Kunci AES-256 dibuat dan disimpan di Android Keystore
 * (tidak pernah keluar dari perangkat keras/sistem), data ditulis AES-GCM: iv(12) + ciphertext.
 * Penulisan atomik (berkas sementara lalu rename) agar tidak rusak bila aplikasi dimatikan paksa.
 */
class Brankas(private val folder: File) {
  private val alias = "apakabar_brankas_v1"

  init {
    folder.mkdirs()
  }

  private fun kunci(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (ks.getKey(alias, null) as? SecretKey)?.let { return it }
    val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    g.init(
      KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return g.generateKey()
  }

  private fun berkas(nama: String): File {
    require(nama.matches(Regex("[A-Za-z0-9_.-]{1,80}"))) { "Nama berkas tidak valid" }
    return File(folder, "$nama.bin")
  }

  @Synchronized
  fun tulis(nama: String, data: ByteArray) {
    val c = Cipher.getInstance("AES/GCM/NoPadding")
    c.init(Cipher.ENCRYPT_MODE, kunci())
    val keluar = c.iv + c.doFinal(data)
    val tujuan = berkas(nama)
    val sementara = File(folder, "$nama.tmp")
    sementara.writeBytes(keluar)
    if (!sementara.renameTo(tujuan)) {
      tujuan.delete()
      check(sementara.renameTo(tujuan)) { "Gagal menyimpan berkas" }
    }
  }

  @Synchronized
  fun baca(nama: String): ByteArray? {
    val f = berkas(nama)
    if (!f.exists()) return null
    val b = f.readBytes()
    if (b.size < 13) return null
    val c = Cipher.getInstance("AES/GCM/NoPadding")
    c.init(Cipher.DECRYPT_MODE, kunci(), GCMParameterSpec(128, b, 0, 12))
    return c.doFinal(b, 12, b.size - 12)
  }

  @Synchronized
  fun hapus(nama: String) {
    berkas(nama).delete()
  }

  @Synchronized
  fun hapusSemua() {
    folder.listFiles()?.forEach { it.delete() }
  }
}
