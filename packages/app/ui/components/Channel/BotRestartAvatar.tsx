import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Spinner } from 'tamagui';

export function BotRestartAvatar({
  children,
  restarting,
  size = 'small',
}: {
  children: ReactNode;
  restarting: boolean;
  size?: 'small' | 'large';
}) {
  if (!restarting) return children;

  return (
    <View style={{ position: 'relative' }}>
      {children}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          borderRadius: size === 'large' ? 16 : 4,
        }}
        testID="BotRestartSpinner"
      >
        <Spinner size={size} color="white" />
      </View>
    </View>
  );
}
