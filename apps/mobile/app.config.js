// Menimpa app.json. google-services.json tidak masuk git, jadi build EAS membacanya dari
// variabel lingkungan berjenis file GOOGLE_SERVICES_JSON (eas env:create ... --type file).
// Build lokal memakai berkas ./google-services.json bila variabel itu tidak ada.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
})
