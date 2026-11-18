// Menjadikan ApaKabaR tujuan di menu "Bagikan" Android (teks, foto, video, dokumen) agar tetap terpasang setelah `expo prebuild`.
const { withAndroidManifest } = require('expo/config-plugins')

const TIPE = [
  { action: 'android.intent.action.SEND', mime: 'text/plain' },
  { action: 'android.intent.action.SEND', mime: 'image/*' },
  { action: 'android.intent.action.SEND', mime: 'video/*' },
  { action: 'android.intent.action.SEND', mime: 'application/*' },
  { action: 'android.intent.action.SEND_MULTIPLE', mime: 'image/*' },
  { action: 'android.intent.action.SEND_MULTIPLE', mime: 'video/*' },
  { action: 'android.intent.action.SEND_MULTIPLE', mime: 'application/*' },
]

module.exports = function withShareTarget(config) {
  return withAndroidManifest(config, cfg => {
    const app = cfg.modResults.manifest.application?.[0]
    const utama = app?.activity?.find(a => a.$['android:name'] === '.MainActivity')
    if (!utama) return cfg
    utama['intent-filter'] = utama['intent-filter'] ?? []
    for (const t of TIPE) {
      const ada = utama['intent-filter'].some(f =>
        f.action?.some(a => a.$['android:name'] === t.action) && f.data?.some(d => d.$['android:mimeType'] === t.mime))
      if (ada) continue
      utama['intent-filter'].push({
        action: [{ $: { 'android:name': t.action } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': t.mime } }],
      })
    }
    return cfg
  })
}
