// Modules kept eager (excluded from inlineRequires). This replaces Metro's
// default list rather than merging, so its react/react-native defaults are
// re-listed. Matched against the require specifier as written, not resolved paths.
module.exports = [
  // Metro's baseIgnoredInlineRequires.
  'React',
  'react',
  'react/jsx-dev-runtime',
  'react/jsx-runtime',
  'react-compiler-runtime',
  'react-native',
  // Runs App.main's iOS SplashScreen.preventAutoHideAsync() at boot. App.main's
  // own imports stay inlined, so the deferred screen tree is unaffected.
  './src/App',
  // Boot/first-render runtimes whose init must not be deferred.
  'expo-splash-screen',
  'react-native-reanimated',
  'react-native-gesture-handler',
  // Ubiquitous modules on the cold-start-to-login path (root providers,
  // navigator, login bottom sheet, DB init); inlining them only scatters
  // require() calls without deferring real work.
  'tamagui',
  '@react-navigation/native',
  '@react-navigation/native-stack',
  'react-native-safe-area-context',
  '@tanstack/react-query',
  '@gorhom/bottom-sheet',
  'drizzle-orm',
  'lodash',
  'zustand',
];
