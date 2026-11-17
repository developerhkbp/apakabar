// Membatasi arsitektur CPU di APK/AAB supaya ukurannya jauh lebih kecil.
// libsignal-android (Rust) dan React Native membawa library native per arsitektur; secara bawaan ada 4
// (armeabi-v7a, arm64-v8a, x86, x86_64) dan x86/x86_64 hanya dipakai emulator PC. Ponsel nyata memakai arm.
// Untuk emulator PC / semua arsitektur: set env APK_SEMUA_ABI=1 saat prebuild/build.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins')

const ABI = ['arm64-v8a', 'armeabi-v7a']

module.exports = function withAbi(config) {
  if (process.env.APK_SEMUA_ABI === '1') return config

  config = withGradleProperties(config, cfg => {
    const p = cfg.modResults.filter(x => !(x.type === 'property' && x.key === 'reactNativeArchitectures'))
    p.push({ type: 'property', key: 'reactNativeArchitectures', value: ABI.join(',') })
    cfg.modResults = p
    return cfg
  })

  return withAppBuildGradle(config, cfg => {
    let g = cfg.modResults.contents
    if (!g.includes('abiFilters')) {
      const filter = ABI.map(a => `"${a}"`).join(', ')
      g = g.replace(/defaultConfig\s*\{/, `defaultConfig {\n        ndk { abiFilters ${filter} }`)
    }
    cfg.modResults.contents = g
    return cfg
  })
}
