import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGroupContext } from '@tloncorp/app/hooks/useGroupContext';
import { GroupPrivacy } from '@tloncorp/shared/dist/db/schema';
import * as store from '@tloncorp/shared/dist/store';
import {
  GenericHeader,
  GroupPrivacySelector,
  View,
  triggerHaptic,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { GroupSettingsStackParamList } from '../../types';

type InvitesAndPrivacyScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'Privacy'
>;

export function GroupPrivacyScreen(props: InvitesAndPrivacyScreenProps) {
  const { groupId } = props.route.params;

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
      <GenericHeader title="Privacy" goBack={props.navigation.goBack} />
      {group ? (
        <GroupPrivacySelector
          currentValue={group.privacy ?? 'private'}
          onChange={handlePrivacyChange}
        />
      ) : null}
    </View>
  );
}
