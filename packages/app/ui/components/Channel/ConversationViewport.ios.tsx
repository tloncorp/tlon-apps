import { requireNativeViewManager } from 'expo-modules-core';
import { PropsWithChildren } from 'react';
import { StyleSheet, ViewProps } from 'react-native';

const NativeConversationViewport = requireNativeViewManager<
  ViewProps & { anchorToEnd: boolean; newestRowKey: string | null }
>('TlonScrollEdgeEffect', 'ConversationViewport');

export function ConversationViewport({
  children,
  anchorToEnd,
  newestRowKey,
}: PropsWithChildren<{ anchorToEnd: boolean; newestRowKey: string | null }>) {
  return (
    <NativeConversationViewport
      style={styles.viewport}
      anchorToEnd={anchorToEnd}
      newestRowKey={newestRowKey}
    >
      {children}
    </NativeConversationViewport>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, minWidth: 0 },
});
