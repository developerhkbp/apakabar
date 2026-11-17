// Build rilis memakai R8 (minify). libsignal memanggil kelas Java/Kotlin-nya dari kode native (Rust/JNI)
// lewat nama, sehingga R8 bisa menghapus/mengganti namanya dan enkripsi gagal hanya di APK rilis.
// Aturan keep ini menjaga kelas libsignal dan modul native kita.
const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const ATURAN = `
# --- ApaKabaR: libsignal dipanggil dari JNI, jangan diubah/dihapus R8 ---
-keep class org.signal.libsignal.** { *; }
-keepclasseswithmembernames class * { native <methods>; }
-keep class expo.modules.signalprotocol.** { *; }
-dontwarn org.signal.libsignal.**
`

module.exports = function withKeepSignal(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const f = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro')
      const isi = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''
      if (!isi.includes('org.signal.libsignal')) fs.writeFileSync(f, isi + ATURAN)
      return cfg
    },
  ])
}
