import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Spinner } from 'tamagui';

export function BotRestartAvatar({
  children,
  restarting,
}: {
  children: ReactNode;
  restarting: boolean;
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
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 16,
        }}
        testID="BotRestartSpinner"
      >
        <Spinner size="small" color="white" />
      </View>
    </View>
  );
}
