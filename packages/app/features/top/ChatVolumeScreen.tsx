import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import {
  GroupSettingsStackParamList,
  RootStackParamList,
} from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  useChatOptions,
  useChatVolumeOptions,
  useIsWindowNarrow,
} from '../../ui';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

// Account for both root and group settings navigation stacks
type RootStackProps = NativeStackScreenProps<RootStackParamList, 'ChatVolume'>;
type GroupSettingsProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ChatVolume'
>;
type Props = RootStackProps | GroupSettingsProps;

export function ChatVolumeScreen(props: Props) {
  const { chatType, chatId, groupId } = props.route.params;
  const chatSettings = useChatSettingsNavigation();

  return (
    <ChatOptionsProvider
      initialChat={{
        type: chatType,
        id: chatId,
      }}
      {...chatSettings}
    >
      <ChatVolumeScreenView
        chatType={chatType}
        chatId={chatId}
        groupId={groupId}
      />
    </ChatOptionsProvider>
  );
}

function ChatVolumeScreenView({
  chatType,
  chatId,
  groupId,
}: {
  chatType: 'group' | 'channel';
  chatId: string;
  groupId?: string;
}) {
  const navigation = useNavigation();
  const { navigateToChatDetails } = useRootNavigation();
  const { group, channel } = useChatOptions();
  const { currentLevel, options, updateVolume } = useChatVolumeOptions();
  const isWindowNarrow = useIsWindowNarrow();

  const handleGoBack = useCallback(() => {
    // On mobile, just go back. On desktop, navigate explicitly since
    // HomeDrawer is a drawer navigator where goBack() doesn't work as expected.
    if (isWindowNarrow || !chatId) {
      navigation.goBack();
    } else {
      navigateToChatDetails({ type: chatType, id: chatId, groupId });
    }
  }, [
    navigateToChatDetails,
    navigation,
    chatType,
    chatId,
    groupId,
    isWindowNarrow,
  ]);

  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'volume',
        rows: options.map((option) => ({
          key: option.value,
          title: option.title,
          subtitle: option.description,
          selected: option.value === currentLevel,
          onPress: () => updateVolume(option.value),
        })),
      },
    ],
    [currentLevel, options, updateVolume]
  );

  const chatTitle =
    chatType === 'channel'
      ? channel?.title && group?.title
        ? `${group.title}: ${channel.title}`
        : undefined
      : (group?.title ?? undefined);

  return (
    <SettingsListScreenView
      title="Notifications"
      subtitle={chatTitle}
      sections={sections}
      onBackPressed={handleGoBack}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      useHorizontalTitleLayout={!isWindowNarrow}
    />
  );
}
