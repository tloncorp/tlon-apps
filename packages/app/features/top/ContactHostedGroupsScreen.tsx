import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  GroupPreviewAction,
  GroupPreviewSheet,
  ScreenHeader,
  ViewUserGroupsWidget,
  useContactName,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { View } from 'tamagui';

import { useGroupActions } from '../../hooks/useGroupActions';

export function ContactHostedGroupsScreen({
  contactId,
  goBack,
}: {
  contactId: string;
  goBack: () => void;
}) {
  const contactName = useContactName(contactId);
  const { performGroupAction } = useGroupActions();
  const [groupForPreview, setGroupForPreview] = useState<db.Group | null>(null);

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
      <ScreenHeader
        title={`Groups hosted by ${contactName}`}
        backAction={goBack}
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
