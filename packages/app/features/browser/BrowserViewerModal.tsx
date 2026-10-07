import { Button, Text } from '@tloncorp/ui';
import { Modal } from 'react-native';
import { YStack } from 'tamagui';

export type BrowserViewerModalProps = {
  viewerUrl: string;
  onClose: () => void;
};

// The service does not yet allow desktop iframe embedding. Keep the user in
// the app rather than handing a signed session link to an external browser.
export function BrowserViewerModal({ onClose }: BrowserViewerModalProps) {
  return (
    <Modal transparent visible onRequestClose={onClose}>
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
      >
        <YStack padding="$xl" gap="$l" maxWidth={400}>
          <Text fontSize={20}>Browser session</Text>
          <Text>
            Open this card in the Tlon Messenger mobile app to use the browser.
          </Text>
          <Button label="Close" onPress={onClose} />
        </YStack>
      </YStack>
    </Modal>
  );
}
