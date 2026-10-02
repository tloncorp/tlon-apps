import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pluralize, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import {
  BotSettingsDivider,
  BotSettingsRow,
  BotSettingsSection,
  BotSwitchRow,
} from './bot/BotSettingsUI';
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
  const isWindowNarrow = useIsWindowNarrow();
  const hub = useBotSettingsHub();
  const { settingsReady, draft, pending, commitDraft, applying } = hub;
  const controlsReadOnly = !settingsReady || applying;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const navigate = props.navigation.navigate;
  const enabledChannelCount = Object.keys(draft.chat.channelRuleDrafts).length;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title="Permissions"
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$2xl" paddingBottom="$2xl">
          <BotSettingsSection title="Who can message Tlonbot">
            <BotSettingsRow
              label="DM allowlist"
              value={userCount(
                normalizeShipList(draft.chat.dmAllowlist).length
              )}
              pending={pending.dmAllowlist}
              disabled={controlsReadOnly}
              onPress={() =>
                navigate('BotShipListSettings', { list: 'dmAllowlist' })
              }
            />
            <BotSettingsDivider />
            <BotSwitchRow
              label="Auto-accept DM invites"
              description="From users on the allowlist"
              checked={draft.chat.autoAcceptDmInvites}
              disabled={controlsReadOnly}
              pending={pending.autoAcceptDmInvites}
              onCheckedChange={(value) =>
                commitDraft((current) => ({
                  ...current,
                  chat: { ...current.chat, autoAcceptDmInvites: value },
                }))
              }
            />
            <BotSettingsDivider />
            <BotSwitchRow
              label="Auto-discover group channels"
              description="Index new channels you join"
              checked={draft.chat.autoDiscoverChannels}
              disabled={controlsReadOnly}
              pending={pending.autoDiscoverChannels}
              onCheckedChange={(value) =>
                commitDraft((current) => ({
                  ...current,
                  chat: { ...current.chat, autoDiscoverChannels: value },
                }))
              }
            />
          </BotSettingsSection>

          <BotSettingsSection
            title="Authorized users"
            description="These users can always interact with Tlonbot, regardless of per-channel rules."
          >
            <BotSettingsRow
              label="Default authorized"
              value={userCount(
                normalizeShipList(draft.chat.defaultAuthorizedShips).length
              )}
              pending={pending.defaultAuthorizedShips}
              disabled={controlsReadOnly}
              onPress={() =>
                navigate('BotShipListSettings', {
                  list: 'defaultAuthorizedShips',
                })
              }
            />
            <BotSettingsDivider />
            <BotSettingsRow
              label="Can invite to groups"
              value={userCount(
                normalizeShipList(draft.chat.groupInviteAllowlist).length
              )}
              pending={pending.groupInviteAllowlist}
              disabled={controlsReadOnly}
              onPress={() =>
                navigate('BotShipListSettings', {
                  list: 'groupInviteAllowlist',
                })
              }
            />
          </BotSettingsSection>

          <BotSettingsSection
            title="Channels"
            description="Choose which channels Tlonbot can read and respond in."
          >
            <BotSettingsRow
              label="Per-channel rules"
              value={`${enabledChannelCount} enabled`}
              pending={pending.channelRules}
              disabled={controlsReadOnly}
              onPress={() => navigate('BotChannelRulesSettings')}
            />
          </BotSettingsSection>
        </YStack>
      </SettingsContentScrollView>
      <BotSettingsApplyBar hub={hub} />
    </View>
  );
}
