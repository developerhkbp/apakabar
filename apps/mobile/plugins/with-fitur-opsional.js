// Menandai fitur perangkat sebagai opsional agar aplikasi tetap bisa dipasang di perangkat tanpa fitur itu.
// Mengunci orientasi portrait membuat Android menganggap android.hardware.screen.portrait wajib,
// dan izin RECORD_AUDIO membuat android.hardware.microphone wajib. Play Console menolak itu sebagai pembatas ketersediaan.
const { withAndroidManifest } = require('expo/config-plugins')

const FITUR = ['android.hardware.screen.portrait', 'android.hardware.microphone']

module.exports = function withFiturOpsional(config) {
  return withAndroidManifest(config, mod => {
    const m = mod.modResults.manifest
    const ada = (m['uses-feature'] ??= [])
    for (const nama of FITUR) {
      const f = ada.find(x => x.$['android:name'] === nama)
      if (f) f.$['android:required'] = 'false'
      else ada.push({ $: { 'android:name': nama, 'android:required': 'false' } })
    }
    return mod
  })
}
