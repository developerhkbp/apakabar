package expo.modules.signalprotocol

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import java.io.File

/**
 * Menerima isi yang dibagikan dari aplikasi lain lewat menu "Bagikan" Android (teks, foto, video, dokumen).
 * Berkas disalin ke cache aplikasi karena izin baca Uri dari aplikasi pengirim hanya berlaku sementara.
 */
object Bagikan {
  private const val MAKS_SALIN = 70L * 1024 * 1024
  private const val BATAS_UMUR_MS = 3600_000L

  fun adalahBagikan(i: Intent?): Boolean = i != null && (i.action == Intent.ACTION_SEND || i.action == Intent.ACTION_SEND_MULTIPLE)

  @Suppress("DEPRECATION")
  private fun daftarUri(i: Intent): List<Uri> {
    val hasil = LinkedHashSet<Uri>()
    if (i.action == Intent.ACTION_SEND_MULTIPLE) {
      val l = if (Build.VERSION.SDK_INT >= 33) i.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java) else i.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
      l?.let { hasil.addAll(it) }
    } else {
      val u = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java) else i.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
      if (u != null) hasil.add(u)
    }
    val c = i.clipData
    if (hasil.isEmpty() && c != null) for (n in 0 until c.itemCount) c.getItemAt(n).uri?.let { hasil.add(it) }
    return hasil.toList()
  }

  private fun bersihkanLama(dir: File) {
    val batas = System.currentTimeMillis() - BATAS_UMUR_MS
    dir.listFiles()?.forEach { if (it.lastModified() < batas) it.delete() }
  }

  /** Membaca isi bagikan dari [i]; mengembalikan null bila bukan intent bagikan atau tidak ada isinya. */
  fun baca(ctx: Context, i: Intent): Map<String, Any>? {
    if (!adalahBagikan(i)) return null
    val teks = i.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    val dir = File(ctx.cacheDir, "bagikan").apply { mkdirs() }
    bersihkanLama(dir)
    val cr: ContentResolver = ctx.contentResolver
    val berkas = ArrayList<Map<String, Any>>()
    daftarUri(i).forEachIndexed { n, uri ->
      var nama: String? = null
      var ukuran = -1L
      try {
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
          if (c.moveToFirst()) {
            c.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { nama = c.getString(it) }
            c.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !c.isNull(it) }?.let { ukuran = c.getLong(it) }
          }
        }
      } catch (e: Exception) { /* nama dan ukuran dihitung dari hasil salinan */ }
      val mime = cr.getType(uri) ?: i.type?.takeIf { !it.endsWith("/*") } ?: "application/octet-stream"
      val aman = (nama ?: uri.lastPathSegment ?: "berkas-$n").replace(Regex("[^A-Za-z0-9._-]"), "_")
      if (ukuran > MAKS_SALIN) {
        // terlalu besar untuk dikirim; tidak disalin, JS menampilkan alasan penolakan
        berkas.add(mapOf("uri" to "", "nama" to (nama ?: aman), "mime" to mime, "ukuran" to ukuran.toDouble()))
        return@forEachIndexed
      }
      val tujuan = File(dir, "${System.currentTimeMillis()}-$n-$aman")
      try {
        cr.openInputStream(uri)?.use { masuk -> tujuan.outputStream().use { keluar -> masuk.copyTo(keluar, 64 * 1024) } }
        berkas.add(mapOf("uri" to "file://" + tujuan.absolutePath, "nama" to (nama ?: aman), "mime" to mime, "ukuran" to tujuan.length().toDouble()))
      } catch (e: Exception) {
        tujuan.delete()
        berkas.add(mapOf("uri" to "", "nama" to (nama ?: aman), "mime" to mime, "ukuran" to 0.0))
      }
    }
    if (teks.isEmpty() && berkas.isEmpty()) return null
    return mapOf("teks" to teks, "berkas" to berkas)
  }

  /** Menandai intent sudah diproses agar tidak dibaca dua kali. */
  fun tandaiSelesai(i: Intent) {
    i.action = Intent.ACTION_MAIN
    i.removeExtra(Intent.EXTRA_STREAM)
    i.removeExtra(Intent.EXTRA_TEXT)
    i.clipData = null
  }
}
