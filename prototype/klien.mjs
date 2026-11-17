// Klien ApaKabaR (prototipe): penyimpanan di memori, protokol Signal resmi.
import * as S from '@signalapp/libsignal-client'

class Sesi extends S.SessionStore {
  m = new Map()
  async saveSession(a, r) { this.m.set(a.toString(), r.serialize()) }
  async getSession(a) { const b = this.m.get(a.toString()); return b ? S.SessionRecord.deserialize(b) : null }
  async getExistingSessions(as) { return as.map(a => S.SessionRecord.deserialize(this.m.get(a.toString()))) }
}
class Identitas extends S.IdentityKeyStore {
  m = new Map()
  constructor(kunci, regId) { super(); this.kunci = kunci; this.regId = regId }
  async getIdentityKey() { return this.kunci }
  async getLocalRegistrationId() { return this.regId }
  async saveIdentity(a, k) {
    const lama = this.m.get(a.toString())
    this.m.set(a.toString(), k)
    return lama && !lama.equals(k) ? S.IdentityChange.ReplacedExisting : S.IdentityChange.NewOrUnchanged
  }
  async isTrustedIdentity() { return true } // v1: percaya pada penggunaan pertama (TOFU)
  async getIdentity(a) { return this.m.get(a.toString()) ?? null }
}
class PreKey extends S.PreKeyStore {
  m = new Map()
  async savePreKey(id, r) { this.m.set(id, r.serialize()) }
  async getPreKey(id) { return S.PreKeyRecord.deserialize(this.m.get(id)) }
  async removePreKey(id) { this.m.delete(id) }
}
class SignedPreKey extends S.SignedPreKeyStore {
  m = new Map()
  async saveSignedPreKey(id, r) { this.m.set(id, r.serialize()) }
  async getSignedPreKey(id) { return S.SignedPreKeyRecord.deserialize(this.m.get(id)) }
}
class KyberPreKey extends S.KyberPreKeyStore {
  m = new Map()
  dipakai = new Set()
  async saveKyberPreKey(id, r) { this.m.set(id, r.serialize()) }
  async getKyberPreKey(id) { return S.KyberPreKeyRecord.deserialize(this.m.get(id)) }
  async markKyberPreKeyUsed(id) { this.dipakai.add(id) }
}
class SenderKey extends S.SenderKeyStore {
  m = new Map()
  k = (a, d) => `${a}|${d}`
  async saveSenderKey(a, d, r) { this.m.set(this.k(a, d), r.serialize()) }
  async getSenderKey(a, d) { const b = this.m.get(this.k(a, d)); return b ? S.SenderKeyRecord.deserialize(b) : null }
}

export class Klien {
  constructor(nama) {
    this.nama = nama
    this.deviceId = 1
    this.addr = S.ProtocolAddress.new(nama, 1)
    this.regId = Math.floor(Math.random() * 16380) + 1
    this.kunci = S.PrivateKey.generate()
    this.sesi = new Sesi()
    this.identitas = new Identitas(this.kunci, this.regId)
    this.preKey = new PreKey()
    this.signedPreKey = new SignedPreKey()
    this.kyber = new KyberPreKey()
    this.senderKey = new SenderKey()
  }
  /** Bangkitkan prekey dan kembalikan paket publik untuk diunggah ke server. */
  async daftar(jumlahOtp = 5) {
    const idPub = this.kunci.getPublicKey()
    const spk = S.PrivateKey.generate()
    const spkSig = this.kunci.sign(spk.getPublicKey().serialize())
    await this.signedPreKey.saveSignedPreKey(1, S.SignedPreKeyRecord.new(1, Date.now(), spk.getPublicKey(), spk, spkSig))
    const kyber = S.KEMKeyPair.generate()
    const kyberSig = this.kunci.sign(kyber.getPublicKey().serialize())
    await this.kyber.saveKyberPreKey(1, S.KyberPreKeyRecord.new(1, Date.now(), kyber, kyberSig))
    const otp = []
    for (let i = 1; i <= jumlahOtp; i++) {
      const k = S.PrivateKey.generate()
      await this.preKey.savePreKey(i, S.PreKeyRecord.new(i, k.getPublicKey(), k))
      otp.push({ id: i, pub: k.getPublicKey().serialize() })
    }
    return {
      nama: this.nama, deviceId: this.deviceId, regId: this.regId,
      identitas: idPub.serialize(),
      signedPreKey: { id: 1, pub: spk.getPublicKey().serialize(), sig: spkSig },
      kyber: { id: 1, pub: kyber.getPublicKey().serialize(), sig: kyberSig },
      oneTime: otp,
    }
  }
  /** Mulai sesi dengan lawan bicara dari paket prekey yang diambil dari server. */
  async mulaiSesi(p) {
    const ot = p.oneTime
    const b = S.PreKeyBundle.new(
      p.regId, p.deviceId,
      ot ? ot.id : null, ot ? S.PublicKey.deserialize(ot.pub) : null,
      p.signedPreKey.id, S.PublicKey.deserialize(p.signedPreKey.pub), p.signedPreKey.sig,
      S.PublicKey.deserialize(p.identitas),
      p.kyber.id, S.KEMPublicKey.deserialize(p.kyber.pub), p.kyber.sig,
    )
    await S.processPreKeyBundle(b, S.ProtocolAddress.new(p.nama, p.deviceId), this.addr, this.sesi, this.identitas)
  }
  async enkripsi(untuk, teks) {
    const a = S.ProtocolAddress.new(untuk, 1)
    const c = await S.signalEncrypt(Buffer.from(teks, 'utf8'), a, this.addr, this.sesi, this.identitas)
    return { jenis: c.type(), isi: c.serialize() }
  }
  async dekripsi(dari, { jenis, isi }) {
    const a = S.ProtocolAddress.new(dari, 1)
    const out = jenis === S.CiphertextMessageType.PreKey
      ? await S.signalDecryptPreKey(S.PreKeySignalMessage.deserialize(isi), a, this.addr, this.sesi, this.identitas, this.preKey, this.signedPreKey, this.kyber)
      : await S.signalDecrypt(S.SignalMessage.deserialize(isi), a, this.addr, this.sesi, this.identitas)
    return Buffer.from(out).toString('utf8')
  }
  // --- Grup (Sender Keys) ---
  async buatKunciGrup(idGrup) {
    const d = await S.SenderKeyDistributionMessage.create(this.addr, idGrup, this.senderKey)
    return d.serialize()
  }
  async terimaKunciGrup(dari, bytes) {
    await S.processSenderKeyDistributionMessage(S.ProtocolAddress.new(dari, 1), S.SenderKeyDistributionMessage.deserialize(bytes), this.senderKey)
  }
  async enkripsiGrup(idGrup, teks) {
    const c = await S.groupEncrypt(this.addr, idGrup, this.senderKey, Buffer.from(teks, 'utf8'))
    return c.serialize()
  }
  async dekripsiGrup(dari, bytes) {
    return Buffer.from(await S.groupDecrypt(S.ProtocolAddress.new(dari, 1), this.senderKey, bytes)).toString('utf8')
  }
}
