// Modules kept eager (excluded from inlineRequires). Setting
// transformer.nonInlinedRequires replaces Metro's default list outright
// (transformHelpers.js uses `transform.nonInlinedRequires || baseIgnoredInlineRequires`),
// so the react/react-native defaults are spelled out here and merged with ours.
// Matching is by the require specifier as written, not resolved paths.
module.exports = [
  // Metro's baseIgnoredInlineRequires.
  'React',
  'react',
  'react/jsx-dev-runtime',
  'react/jsx-runtime',
  'react-compiler-runtime',
  'react-native',
  // Keeps App.main's module body eager so the iOS SplashScreen.preventAutoHideAsync()
  // bootstrap runs at boot instead of after first render. App.main's own imports
  // stay inlined, so the deferred screen tree is unaffected.
  './src/App',
  // Boot/first-render runtimes whose init must not be deferred.
  'expo-splash-screen',
  'react-native-reanimated',
  'react-native-gesture-handler',
  // Ubiquitous modules that render on the cold-start-to-login path anyway
  // (root providers, navigator, login bottom sheet, DB init). Inlining them
  // only scatters require() calls without deferring real work.
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
