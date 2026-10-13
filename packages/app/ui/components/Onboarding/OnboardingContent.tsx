import { PropsWithChildren } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { YStack, styled } from 'tamagui';

// Short screens need scrolling as well as keyboard clearance. Keep the native
// header outside this container and let the controller track the focused field.
export function OnboardingKeyboardScrollView({ children }: PropsWithChildren) {
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

export const OnboardingTextBlock = styled(YStack, {
  padding: '$xl',
  gap: '$3xl',
});
