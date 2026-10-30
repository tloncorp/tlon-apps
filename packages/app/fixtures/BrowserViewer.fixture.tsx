import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { YStack } from 'tamagui';

import { BrowserViewerModal } from '../features/browser/BrowserViewerModal';
import { FixtureWrapper } from './FixtureWrapper';

export default function BrowserViewerFixture() {
  const [open, setOpen] = useState(false);
  return (
    <FixtureWrapper fillWidth fillHeight>
      <YStack padding="$xl" gap="$l">
        <Text>Browser handoff</Text>
        <Button label="Open live browser" onPress={() => setOpen(true)} />
      </YStack>
      {open ? (
        <BrowserViewerModal
          viewerUrl="https://browser-session.tlon.network/s/fixture.signature?clipboardBridge=true"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </FixtureWrapper>
  );
}
