package expo.modules.signalprotocol

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Lampiran terenkripsi ujung ke ujung. Berkas dipecah per 64 KB dan tiap bagian dienkripsi AES-256-GCM
 * dengan nonce = awalan acak 8 byte + nomor urut 4 byte; bagian terakhir ditandai lewat AAD sehingga
 * pemotongan berkas terdeteksi. Kunci dan awalan nonce hanya dikirim di dalam pesan Signal; server
 * hanya menyimpan byte acak. Memori tetap kecil walau berkas puluhan MB.
 */
object Lampiran {
  private const val BAGIAN = 64 * 1024
  private const val TAG = 16
  private val acak = SecureRandom()

  private fun bersihkan(p: String) = if (p.startsWith("file://")) java.net.URI(p).path else p

  private fun cipher(mode: Int, kunci: ByteArray, awalan: ByteArray, nomor: Int): Cipher {
    val nonce = ByteBuffer.allocate(12).put(awalan).putInt(nomor).array()
    val c = Cipher.getInstance("AES/GCM/NoPadding")
    c.init(mode, SecretKeySpec(kunci, "AES"), GCMParameterSpec(TAG * 8, nonce))
    return c
  }

  private fun isi(i: InputStream, b: ByteArray): Int {
    var n = 0
    while (n < b.size) { val r = i.read(b, n, b.size - n); if (r < 0) break; n += r }
    return n
  }

  private fun enkripsi(masuk: File, keluar: File, kunci: ByteArray, awalan: ByteArray) {
    BufferedInputStream(FileInputStream(masuk), BAGIAN).use { i ->
      BufferedOutputStream(FileOutputStream(keluar), BAGIAN).use { o ->
        var sekarang = ByteArray(BAGIAN)
        var n = isi(i, sekarang)
        var nomor = 0
        while (n > 0) {
          val depan = ByteArray(BAGIAN)
          val m = isi(i, depan) // baca satu bagian ke depan untuk tahu apakah ini bagian terakhir
          val c = cipher(Cipher.ENCRYPT_MODE, kunci, awalan, nomor++)
          c.updateAAD(byteArrayOf(if (m == 0) 1 else 0))
          o.write(c.doFinal(sekarang, 0, n))
          sekarang = depan; n = m
        }
      }
    }
  }

  private fun dekripsi(masuk: File, keluar: File, kunci: ByteArray, awalan: ByteArray) {
    BufferedInputStream(FileInputStream(masuk), BAGIAN + TAG).use { i ->
      BufferedOutputStream(FileOutputStream(keluar), BAGIAN).use { o ->
        var sekarang = ByteArray(BAGIAN + TAG)
        var n = isi(i, sekarang)
        if (n <= TAG) throw IllegalStateException("Berkas rusak")
        var nomor = 0
        while (n > 0) {
          val depan = ByteArray(BAGIAN + TAG)
          val m = isi(i, depan)
          val c = cipher(Cipher.DECRYPT_MODE, kunci, awalan, nomor++)
          c.updateAAD(byteArrayOf(if (m == 0) 1 else 0))
          o.write(c.doFinal(sekarang, 0, n))
          sekarang = depan; n = m
        }
      }
    }
  }

  /** Mengenkripsi [sumber] lalu mengunggah ke gateway. Mengembalikan id blob, kunci, dan awalan nonce. */
  fun unggah(sumber: String, url: String, token: String, cache: File): Map<String, Any> {
    val masuk = File(bersihkan(sumber))
    if (!masuk.exists() || masuk.length() == 0L) throw IllegalStateException("Berkas tidak ditemukan atau kosong")
    val kunci = ByteArray(32).also { acak.nextBytes(it) }
    val awalan = ByteArray(8).also { acak.nextBytes(it) }
    val sementara = File.createTempFile("unggah", ".enc", cache)
    try {
      enkripsi(masuk, sementara, kunci, awalan)
      val k = URL(url).openConnection() as HttpURLConnection
      k.requestMethod = "POST"
      k.doOutput = true
      k.connectTimeout = 20000
      k.readTimeout = 120000
      k.setFixedLengthStreamingMode(sementara.length())
      k.setRequestProperty("Authorization", "Bearer $token")
      k.setRequestProperty("Content-Type", "application/octet-stream")
      FileInputStream(sementara).use { i -> k.outputStream.use { o -> i.copyTo(o, BAGIAN) } }
      if (k.responseCode != 201) {
        val pesan = try { k.errorStream?.bufferedReader()?.readText() } catch (e: Exception) { null }
        throw IllegalStateException("Unggah gagal (${k.responseCode}) ${pesan ?: ""}".trim())
      }
      val id = JSONObject(k.inputStream.bufferedReader().readText()).getString("id")
      return mapOf(
        "id" to id,
        "kunci" to Base64.encodeToString(kunci, Base64.NO_WRAP),
        "iv" to Base64.encodeToString(awalan, Base64.NO_WRAP),
        "ukuran" to masuk.length().toDouble(),
      )
    } finally { sementara.delete() }
  }

  /** Mengunduh blob lalu mendekripsinya ke [tujuan]. Berkas hasil tidak ditulis bila tag GCM tidak cocok. */
  fun unduh(url: String, token: String, kunciB64: String, ivB64: String, tujuan: File, cache: File): String {
    if (tujuan.exists() && tujuan.length() > 0) return tujuan.absolutePath
    tujuan.parentFile?.mkdirs()
    val sementara = File.createTempFile("unduh", ".enc", cache)
    val hasil = File(tujuan.absolutePath + ".tmp")
    try {
      val k = URL(url).openConnection() as HttpURLConnection
      k.connectTimeout = 20000
      k.readTimeout = 120000
      k.setRequestProperty("Authorization", "Bearer $token")
      if (k.responseCode != 200) throw IllegalStateException(if (k.responseCode == 404) "Berkas sudah tidak tersedia di server" else "Unduh gagal (${k.responseCode})")
      k.inputStream.use { i -> FileOutputStream(sementara).use { o -> i.copyTo(o, BAGIAN) } }
      dekripsi(sementara, hasil, Base64.decode(kunciB64, Base64.NO_WRAP), Base64.decode(ivB64, Base64.NO_WRAP))
      if (!hasil.renameTo(tujuan)) throw IllegalStateException("Gagal menyimpan berkas")
      return tujuan.absolutePath
    } catch (e: Exception) {
      hasil.delete()
      throw e
    } finally { sementara.delete() }
  }

  /** Gambar kecil (JPEG, data URI) dari foto atau video untuk pratinjau di gelembung pesan. */
  fun thumbnail(sumber: String, video: Boolean, maks: Int): String? {
    val jalur = bersihkan(sumber)
    var bmp: Bitmap? = null
    if (video) {
      val r = MediaMetadataRetriever()
      try { r.setDataSource(jalur); bmp = r.getFrameAtTime(0) } catch (e: Exception) { return null } finally { try { r.release() } catch (e: Exception) {} }
    } else {
      val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(jalur, o)
      if (o.outWidth <= 0) return null
      var s = 1
      while (o.outWidth / (s * 2) >= maks && o.outHeight / (s * 2) >= maks) s *= 2
      bmp = BitmapFactory.decodeFile(jalur, BitmapFactory.Options().apply { inSampleSize = s })
      val arah = try { ExifInterface(jalur).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) } catch (e: Exception) { 1 }
      val sudut = when (arah) { 6 -> 90f; 3 -> 180f; 8 -> 270f; else -> 0f }
      if (bmp != null && sudut != 0f) bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(sudut) }, true)
    }
    if (bmp == null) return null
    val skala = maks.toFloat() / maxOf(bmp.width, bmp.height)
    val kecil = if (skala < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * skala).toInt().coerceAtLeast(1), (bmp.height * skala).toInt().coerceAtLeast(1), true) else bmp
    val o = ByteArrayOutputStream()
    kecil.compress(Bitmap.CompressFormat.JPEG, 60, o)
    return "data:image/jpeg;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP)
  }

  /** Mengubah foto HEIC/HEIF menjadi JPEG (orientasi EXIF diterapkan) agar terbuka di semua perangkat. Null bila gagal didekode. */
  /** Salin foto/video ke galeri (MediaStore, tanpa izin penyimpanan). Mengembalikan true bila berhasil. */
  fun simpanKeGaleri(ctx: Context, sumber: String, nama: String, mime: String): Boolean {
    val berkas = File(bersihkan(sumber))
    if (!berkas.exists()) return false
    val video = mime.startsWith("video/")
    val koleksi = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val folder = (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/Apa Kabar"
    val nilai = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, nama)
      put(MediaStore.MediaColumns.MIME_TYPE, mime)
      put(MediaStore.MediaColumns.RELATIVE_PATH, folder)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = ctx.contentResolver.insert(koleksi, nilai) ?: return false
    return try {
      ctx.contentResolver.openOutputStream(uri)!!.use { o -> FileInputStream(berkas).use { it.copyTo(o) } }
      ctx.contentResolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
      true
    } catch (e: Exception) {
      ctx.contentResolver.delete(uri, null, null)
      false
    }
  }

  fun keJpeg(sumber: String, cache: File): String? {
    val jalur = bersihkan(sumber)
    val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(jalur, o)
    if (o.outWidth <= 0) return null
    var s = 1
    while (o.outWidth / s > 4096 || o.outHeight / s > 4096) s *= 2
    var bmp = BitmapFactory.decodeFile(jalur, BitmapFactory.Options().apply { inSampleSize = s }) ?: return null
    val arah = try { ExifInterface(jalur).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) } catch (e: Exception) { 1 }
    val sudut = when (arah) { 6 -> 90f; 3 -> 180f; 8 -> 270f; else -> 0f }
    if (sudut != 0f) bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(sudut) }, true)
    val tujuan = File.createTempFile("heif", ".jpg", cache)
    FileOutputStream(tujuan).use { bmp.compress(Bitmap.CompressFormat.JPEG, 90, it) }
    return tujuan.absolutePath
  }

  fun ukuran(sumber: String): Double = File(bersihkan(sumber)).length().toDouble()
}
