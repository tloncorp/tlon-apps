import { exec } from 'child_process';
import { defineConfig } from 'tsup';

export default defineConfig({
  entryPoints: [
    'src/index.ts',
    'src/urbit/*',
    'src/client/index.ts',
    'src/db/index.ts',
    'src/hooks/index.ts',
    'src/db/migrations/index.ts',
    'src/api/index.ts',
    'src/logic/index.ts',
    'src/store/index.ts',
  ],
  format: ['esm'],
  minify: false,
  external: [
    'react',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'expo-image-manipulator',
    'expo-image-picker',
    'expo-file-system',
    '@react-native-firebase/crashlytics',
    '@shopify/react-native-skia',
    '@react-navigation/native',
    '@react-navigation/native-stack',
  ],
  ignoreWatch: ['**/node_modules/**', '**/.git/**'],
  loader: {
    '.sql': 'text',
  },
  onSuccess() {
    return new Promise((resolve, reject) => {
      exec('pnpm types', (err) => {
        err ? reject(err) : resolve();
      });
    });
  },
});
