import React from 'react';
import { SafeAreaView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider>
    <SafeAreaView>{children}</SafeAreaView>
  </SafeAreaProvider>
);
