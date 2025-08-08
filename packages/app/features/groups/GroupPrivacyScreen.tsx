import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { schema } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { Form, ScreenHeader, View, triggerHaptic } from '../../ui';

type GroupPrivacy = schema.GroupPrivacy;

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'Privacy'>;

const privacyOptions = [
  {
    title: 'Public',
    value: 'public',
    description: 'Anyone can join this group without needing an invite.',
  },
  {
    title: 'Private',
    value: 'private',
    description: 'Users must be invited to join this group.',
  },
  {
    title: 'Secret',
    value: 'secret',
    description: 'Membership is invite only and private.',
  },
];

export function GroupPrivacyScreen(props: Props) {
  const { groupId, fromChatDetails } = props.route.params;
  const { navigation } = props;
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

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  return (
    <View backgroundColor={'$secondaryBackground'} flex={1}>
      <ScreenHeader title="Group privacy" backAction={handleGoBack} />
      <Form.FormFrame backgroundType="secondary">
        {group ? (
          <Form.RadioInput
            options={privacyOptions}
            value={group.privacy}
            onChange={handlePrivacyChange}
            testID="GroupPrivacyScreen-RadioInput"
          />
        ) : null}
      </Form.FormFrame>
    </View>
  );
}
