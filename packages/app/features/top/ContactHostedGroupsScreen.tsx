import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import {
  GenericHeader,
  GroupPreviewAction,
  GroupPreviewSheet,
  ViewUserGroupsWidget,
  useContactName,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { View } from 'tamagui';

import { useGroupActions } from '../../hooks/useGroupActions';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactHostedGroups'>;

export function ContactHostedGroupsScreen({ route, navigation }: Props) {
  const contactId = route.params.contactId;
  const contactName = useContactName(contactId);
  const { performGroupAction } = useGroupActions();
  const [groupForPreview, setGroupForPreview] = useState<db.Group | null>(null);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const onSelectGroup = useCallback(
    (group: db.Group) => {
      setGroupForPreview(group);
    },
    [setGroupForPreview]
  );

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      performGroupAction(action, group);
      setGroupForPreview(null);
    },
    [performGroupAction]
  );

  return (
    <View flex={1}>
      <GenericHeader
        title={`Groups hosted by ${contactName}`}
        goBack={goBack}
      />
      <ViewUserGroupsWidget userId={contactId} onSelectGroup={onSelectGroup} />
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
