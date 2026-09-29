import { requireNativeViewManager } from 'expo-modules-core';
import { PropsWithChildren } from 'react';
import { StyleSheet, ViewProps } from 'react-native';

const NativeConversationViewport = requireNativeViewManager<
  ViewProps & { anchorToEnd: boolean }
>('TlonScrollEdgeEffect', 'ConversationViewport');

export function ConversationViewport({
  children,
  anchorToEnd,
}: PropsWithChildren<{ anchorToEnd: boolean }>) {
  return (
    <NativeConversationViewport
      style={styles.viewport}
      anchorToEnd={anchorToEnd}
    >
      {children}
    </NativeConversationViewport>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, minWidth: 0 },
});
