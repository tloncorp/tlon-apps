import { Button, Text } from '@tloncorp/ui';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, View, YStack } from 'tamagui';

import type { BrowserViewerModalProps } from './BrowserViewerModal.types';
import {
  BrowserViewer,
  type BrowserViewerHandle,
} from './BrowserViewer.native';
import { BrowserControlButton } from './BrowserViewerControls.native';

export function BrowserViewerModal({
  viewerUrl,
  onClose,
}: BrowserViewerModalProps) {
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const viewer = useRef<BrowserViewerHandle>(null);
  const closing = useRef(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    setCloseBusy(true);
    const ok = await (viewer.current?.close() ?? Promise.resolve(true));
    closing.current = false;
    setCloseBusy(false);
    if (ok) onClose();
    else
      Alert.alert(
        'Could not hand back browser control',
        'Please try closing again. The browser is still open.'
      );
  };
  const reload = () => {
    setFailed(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  };
  const content = (
    <YStack
      width="100%"
      height="100%"
      backgroundColor="#0b0b0b"
      overflow="hidden"
    >
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View flex={1} minHeight={0}>
          {failed ? (
            <YStack
              flex={1}
              backgroundColor="$background"
              alignItems="center"
              justifyContent="center"
              padding="$xl"
              gap="$l"
            >
              <Text textAlign="center">
                Could not load the live browser. Try reloading, or ask your bot
                to share a fresh session if this one has expired.
              </Text>
              <Button preset="secondary" label="Try again" onPress={reload} />
            </YStack>
          ) : (
            <>
              <BrowserViewer
                ref={viewer}
                key={attempt}
                viewerUrl={viewerUrl}
                bottomInset={insets.bottom}
                topInset={insets.top}
                rightInset={insets.right}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
              {loading ? (
                <YStack
                  pointerEvents="none"
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$background"
                  gap="$m"
                >
                  <Spinner />
                  <Text>Loading live browser…</Text>
                </YStack>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <View position="absolute" top={insets.top + 12} left={insets.left + 12}>
        <BrowserControlButton
          icon="Close"
          accessibilityLabel="Close browser"
          onPress={close}
          disabled={closeBusy}
        />
      </View>
    </YStack>
  );

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={close}
    >
      {content}
    </Modal>
  );
}
