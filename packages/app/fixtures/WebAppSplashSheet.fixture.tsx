import { Button } from '@tloncorp/ui';
import { useState } from 'react';
import { YStack } from 'tamagui';

import { WebAppSplashSheet, openTlonWebApp } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

function WebAppSplashSheetFixture() {
  const [open, setOpen] = useState(true);

  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Button label="Open Web App Splash" onPress={() => setOpen(true)} />
      </YStack>
      <WebAppSplashSheet
        open={open}
        onOpenChange={setOpen}
        onOpenWeb={() => {
          openTlonWebApp();
          setOpen(false);
        }}
      />
    </FixtureWrapper>
  );
}

export default {
  'Web App Splash Sheet': <WebAppSplashSheetFixture />,
};
