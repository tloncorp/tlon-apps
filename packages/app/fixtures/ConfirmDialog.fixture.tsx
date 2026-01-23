import { Button, ConfirmDialog, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { useSelect } from 'react-cosmos/client';
import { YStack } from 'tamagui';

import { FixtureWrapper } from './FixtureWrapper';

export default function ConfirmDialogFixture() {
  const [open, setOpen] = useState(false);
  const [destructive] = useSelect('Destructive', {
    defaultValue: 'no',
    options: ['yes', 'no'],
  });
  const isDestructive = destructive === 'yes';

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
          confirmText={isDestructive ? 'Delete' : 'Confirm'}
          cancelText="Cancel"
          destructive={isDestructive}
          onConfirm={() => {
            console.log('Confirmed!');
          }}
        />
      </YStack>
    </FixtureWrapper>
  );
}
