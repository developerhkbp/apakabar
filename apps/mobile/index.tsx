import { registerRootComponent } from 'expo'
import { View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import App from './App'

// Android modern menggambar aplikasi sampai ke bawah layar (edge-to-edge), sehingga tombol navigasi
// bawaan menutupi menu paling bawah. Sisihkan ruang di bawah/samping untuk bilah navigasi di satu tempat ini.
function Dasar() {
  const { bottom, left, right } = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingBottom: bottom, paddingLeft: left, paddingRight: right }}>
      <App />
    </View>
  )
}

registerRootComponent(() => (
  <SafeAreaProvider>
    <Dasar />
  </SafeAreaProvider>
))
