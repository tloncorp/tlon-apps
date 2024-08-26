import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupPrivacy } from '@tloncorp/shared/dist/db/schema';
import * as store from '@tloncorp/shared/dist/store';
import { GenericHeader, GroupPrivacySelector, View } from '@tloncorp/ui';
import { useGroupContext } from 'packages/app/hooks/useGroupContext';
import { useCallback } from 'react';

import { GroupSettingsStackParamList } from '../../types';

type InvitesAndPrivacyScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'InvitesAndPrivacy'
>;

export function InvitesAndPrivacyScreen(props: InvitesAndPrivacyScreenProps) {
  const { groupId } = props.route.params;

  const { group } = useGroupContext({ groupId });

  const handlePrivacyChange = useCallback(
    (newPrivacy: GroupPrivacy) => {
      if (group && group.privacy !== newPrivacy) {
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
