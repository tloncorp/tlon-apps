import { useCallback, useEffect, useState } from 'react';
import { View, YStack, isWeb } from 'tamagui';

import { triggerHaptic } from '../utils';
import { ActionSheet } from './ActionSheet';
import { ContactBook } from './ContactBook';
import { IconType } from './Icon';
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
      <ActionSheet.SimpleHeader title="Start a chat"></ActionSheet.SimpleHeader>
      <YStack flex={1} paddingHorizontal="$2xl">
        <ContactBook
          searchable
          searchPlaceholder="Username or ID"
          onSelect={onSelect}
          onScrollChange={setScreenScrolling}
          key={screenKey}
          quickActions={
            <View paddingBottom="$l">
              <QuickAction
                onPress={navigateToCreateGroup}
                icon="Bang"
                title="Create group"
                subtitle="Create a new group chat"
              />
              <QuickAction
                onPress={navigateToFindGroups}
                icon="Search"
                title="Find groups"
                subtitle="Search for users who host groups"
              />
            </View>
          }
        />
      </YStack>
    </ActionSheet>
  );
}

function QuickAction({
  onPress,
  icon,
  title,
  subtitle,
}: {
  onPress: () => void;
  icon: IconType;
  title: string;
  subtitle?: string;
}) {
  return (
    <ListItem onPress={onPress}>
      <ListItem.SystemIcon
        icon={icon}
        backgroundColor={'$secondaryBackground'}
        rounded
      />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
        <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
      </ListItem.MainContent>
    </ListItem>
  );
}
