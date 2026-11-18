package expo.modules.signalprotocol

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Base64
import com.google.firebase.messaging.FirebaseMessaging
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.signal.libsignal.protocol.IdentityKey
import org.signal.libsignal.protocol.IdentityKeyPair
import org.signal.libsignal.protocol.SessionBuilder
import org.signal.libsignal.protocol.SessionCipher
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.ecc.ECKeyPair
import org.signal.libsignal.protocol.ecc.ECPublicKey
import org.signal.libsignal.protocol.groups.GroupCipher
import org.signal.libsignal.protocol.groups.GroupSessionBuilder
import org.signal.libsignal.protocol.kem.KEMKeyPair
import org.signal.libsignal.protocol.kem.KEMKeyType
import org.signal.libsignal.protocol.kem.KEMPublicKey
import org.signal.libsignal.protocol.message.CiphertextMessage
import org.signal.libsignal.protocol.message.PreKeySignalMessage
import org.signal.libsignal.protocol.message.SenderKeyDistributionMessage
import org.signal.libsignal.protocol.message.SignalMessage
import org.signal.libsignal.protocol.state.KyberPreKeyRecord
import org.signal.libsignal.protocol.state.PreKeyBundle
import org.signal.libsignal.protocol.state.PreKeyRecord
import org.signal.libsignal.protocol.state.SignedPreKeyRecord
import java.security.SecureRandom
import java.util.UUID

/**
 * Pembungkus libsignal untuk ApaKabaR. Satu akun per perangkat; seluruh kunci dan sesi
 * disimpan terenkripsi (Android Keystore + AES-GCM) lewat [TokoSignal]. Byte dikirim ke JS sebagai base64.
 * Brankas yang sama juga dipakai JS untuk menyimpan token dan riwayat pesan (simpan/baca).
 */
class SignalProtocolModule : Module() {
  private val brankas by lazy { Brankas(java.io.File(appContext.reactContext!!.filesDir, "apakabar")) }
  private var toko: TokoSignal? = null
  @Volatile private var bagikanTertunda: android.content.Intent? = null

  private fun ambil(): TokoSignal {
    toko?.let { return it }
    val t = TokoSignal.muat(brankas) ?: throw IllegalStateException("Perangkat belum didaftarkan")
    toko = t
    return t
  }

  private fun b64(b: ByteArray): String = Base64.encodeToString(b, Base64.NO_WRAP)
  private fun deb64(s: String): ByteArray = Base64.decode(s, Base64.NO_WRAP)
  private fun alamat(nama: String) = SignalProtocolAddress(nama, 1)

  private fun buatPreKey(t: TokoSignal, jumlah: Int): List<Map<String, Any>> {
    val hasil = ArrayList<Map<String, Any>>()
    for (id in t.ambilIdPreKey(jumlah)) {
      val k = ECKeyPair.generate()
      t.storePreKey(id, PreKeyRecord(id, k))
      hasil.add(mapOf("id" to id, "pub" to b64(k.publicKey.serialize())))
    }
    return hasil
  }

  override fun definition() = ModuleDefinition {
    Name("SignalProtocol")

    Function("versi") { "libsignal-android 0.86.5" }

    Function("ada") { brankas.baca("toko-signal") != null }

    /** Membuat identitas baru dan menggantikan yang lama (dipakai saat masuk). */
    AsyncFunction("daftar") { jumlahOtp: Int ->
      brankas.hapusSemua()
      toko = null
      val identitas = IdentityKeyPair.generate()
      val regId = SecureRandom().nextInt(16380) + 1
      val t = TokoSignal.baru(brankas, identitas, regId)
      toko = t

      val spk = ECKeyPair.generate()
      val spkSig = identitas.privateKey.calculateSignature(spk.publicKey.serialize())
      t.storeSignedPreKey(1, SignedPreKeyRecord(1, System.currentTimeMillis(), spk, spkSig))

      val kyber = KEMKeyPair.generate(KEMKeyType.KYBER_1024)
      val kyberSig = identitas.privateKey.calculateSignature(kyber.publicKey.serialize())
      t.storeKyberPreKey(1, KyberPreKeyRecord(1, System.currentTimeMillis(), kyber, kyberSig))

      mapOf(
        "deviceId" to 1,
        "regId" to regId,
        "identitas" to b64(identitas.publicKey.serialize()),
        "signedPreKey" to mapOf("id" to 1, "pub" to b64(spk.publicKey.serialize()), "sig" to b64(spkSig)),
        "kyber" to mapOf("id" to 1, "pub" to b64(kyber.publicKey.serialize()), "sig" to b64(kyberSig)),
        "oneTime" to buatPreKey(t, jumlahOtp),
      )
    }

    /** Membuat prekey sekali-pakai tambahan untuk diunggah ke server. */
    AsyncFunction("buatPrekeyBaru") { jumlah: Int -> buatPreKey(ambil(), jumlah) }

    Function("jumlahPrekey") { ambil().jumlahPreKey }

    Function("punyaSesi") { dengan: String -> ambil().containsSession(alamat(dengan)) }

    AsyncFunction("mulaiSesi") { p: Map<String, Any?> ->
      val t = ambil()
      @Suppress("UNCHECKED_CAST")
      val spk = p["signedPreKey"] as Map<String, Any>
      @Suppress("UNCHECKED_CAST")
      val ky = p["kyber"] as Map<String, Any>
      @Suppress("UNCHECKED_CAST")
      val ot = p["oneTime"] as Map<String, Any>?
      val bundle = PreKeyBundle(
        (p["regId"] as Number).toInt(),
        (p["deviceId"] as Number).toInt(),
        ot?.let { (it["id"] as Number).toInt() } ?: -1,
        ot?.let { ECPublicKey(deb64(it["pub"] as String)) },
        (spk["id"] as Number).toInt(),
        ECPublicKey(deb64(spk["pub"] as String)),
        deb64(spk["sig"] as String),
        IdentityKey(deb64(p["identitas"] as String)),
        (ky["id"] as Number).toInt(),
        KEMPublicKey(deb64(ky["pub"] as String)),
        deb64(ky["sig"] as String),
      )
      SessionBuilder(t, alamat(p["nama"] as String)).process(bundle)
    }

    AsyncFunction("enkripsi") { untuk: String, teks: String ->
      val c: CiphertextMessage = SessionCipher(ambil(), alamat(untuk)).encrypt(teks.toByteArray(Charsets.UTF_8))
      mapOf("jenis" to c.type, "isi" to b64(c.serialize()))
    }

    AsyncFunction("dekripsi") { dari: String, jenis: Int, isi: String ->
      val cipher = SessionCipher(ambil(), alamat(dari))
      val bytes = deb64(isi)
      val out = if (jenis == CiphertextMessage.PREKEY_TYPE) cipher.decrypt(PreKeySignalMessage(bytes))
      else cipher.decrypt(SignalMessage(bytes))
      String(out, Charsets.UTF_8)
    }

    AsyncFunction("buatKunciGrup") { idGrup: String ->
      val t = ambil()
      val d = GroupSessionBuilder(t).create(alamat("saya"), UUID.fromString(idGrup))
      b64(d.serialize())
    }

    AsyncFunction("terimaKunciGrup") { dari: String, kunci: String ->
      GroupSessionBuilder(ambil()).process(alamat(dari), SenderKeyDistributionMessage(deb64(kunci)))
    }

    AsyncFunction("enkripsiGrup") { idGrup: String, teks: String ->
      val c = GroupCipher(ambil(), alamat("saya")).encrypt(UUID.fromString(idGrup), teks.toByteArray(Charsets.UTF_8))
      b64(c.serialize())
    }

    AsyncFunction("dekripsiGrup") { dari: String, isi: String ->
      String(GroupCipher(ambil(), alamat(dari)).decrypt(deb64(isi)), Charsets.UTF_8)
    }

    /** Token FCM perangkat ini (untuk didaftarkan ke gateway). */
    AsyncFunction("tokenPush") { promise: Promise ->
      FirebaseMessaging.getInstance().token.addOnCompleteListener { t ->
        if (t.isSuccessful) promise.resolve(t.result) else promise.reject("ERR_PUSH", t.exception?.message ?: "Gagal mengambil token push", t.exception)
      }
    }

    /** Saluran notifikasi pesan dengan suara dering HKBP (res/raw/notifikasi_hkbp), sama dengan superapp. Aman dipanggil berulang. */
    Function("siapkanSaluranPesan") {
      val ctx = appContext.reactContext ?: return@Function null
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val suara = Uri.parse("android.resource://${ctx.packageName}/raw/notifikasi_hkbp")
        val atribut = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        val saluran = NotificationChannel("apakabar_pesan_v1", "Pesan ApaKabaR", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Pemberitahuan pesan dan permintaan baru"
          enableVibration(true)
          setSound(suara, atribut)
        }
        nm?.createNotificationChannel(saluran)
      }
      null
    }

    /** Tujuan dari notifikasi yang diketuk (extra "tujuan" pada intent peluncuran); dibaca sekali lalu dihapus. */
    Function("tujuanNotifikasi") {
      val intent = appContext.currentActivity?.intent
      val tujuan = intent?.getStringExtra("tujuan")
      if (tujuan != null) intent?.removeExtra("tujuan")
      tujuan
    }

    // --- Isi yang dibagikan dari aplikasi lain (menu Bagikan Android) ---
    // Intent baru (aplikasi sudah berjalan) tidak otomatis menjadi intent Activity, jadi disimpan di sini.
    OnNewIntent { intent -> if (Bagikan.adalahBagikan(intent)) bagikanTertunda = intent }

    /** Isi bagikan yang belum diproses ({teks, berkas[]}) atau null; dibaca sekali lalu ditandai selesai. */
    AsyncFunction("bagikanMasuk") {
      val ctx = appContext.reactContext ?: return@AsyncFunction null
      val i = bagikanTertunda ?: appContext.currentActivity?.intent
      if (i == null || !Bagikan.adalahBagikan(i)) return@AsyncFunction null
      bagikanTertunda = null
      val hasil = Bagikan.baca(ctx, i)
      Bagikan.tandaiSelesai(i)
      hasil
    }

    // --- Brankas terenkripsi untuk data aplikasi (token, riwayat pesan) ---
    AsyncFunction("simpan") { nama: String, nilai: String -> brankas.tulis("data-$nama", nilai.toByteArray(Charsets.UTF_8)) }
    AsyncFunction("baca") { nama: String -> brankas.baca("data-$nama")?.let { String(it, Charsets.UTF_8) } }
    AsyncFunction("hapusSemua") {
      toko = null
      brankas.hapusSemua()
      java.io.File(appContext.reactContext!!.filesDir, "apakabar/media").deleteRecursively()
    }

    // --- Lampiran terenkripsi (foto, video, dokumen) ---
    AsyncFunction("unggahBerkas") { sumber: String, url: String, token: String ->
      Lampiran.unggah(sumber, url, token, appContext.reactContext!!.cacheDir)
    }
    AsyncFunction("unduhBerkas") { url: String, token: String, kunci: String, iv: String, namaFile: String ->
      val tujuan = java.io.File(appContext.reactContext!!.filesDir, "apakabar/media/" + namaFile.replace(Regex("[^A-Za-z0-9._-]"), "_"))
      Lampiran.unduh(url, token, kunci, iv, tujuan, appContext.reactContext!!.cacheDir)
    }
    AsyncFunction("thumbnail") { sumber: String, video: Boolean, maks: Int -> Lampiran.thumbnail(sumber, video, maks) }
    Function("ukuranBerkas") { sumber: String -> Lampiran.ukuran(sumber) }
  }
}
