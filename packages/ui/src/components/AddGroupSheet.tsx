import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { triggerHaptic } from '../utils';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { ContactBook } from './ContactBook';
import { LoadingSpinner } from './LoadingSpinner';

export function AddGroupSheet({
  open,
  onOpenChange,
  onGoToDm,
  type,
  navigateToFindGroups,
  navigateToCreateGroup,
  navigateToChannel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'dm' | 'group';
  onGoToDm: (userId: string) => void;
  navigateToFindGroups: () => void;
  navigateToCreateGroup: () => void;
  navigateToChannel: (channel: db.Channel) => void;
}) {
  const [screenScrolling, setScreenScrolling] = useState(false);
  const [screenKey, setScreenKey] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);

  const dismiss = useCallback(() => {
    onOpenChange(false);
    // used for resetting components nested within screens after
    // reopening
    setTimeout(() => {
      setScreenKey((key) => key + 1);
    }, 300);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      triggerHaptic('sheetOpen');
    }
  }, [open]);

  const onSelect = useCallback(
    (contactId: string) => {
      console.log('sedelecting', contactId);
      onGoToDm(contactId);
    },
    [onGoToDm]
  );

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const handlePressCreateGroup = useCallback(async () => {
    setIsCreating(true);
    const { group, channel } = await store.createGroup({
      title: '',
    });
    if (selectedContactIds.length > 0) {
      await store.inviteGroupMembers({
        groupId: group.id,
        contactIds: selectedContactIds,
      });
    }
    navigateToChannel(channel);
    onOpenChange(false);
  }, [navigateToChannel, onOpenChange, selectedContactIds]);

  const insets = useSafeAreaInsets();

  return (
    <ActionSheet
      disableDrag={screenScrolling}
      moveOnKeyboardChange
      open={open}
      onOpenChange={dismiss}
      snapPoints={[90]}
      snapPointsMode="percent"
    >
      <ActionSheet.SimpleHeader
        title={type === 'dm' ? 'New chat' : 'New group'}
      />
      <YStack flex={1} paddingHorizontal="$2xl">
        <ContactBook
          searchable
          multiSelect={type === 'group'}
          searchPlaceholder="Filter by nickname or id"
          onSelect={onSelect}
          onSelectedChange={setSelectedContactIds}
          onScrollChange={setScreenScrolling}
          key={screenKey}
        />
        {type === 'group' && (
          <Button
            position="absolute"
            bottom={insets.bottom}
            left={'$xl'}
            right={'$xl'}
            hero
            shadow
            onPress={handlePressCreateGroup}
          >
            {!isCreating ? (
              <Button.Text>Create group</Button.Text>
            ) : (
              <View width={30} paddingHorizontal="$2xl">
                <LoadingSpinner color="$background" />
              </View>
            )}
          </Button>
        )}
      </YStack>
    </ActionSheet>
  );
}
