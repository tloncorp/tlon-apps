import { GroupPrivacy } from '@tloncorp/shared/dist/db/schema';
import * as store from '@tloncorp/shared/dist/store';
import {
  GroupPrivacySelector,
  ScreenHeader,
  View,
  triggerHaptic,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';

export function GroupPrivacyScreen({
  groupId,
  onGoBack,
}: {
  groupId: string;
  onGoBack: () => void;
}) {
  const { group } = useGroupContext({ groupId });

  const handlePrivacyChange = useCallback(
    (newPrivacy: GroupPrivacy) => {
      if (group && group.privacy !== newPrivacy) {
        triggerHaptic('baseButtonClick');
        store.updateGroupPrivacy(group, newPrivacy);
      }
    },
    [group]
  );

  return (
    <View>
      <ScreenHeader title="Privacy" backAction={onGoBack} />
      {group ? (
        <GroupPrivacySelector
          currentValue={group.privacy ?? 'private'}
          onChange={handlePrivacyChange}
        />
      ) : null}
    </View>
  );
}
