// Menyalin suara notifikasi HKBP (sama dengan superapp) ke res/raw agar tetap terpasang setelah `expo prebuild`.
const fs = require('fs')
const path = require('path')
const { withDangerousMod } = require('expo/config-plugins')

module.exports = function withSuaraNotifikasi(config) {
  return withDangerousMod(config, ['android', mod => {
    const tujuan = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw')
    fs.mkdirSync(tujuan, { recursive: true })
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'assets', 'sounds', 'notifikasi_hkbp.wav'), path.join(tujuan, 'notifikasi_hkbp.wav'))
    return mod
  }])
}
