import { Button, Text } from '@tloncorp/ui';
import { YStack } from 'tamagui';

import { useBrowserCredentialHandoff } from '../features/browser/BrowserCredentialHandoffContext';
import { BrowserCredentialHandoffProvider } from '../features/browser/BrowserCredentialHandoffProvider';
import { FixtureWrapper } from './FixtureWrapper';

function PreviewActions() {
  const { openForm } = useBrowserCredentialHandoff();
  return (
    <YStack padding="$xl" gap="$l">
      <Text>Credential sheet preview</Text>
      <Button
        label="Open secure form"
        onPress={() =>
          openForm('https://browser-session.tlon.network/s/fixture.signature')
        }
      />
    </YStack>
  );
}

export default function BrowserCredentialSheetFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <BrowserCredentialHandoffProvider>
        <PreviewActions />
      </BrowserCredentialHandoffProvider>
    </FixtureWrapper>
  );
}
