import { TlonText } from '@tloncorp/ui';
import { useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { View, YStack } from 'tamagui';

interface LongPressDisclosureProps {
  text: string;
  /** Component to render as the truncated text */
  children: React.ReactNode;
}

export function LongPressDisclosure({
  text,
  children,
}: LongPressDisclosureProps) {
  const [showFullText, setShowFullText] = useState(false);

  return (
    <>
      <Pressable onLongPress={() => setShowFullText(true)}>
        {children}
      </Pressable>

      <Modal
        visible={showFullText}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullText(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setShowFullText(false)}>
          <View
            flex={1}
            backgroundColor="$darkOverlay"
            justifyContent="center"
            alignItems="center"
            padding="$2xl"
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <YStack
                backgroundColor="$secondaryBackground"
                borderRadius="$xl"
                padding="$2xl"
                maxWidth={500}
                gap="$m"
                borderWidth={1}
                borderColor="$border"
              >
                <TlonText.Text size="$body" color="$primaryText">
                  {text}
                </TlonText.Text>
              </YStack>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
