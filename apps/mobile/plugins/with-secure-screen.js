// Melarang tangkapan layar (FLAG_SECURE) agar tetap terpasang setelah `expo prebuild`.
const { withMainActivity } = require('expo/config-plugins')

module.exports = function withSecureScreen(config) {
  return withMainActivity(config, cfg => {
    let g = cfg.modResults.contents
    if (!g.includes('FLAG_SECURE')) {
      g = g.replace(/import android\.os\.Bundle/, 'import android.os.Bundle\nimport android.view.WindowManager')
      g = g.replace(/super\.onCreate\(null\)/, 'super.onCreate(null)\n    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)')
    }
    cfg.modResults.contents = g
    return cfg
  })
}
