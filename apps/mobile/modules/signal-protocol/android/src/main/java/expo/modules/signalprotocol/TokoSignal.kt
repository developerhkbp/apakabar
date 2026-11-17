package expo.modules.signalprotocol

import org.signal.libsignal.protocol.IdentityKey
import org.signal.libsignal.protocol.IdentityKeyPair
import org.signal.libsignal.protocol.InvalidKeyIdException
import org.signal.libsignal.protocol.ReusedBaseKeyException
import org.signal.libsignal.protocol.SignalProtocolAddress
import org.signal.libsignal.protocol.ecc.ECPublicKey
import org.signal.libsignal.protocol.groups.state.SenderKeyRecord
import org.signal.libsignal.protocol.state.IdentityKeyStore
import org.signal.libsignal.protocol.state.KyberPreKeyRecord
import org.signal.libsignal.protocol.state.PreKeyRecord
import org.signal.libsignal.protocol.state.SessionRecord
import org.signal.libsignal.protocol.state.SignalProtocolStore
import org.signal.libsignal.protocol.state.SignedPreKeyRecord
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.util.UUID

/**
 * SignalProtocolStore yang seluruh isinya (identitas, prekey, sesi, sender key) disimpan
 * terenkripsi lewat [Brankas] setiap kali ada perubahan. Satu akun per perangkat.
 */
class TokoSignal private constructor(
  private val brankas: Brankas,
  private val identitas: IdentityKeyPair,
  private val regId: Int,
) : SignalProtocolStore {
  private val identitasLawan = HashMap<String, ByteArray>()
  private val preKey = HashMap<Int, ByteArray>()
  private val signedPreKey = HashMap<Int, ByteArray>()
  private val kyber = HashMap<Int, ByteArray>()
  private val kyberTerpakai = HashSet<String>() // "id:base64(baseKey)" — deteksi pemutaran ulang
  private val sesi = HashMap<String, ByteArray>()
  private val senderKey = HashMap<String, ByteArray>()
  var prekeyBerikutnya = 1
    private set

  companion object {
    private const val BERKAS = "toko-signal"

    fun baru(brankas: Brankas, identitas: IdentityKeyPair, regId: Int): TokoSignal =
      TokoSignal(brankas, identitas, regId).also { it.simpan() }

    fun muat(brankas: Brankas): TokoSignal? {
      val data = brankas.baca(BERKAS) ?: return null
      val i = DataInputStream(ByteArrayInputStream(data))
      val ident = IdentityKeyPair(i.bacaBytes())
      val t = TokoSignal(brankas, ident, i.readInt())
      t.prekeyBerikutnya = i.readInt()
      repeat(i.readInt()) { t.identitasLawan[i.readUTF()] = i.bacaBytes() }
      repeat(i.readInt()) { t.preKey[i.readInt()] = i.bacaBytes() }
      repeat(i.readInt()) { t.signedPreKey[i.readInt()] = i.bacaBytes() }
      repeat(i.readInt()) { t.kyber[i.readInt()] = i.bacaBytes() }
      repeat(i.readInt()) { t.kyberTerpakai.add(i.readUTF()) }
      repeat(i.readInt()) { t.sesi[i.readUTF()] = i.bacaBytes() }
      repeat(i.readInt()) { t.senderKey[i.readUTF()] = i.bacaBytes() }
      return t
    }

    private fun DataInputStream.bacaBytes(): ByteArray = ByteArray(readInt()).also { readFully(it) }
  }

  private fun DataOutputStream.tulisBytes(b: ByteArray) { writeInt(b.size); write(b) }

  @Synchronized
  fun simpan() {
    val o = ByteArrayOutputStream()
    val d = DataOutputStream(o)
    d.tulisBytes(identitas.serialize())
    d.writeInt(regId)
    d.writeInt(prekeyBerikutnya)
    d.writeInt(identitasLawan.size); identitasLawan.forEach { (k, v) -> d.writeUTF(k); d.tulisBytes(v) }
    d.writeInt(preKey.size); preKey.forEach { (k, v) -> d.writeInt(k); d.tulisBytes(v) }
    d.writeInt(signedPreKey.size); signedPreKey.forEach { (k, v) -> d.writeInt(k); d.tulisBytes(v) }
    d.writeInt(kyber.size); kyber.forEach { (k, v) -> d.writeInt(k); d.tulisBytes(v) }
    d.writeInt(kyberTerpakai.size); kyberTerpakai.forEach { d.writeUTF(it) }
    d.writeInt(sesi.size); sesi.forEach { (k, v) -> d.writeUTF(k); d.tulisBytes(v) }
    d.writeInt(senderKey.size); senderKey.forEach { (k, v) -> d.writeUTF(k); d.tulisBytes(v) }
    brankas.tulis(BERKAS, o.toByteArray())
  }

  @Synchronized
  fun ambilIdPreKey(jumlah: Int): IntRange {
    val awal = prekeyBerikutnya
    prekeyBerikutnya += jumlah
    return awal until prekeyBerikutnya
  }

  val jumlahPreKey: Int @Synchronized get() = preKey.size

  // --- IdentityKeyStore ---
  override fun getIdentityKeyPair(): IdentityKeyPair = identitas
  override fun getLocalRegistrationId(): Int = regId

  @Synchronized
  override fun saveIdentity(a: SignalProtocolAddress, k: IdentityKey): IdentityKeyStore.IdentityChange {
    val lama = identitasLawan[a.toString()]
    val baru = k.serialize()
    identitasLawan[a.toString()] = baru
    simpan()
    return if (lama != null && !lama.contentEquals(baru)) IdentityKeyStore.IdentityChange.REPLACED_EXISTING
    else IdentityKeyStore.IdentityChange.NEW_OR_UNCHANGED
  }

  // v1: percaya pada penggunaan pertama (TOFU). Verifikasi kode keamanan menyusul.
  override fun isTrustedIdentity(a: SignalProtocolAddress, k: IdentityKey, d: IdentityKeyStore.Direction): Boolean = true

  @Synchronized
  override fun getIdentity(a: SignalProtocolAddress): IdentityKey? = identitasLawan[a.toString()]?.let { IdentityKey(it) }

  // --- PreKeyStore ---
  @Synchronized
  override fun loadPreKey(id: Int): PreKeyRecord =
    PreKeyRecord(preKey[id] ?: throw InvalidKeyIdException("Prekey $id tidak ada"))

  @Synchronized
  override fun storePreKey(id: Int, r: PreKeyRecord) { preKey[id] = r.serialize(); simpan() }
  @Synchronized
  override fun containsPreKey(id: Int): Boolean = preKey.containsKey(id)
  @Synchronized
  override fun removePreKey(id: Int) { preKey.remove(id); simpan() }

  // --- SignedPreKeyStore ---
  @Synchronized
  override fun loadSignedPreKey(id: Int): SignedPreKeyRecord =
    SignedPreKeyRecord(signedPreKey[id] ?: throw InvalidKeyIdException("Signed prekey $id tidak ada"))

  @Synchronized
  override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> = signedPreKey.values.map { SignedPreKeyRecord(it) }.toMutableList()
  @Synchronized
  override fun storeSignedPreKey(id: Int, r: SignedPreKeyRecord) { signedPreKey[id] = r.serialize(); simpan() }
  @Synchronized
  override fun containsSignedPreKey(id: Int): Boolean = signedPreKey.containsKey(id)
  @Synchronized
  override fun removeSignedPreKey(id: Int) { signedPreKey.remove(id); simpan() }

  // --- KyberPreKeyStore ---
  @Synchronized
  override fun loadKyberPreKey(id: Int): KyberPreKeyRecord =
    KyberPreKeyRecord(kyber[id] ?: throw InvalidKeyIdException("Kyber prekey $id tidak ada"))

  @Synchronized
  override fun loadKyberPreKeys(): MutableList<KyberPreKeyRecord> = kyber.values.map { KyberPreKeyRecord(it) }.toMutableList()
  @Synchronized
  override fun storeKyberPreKey(id: Int, r: KyberPreKeyRecord) { kyber[id] = r.serialize(); simpan() }
  @Synchronized
  override fun containsKyberPreKey(id: Int): Boolean = kyber.containsKey(id)

  /** Kunci Kyber ini dipakai ulang (sebagai "last resort"), jadi pemutaran ulang dideteksi lewat base key. */
  @Synchronized
  override fun markKyberPreKeyUsed(id: Int, signedPreKeyId: Int, baseKey: ECPublicKey) {
    val tanda = "$id:${android.util.Base64.encodeToString(baseKey.serialize(), android.util.Base64.NO_WRAP)}"
    if (!kyberTerpakai.add(tanda)) throw ReusedBaseKeyException("Base key sudah pernah dipakai")
    simpan()
  }

  // --- SessionStore ---
  @Synchronized
  override fun loadSession(a: SignalProtocolAddress): SessionRecord =
    sesi[a.toString()]?.let { SessionRecord(it) } ?: SessionRecord()

  @Synchronized
  override fun loadExistingSessions(daftar: MutableList<SignalProtocolAddress>): MutableList<SessionRecord> =
    daftar.map { a -> SessionRecord(sesi[a.toString()] ?: throw org.signal.libsignal.protocol.NoSessionException("Tidak ada sesi untuk $a")) }.toMutableList()

  @Synchronized
  override fun getSubDeviceSessions(nama: String): MutableList<Int> =
    sesi.keys.filter { it.startsWith("$nama.") }.map { it.substringAfterLast('.').toInt() }.filter { it != 1 }.toMutableList()

  @Synchronized
  override fun storeSession(a: SignalProtocolAddress, r: SessionRecord) { sesi[a.toString()] = r.serialize(); simpan() }
  @Synchronized
  override fun containsSession(a: SignalProtocolAddress): Boolean =
    sesi[a.toString()]?.let { SessionRecord(it).hasSenderChain() } ?: false

  @Synchronized
  override fun deleteSession(a: SignalProtocolAddress) { sesi.remove(a.toString()); simpan() }
  @Synchronized
  override fun deleteAllSessions(nama: String) { sesi.keys.removeAll { it.startsWith("$nama.") }; simpan() }

  // --- SenderKeyStore ---
  @Synchronized
  override fun storeSenderKey(a: SignalProtocolAddress, distribusi: UUID, r: SenderKeyRecord) {
    senderKey["$a|$distribusi"] = r.serialize(); simpan()
  }

  @Synchronized
  override fun loadSenderKey(a: SignalProtocolAddress, distribusi: UUID): SenderKeyRecord? =
    senderKey["$a|$distribusi"]?.let { SenderKeyRecord(it) }
}
