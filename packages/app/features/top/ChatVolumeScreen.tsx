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
  getLevelShortTitle,
  getNotificationLevelContext,
} from '../../ui/components/NotificationLevelSelector';
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
  const { group, channel, updateVolume } = useChatOptions();
  const { currentLevel, options } = useChatVolumeOptions();
  const context = getNotificationLevelContext(channel);
  // A chat without a level of its own follows the setting above it.
  const ownLevel = (chatType === 'channel' ? channel : group)?.volumeSettings
    ?.level;
  const isDefault = !ownLevel || ownLevel === 'default';
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
        footer:
          context === 'dm'
            ? 'Choose whether this chat notifies you.'
            : chatType === 'group'
              ? 'Choose what in this workspace notifies you. A channel can have its own setting too.'
              : 'Choose what in this channel notifies you.',
        rows: [
          {
            key: 'default',
            title: 'Default',
            subtitle:
              chatType === 'channel' && channel?.groupId
                ? 'Follows the workspace'
                : 'Follows your notification settings',
            selected: isDefault,
            onPress: () => {
              if (!isDefault) updateVolume(null);
            },
          },
          ...options.map((option) => {
            const shortTitle = getLevelShortTitle(option.value, context);
            const selected = !isDefault && option.value === currentLevel;
            return {
              key: option.value,
              title: shortTitle,
              // "All activity" says all there is; the others' full titles add
              // what they include.
              subtitle:
                option.value === 'loud' || option.title === shortTitle
                  ? undefined
                  : option.title,
              selected,
              onPress: () => {
                if (!selected) updateVolume(option.value);
              },
            };
          }),
        ],
      },
    ],
    [
      channel?.groupId,
      chatType,
      context,
      currentLevel,
      isDefault,
      options,
      updateVolume,
    ]
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
