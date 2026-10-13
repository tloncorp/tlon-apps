import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pluralize } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { RootStackParamList } from '../../navigation/types';
import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import {
  BotSettingsApplyBar,
  useBotSettingsHub,
} from './bot/BotSettingsSections';
import { normalizeShipList } from './bot/helpers';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BotPermissionsSettings'
>;

const userCount = (n: number): string => `${n} ${pluralize(n, 'user')}`;

export function BotPermissionsSettingsScreen(props: Props) {
  const hub = useBotSettingsHub();
  const { settingsReady, draft, pending, commitDraft, applying } = hub;
  const controlsReadOnly = !settingsReady || applying;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const navigate = props.navigation.navigate;
  const enabledChannelCount = Object.keys(draft.chat.channelRuleDrafts).length;

  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'messaging',
        title: 'Who can message Tlonbot',
        rows: [
          {
            key: 'dm-allowlist',
            title: 'DM allowlist',
            value: userCount(normalizeShipList(draft.chat.dmAllowlist).length),
            pending: pending.dmAllowlist,
            disabled: controlsReadOnly,
            onPress: () =>
              navigate('BotShipListSettings', { list: 'dmAllowlist' }),
          },
          {
            key: 'auto-accept-dm-invites',
            title: 'Auto-accept DM invites',
            subtitle: 'From users on the allowlist',
            pending: pending.autoAcceptDmInvites,
            disabled: controlsReadOnly,
            toggle: {
              value: draft.chat.autoAcceptDmInvites,
              onValueChange: (value) =>
                commitDraft((current) => ({
                  ...current,
                  chat: { ...current.chat, autoAcceptDmInvites: value },
                })),
            },
          },
          {
            key: 'auto-discover-channels',
            title: 'Auto-discover group channels',
            subtitle: 'Index new channels you join',
            pending: pending.autoDiscoverChannels,
            disabled: controlsReadOnly,
            toggle: {
              value: draft.chat.autoDiscoverChannels,
              onValueChange: (value) =>
                commitDraft((current) => ({
                  ...current,
                  chat: { ...current.chat, autoDiscoverChannels: value },
                })),
            },
          },
        ],
      },
      {
        key: 'authorized-users',
        title: 'Authorized users',
        footer:
          'These users can always interact with Tlonbot, regardless of per-channel rules.',
        rows: [
          {
            key: 'default-authorized',
            title: 'Default authorized',
            value: userCount(
              normalizeShipList(draft.chat.defaultAuthorizedShips).length
            ),
            pending: pending.defaultAuthorizedShips,
            disabled: controlsReadOnly,
            onPress: () =>
              navigate('BotShipListSettings', {
                list: 'defaultAuthorizedShips',
              }),
          },
          {
            key: 'group-invite-allowlist',
            title: 'Can invite to groups',
            value: userCount(
              normalizeShipList(draft.chat.groupInviteAllowlist).length
            ),
            pending: pending.groupInviteAllowlist,
            disabled: controlsReadOnly,
            onPress: () =>
              navigate('BotShipListSettings', {
                list: 'groupInviteAllowlist',
              }),
          },
        ],
      },
      {
        key: 'channels',
        title: 'Channels',
        footer: 'Choose which channels Tlonbot can read and respond in.',
        rows: [
          {
            key: 'channel-rules',
            title: 'Per-channel rules',
            value: `${enabledChannelCount} enabled`,
            pending: pending.channelRules,
            disabled: controlsReadOnly,
            onPress: () => navigate('BotChannelRulesSettings'),
          },
        ],
      },
    ],
    [
      commitDraft,
      controlsReadOnly,
      draft.chat,
      enabledChannelCount,
      navigate,
      pending,
    ]
  );

  return (
    <SettingsListScreenView
      title="Permissions"
      sections={sections}
      onBackPressed={handleBack}
      bottomBar={<BotSettingsApplyBar hub={hub} />}
    />
  );
}
