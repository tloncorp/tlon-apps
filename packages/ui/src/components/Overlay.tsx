import { BlurTint, BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { View, useTheme } from 'tamagui';

export function Overlay(props: ComponentProps<typeof View>) {
  return (
    <MotiView
      style={{ flex: 1 }}
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        opacity: {
          type: 'timing',
          duration: 200,
        },
      }}
    >
      {Platform.OS === 'android' ? (
        <OverlayDisplayAndroid {...props} />
      ) : (
        <OverlayDisplayIos {...props} />
      )}
    </MotiView>
  );
}

function OverlayDisplayAndroid(props: ComponentProps<typeof View>) {
  return (
    <View
      flex={1}
      opacity={0.4}
      backgroundColor="$overlayBackground"
      {...props}
    ></View>
  );
}

function OverlayDisplayIos(props: ComponentProps<typeof View>) {
  const theme = useTheme();
  return (
    <View flex={1} {...props}>
      <BlurView
        style={{ flex: 1 }}
        intensity={30}
        tint={theme.overlayBlurTint.val as BlurTint}
      />
    </View>
  );
}
