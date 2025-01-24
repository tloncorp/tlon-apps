import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { schema } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Form, ScreenHeader, View, triggerHaptic } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';

type GroupPrivacy = schema.GroupPrivacy;

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'Privacy'>;

const privacyOptions = [
  {
    title: 'Public',
    value: 'public',
    description: 'Everyone can find and join',
  },
  {
    title: 'Private',
    value: 'private',
    description: 'New members require approval',
  },
  {
    title: 'Secret',
    value: 'secret',
    description: 'Invite-only',
  },
];

export function GroupPrivacyScreen(props: Props) {
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
    <View backgroundColor={'$secondaryBackground'} flex={1}>
      <ScreenHeader
        title="Group privacy"
        backAction={props.navigation.goBack}
      />
      <Form.FormFrame backgroundType="secondary">
        {group ? (
          <Form.RadioInput
            options={privacyOptions}
            value={group.privacy}
            onChange={handlePrivacyChange}
          />
        ) : null}
      </Form.FormFrame>
    </View>
  );
}
