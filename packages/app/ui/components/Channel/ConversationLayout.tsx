import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

const DockedConversationContext = createContext(false);

export function useIsConversationDocked() {
  return useContext(DockedConversationContext);
}

/** The list and composer share the available space above the keyboard. */
export function ConversationLayout({
  children,
  enabled,
  bottomInset,
}: PropsWithChildren<{ enabled: boolean; bottomInset?: number }>) {
  const insets = useSafeAreaInsets();
  const docked = enabled && Platform.OS !== 'web';

  return (
    <DockedConversationContext.Provider value={docked}>
      {docked ? (
        <KeyboardAvoidingView
          behavior="padding"
          automaticOffset
          // The composer keeps this padding, including while the keyboard is
          // open. Let it extend below the keyboard edge by the same amount.
          keyboardVerticalOffset={-insets.bottom}
          style={styles.container}
        >
          {children}
        </KeyboardAvoidingView>
      ) : (
        <YStack flex={1} minWidth={0} paddingBottom={bottomInset}>
          {children}
        </YStack>
      )}
    </DockedConversationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0 },
});
