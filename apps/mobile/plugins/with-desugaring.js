// libsignal-android memerlukan core library desugaring di modul :app.
const { withAppBuildGradle } = require('expo/config-plugins')

module.exports = function withDesugaring(config) {
  return withAppBuildGradle(config, cfg => {
    let g = cfg.modResults.contents
    if (!g.includes('coreLibraryDesugaringEnabled')) {
      g = g.replace(/android\s*\{/, 'android {\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n    }')
    }
    if (!g.includes('desugar_jdk_libs')) {
      g = g.replace(/dependencies\s*\{/, "dependencies {\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'")
    }
    cfg.modResults.contents = g
    return cfg
  })
}
