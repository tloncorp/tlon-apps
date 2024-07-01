import { ImageBackground } from 'expo-image';
import { PropsWithChildren } from 'react';

import { View } from '../core';

export default function ProfileCover({
  uri,
  children,
}: PropsWithChildren<{ uri: string }>) {
  return (
    <View borderRadius="$2xl" overflow="hidden">
      <ImageBackground
        source={{ uri, height: 1000, width: 1000 }}
        resizeMode="cover"
      >
        {children}
      </ImageBackground>
    </View>
  );
}
