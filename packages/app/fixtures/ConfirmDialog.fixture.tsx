import { Button, ConfirmDialog, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { useSelect } from 'react-cosmos/client';
import { YStack } from 'tamagui';

import { FixtureWrapper } from './FixtureWrapper';

export default function ConfirmDialogFixture() {
  const [open, setOpen] = useState(false);
  const [destructive] = useSelect<boolean>('Destructive', {
    defaultValue: false,
    options: [true, false],
  });

  return (
    <FixtureWrapper fillWidth safeArea={false}>
      <YStack gap="$l" padding="$l" alignItems="flex-start">
        <Text size="$label/l" color="$secondaryText">
          ConfirmDialog
        </Text>
        <Text size="$body" color="$tertiaryText">
          On web, displays as a Tamagui Dialog. On mobile, uses native
          Alert.alert.
        </Text>

        <Button
          fill="solid"
          type="primary"
          label="Open Dialog"
          onPress={() => setOpen(true)}
        />

        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Confirm Action"
          description="Are you sure you want to proceed with this action? This is a sample confirmation dialog."
          confirmText={destructive ? 'Delete' : 'Confirm'}
          cancelText="Cancel"
          destructive={destructive}
          onConfirm={() => {
            console.log('Confirmed!');
          }}
        />
      </YStack>
    </FixtureWrapper>
  );
}
