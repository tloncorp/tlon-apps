import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import {
  AppDataContextProvider,
  useContacts,
  useCurrentUserId,
} from '../contexts';
import { ViewUserGroupsWidget } from './AddChats';
import { ContactBook } from './ContactBook';
import { GroupPreviewAction, GroupPreviewSheet } from './GroupPreviewSheet';
import { Icon } from './Icon';

const GroupJoinExplanation = () => (
  <YStack height="80%" justifyContent="center" alignItems="center" gap="$m">
    <Text>On Tlon, people host groups.</Text>
    <Text>Look for groups hosted by people above.</Text>
  </YStack>
);

type screens = 'FindGroups' | 'ViewGroupsByContact';

export function FindGroupsView({
  onCancel,
  onGroupAction,
}: {
  onCancel: () => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
}) {
  const { top } = useSafeAreaInsets();
  const contacts = useContacts();
  const currentUserId = useCurrentUserId();
  const [screen, setScreen] = useState<screens>('FindGroups');
  const [viewGroupsForContact, setViewGroupsForContact] = useState<
    string | null
  >(null);
  const [groupForPreview, setGroupForPreview] = useState<db.Group | null>(null);

  const onSelectGroup = useCallback(
    (group: db.Group) => {
      setGroupForPreview(group);
    },
    [setGroupForPreview]
  );

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      onGroupAction(action, group);
      setGroupForPreview(null);
    },
    [onGroupAction]
  );

  return (
    <View flex={1} paddingHorizontal="$xl" paddingTop={top}>
      {screen === 'FindGroups' ? (
        <AppDataContextProvider
          contacts={contacts ?? null}
          currentUserId={currentUserId}
        >
          <ContactBook
            searchable
            searchPlaceholder="Search by nickname, @p"
            onSelect={(contact) => {
              setViewGroupsForContact(contact);
              setScreen('ViewGroupsByContact');
            }}
            showCancelButton
            onPressCancel={onCancel}
            explanationComponent={<GroupJoinExplanation />}
          />
        </AppDataContextProvider>
      ) : (
        <>
          <XStack justifyContent="flex-start">
            <Icon type="ChevronLeft" onPress={() => setScreen('FindGroups')} />
          </XStack>
          <ViewUserGroupsWidget
            userId={viewGroupsForContact ?? ''}
            onSelectGroup={onSelectGroup}
          />
        </>
      )}
      <GroupPreviewSheet
        open={!!groupForPreview}
        onOpenChange={(open) => {
          if (!open) {
            setGroupForPreview(null);
          }
        }}
        onActionComplete={handleGroupAction}
        group={groupForPreview ?? undefined}
      />
    </View>
  );
}
