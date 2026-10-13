import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { schema } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { triggerHaptic, useIsWindowNarrow } from '../../ui';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

type GroupPrivacy = schema.GroupPrivacy;

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'Privacy'>;

const privacyOptions: {
  title: string;
  value: GroupPrivacy;
  description: string;
}[] = [
  {
    title: 'Public',
    value: 'public',
    description: 'Anyone can join this workspace without needing an invite.',
  },
  {
    title: 'Private',
    value: 'private',
    description: 'Users must be invited to join this workspace.',
  },
  {
    title: 'Secret',
    value: 'secret',
    description:
      'Membership is invite only and private. Only administrators can invite new members.',
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

  const isWindowNarrow = useIsWindowNarrow();

  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'privacy',
        rows: privacyOptions.map((option) => ({
          key: option.value,
          title: option.title,
          subtitle: option.description,
          selected: group?.privacy === option.value,
          onPress: () => handlePrivacyChange(option.value),
          testID: `GroupPrivacyOption-${option.value}`,
        })),
      },
    ],
    [group?.privacy, handlePrivacyChange]
  );

  return (
    <SettingsListScreenView
      title="Group privacy"
      sections={sections}
      loading={!group}
      onBackPressed={handleGoBack}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      useHorizontalTitleLayout={!isWindowNarrow}
    />
  );
}
