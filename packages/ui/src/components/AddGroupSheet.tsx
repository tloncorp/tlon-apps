import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import { useCallback, useEffect, useState } from 'react';
import { View, YStack, isWeb } from 'tamagui';

import { AppDataContextProvider, useContacts } from '../contexts';
import { triggerHaptic } from '../utils';
import { ActionSheet } from './ActionSheet';
import { ContactBook } from './ContactBook';
import { ListItem } from './ListItem';

export function AddGroupSheet({
  open,
  onOpenChange,
  onGoToDm,
  navigateToFindGroups,
  navigateToCreateGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoToDm: (userId: string) => void;
  navigateToFindGroups: () => void;
  navigateToCreateGroup: () => void;
}) {
  const [screenScrolling, setScreenScrolling] = useState(false);
  const [screenKey, setScreenKey] = useState<number>(0);
  const contacts = useContacts();

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
      onGoToDm(contactId);
    },
    [onGoToDm]
  );

  return (
    <ActionSheet
      disableDrag={screenScrolling}
      moveOnKeyboardChange
      open={open}
      onOpenChange={dismiss}
      snapPoints={[90]}
      snapPointsMode="percent"
    >
      <QueryClientProvider client={queryClient}>
        <AppDataContextProvider contacts={contacts ?? null}>
          <ActionSheet.Content flex={1}>
            <ActionSheet.ContentBlock
              flex={1}
              paddingHorizontal={isWeb ? '$2xl' : '$xl'}
            >
              <YStack flex={1} gap="$xl">
                <ActionSheet.ActionTitle textAlign="center">
                  New Message
                </ActionSheet.ActionTitle>
                <ContactBook
                  searchable
                  searchPlaceholder="Username or ID"
                  onSelect={onSelect}
                  onScrollChange={setScreenScrolling}
                  key={screenKey}
                  quickActions={
                    <View paddingVertical="$l">
                      <ListItem onPress={navigateToCreateGroup}>
                        <ListItem.SystemIcon
                          icon="Bang"
                          backgroundColor={'$secondaryBackground'}
                          rounded
                        />
                        <ListItem.MainContent>
                          <ListItem.Title>Create group</ListItem.Title>
                          <ListItem.Subtitle>
                            Create a new group chat
                          </ListItem.Subtitle>
                        </ListItem.MainContent>
                      </ListItem>
                      <ListItem onPress={navigateToFindGroups}>
                        <ListItem.SystemIcon
                          icon="Search"
                          backgroundColor={'$secondaryBackground'}
                          rounded
                        />
                        <ListItem.MainContent>
                          <ListItem.Title>Find groups</ListItem.Title>
                          <ListItem.Subtitle>
                            Search for users who host groups
                          </ListItem.Subtitle>
                        </ListItem.MainContent>
                      </ListItem>
                    </View>
                  }
                />
              </YStack>
            </ActionSheet.ContentBlock>
          </ActionSheet.Content>
        </AppDataContextProvider>
      </QueryClientProvider>
    </ActionSheet>
  );
}
