import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Text, useIsWindowNarrow } from '@tloncorp/ui';
import { ConfirmDialog } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { View, YStack } from 'tamagui';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView, TextInput } from '../../ui';
import {
  ApplyChangesBar,
  BotIdentityHeader,
  BotSettingsDivider,
  BotSettingsErrorText,
  BotSettingsRow,
  BotSettingsSection,
  BotSwitchRow,
} from './bot/BotSettingsUI';
import {
  BASIC_PROVIDER_ID,
  PROVIDER_OPTIONS,
  providerLabel,
} from './bot/constants';
import { normalizeShipList, safeKeySummary } from './bot/helpers';
import { useBotSettingsQueries } from './bot/useBotSettingsData';
import {
  useApplyBotSettings,
  useSyncBotSettingsDraft,
} from './bot/useBotSettingsDraft';

type Props = NativeStackScreenProps<RootStackParamList, 'BotSettings'>;

const logger = createDevLogger('BotSettingsScreen', false);

export function BotSettingsScreen(props: Props) {
  const isWindowNarrow = useIsWindowNarrow();
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const queries = useBotSettingsQueries();
  const settingsReady = useSyncBotSettingsDraft(queries);
  const {
    draft,
    pending,
    changeCount,
    changeLabels,
    hasChanges,
    commitDraft,
    discardChanges,
    applying,
    applyError,
    setApplyError,
    applyChanges,
  } = useApplyBotSettings(queries);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  // Bot settings require a live hosting session: prompt for re-auth when the
  // stored session is expired, and bail out when credentials are missing
  // entirely (nothing here can load without them).
  useEffect(() => {
    let cancelled = false;
    async function checkHostingSession() {
      const [isExpired, authToken, hostingUserId] = await Promise.all([
        db.hostingAuthExpired.getValue(),
        db.hostingAuthToken.getValue(),
        db.hostingUserId.getValue(),
      ]);
      if (cancelled) {
        return;
      }
      if (isExpired) {
        Alert.alert(
          'Logout Required',
          "To access bot settings, you'll need to log back in again.",
          [
            {
              text: 'Cancel',
              onPress: () => props.navigation.goBack(),
              style: 'cancel',
            },
            {
              text: 'Logout',
              onPress: handleLogout,
            },
          ]
        );
        return;
      }
      if (!authToken || !hostingUserId) {
        logger.trackError('Bot settings opened without hosting session', {
          hasAuthToken: Boolean(authToken),
          hasHostingUserId: Boolean(hostingUserId),
        });
        Alert.alert('Error', 'Cannot access bot settings.', [
          { text: 'OK', onPress: () => props.navigation.goBack() },
        ]);
      }
    }
    checkHostingSession().catch((error) => {
      logger.trackError('Failed to check hosting session', { error });
    });
    return () => {
      cancelled = true;
    };
  }, [handleLogout, props.navigation]);

  const controlsReadOnly = !settingsReady || applying;

  const hasCustomProviderKey = PROVIDER_OPTIONS.some(
    (option) =>
      option.id !== BASIC_PROVIDER_ID &&
      Boolean(queries.providerConfig.keys?.[option.id])
  );

  const connectionsCount = useMemo(
    () =>
      queries.oauthStatusQuery.data?.grants.filter((grant) => grant.connected)
        .length ?? 0,
    [queries.oauthStatusQuery.data]
  );

  const enabledChannelCount = Object.keys(draft.chat.channelRuleDrafts).length;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const navigate = props.navigation.navigate;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title="Bot settings"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$2xl" paddingBottom="$2xl">
          <BotIdentityHeader
            title={draft.nickname || 'Tlonbot'}
            subtitle={queries.moon ?? `~${queries.ship}`}
            ready={queries.botReady}
            pending={hasChanges}
            restarting={applying}
          />
          {!queries.botReady && settingsReady ? (
            <Text size="$label/s" color="$secondaryText" paddingHorizontal="$s">
              Tlonbot is starting. Settings may take a moment to become
              editable.
            </Text>
          ) : null}

          <BotSettingsSection title="Identity">
            <NicknameField
              nickname={draft.nickname}
              loading={queries.nicknameQuery.isLoading}
              readOnly={controlsReadOnly}
              pending={pending.nickname}
              onCommit={(value) =>
                commitDraft((current) => ({ ...current, nickname: value }))
              }
            />
          </BotSettingsSection>

          {hasCustomProviderKey ? (
            <BotSettingsSection title="Default model">
              <BotSettingsRow
                label="Provider"
                value={providerLabel(draft.model.provider)}
                pending={pending.modelProvider}
                disabled={controlsReadOnly}
                onPress={() =>
                  navigate('BotModelSettings', { mode: 'default' })
                }
              />
              <BotSettingsDivider />
              <BotSettingsRow
                label="Model"
                value={draft.model.model || 'Not set'}
                pending={pending.model}
                disabled={controlsReadOnly}
                onPress={() =>
                  navigate('BotModelSettings', { mode: 'default' })
                }
              />
              <BotSettingsDivider />
              <BotSettingsRow
                label="Fallback models"
                value={`${draft.model.fallbacks.length} set`}
                pending={pending.fallbacks}
                disabled={controlsReadOnly}
                onPress={() =>
                  navigate('BotModelSettings', { mode: 'fallbacks' })
                }
              />
            </BotSettingsSection>
          ) : null}

          <BotSettingsSection title="API keys">
            {PROVIDER_OPTIONS.filter(
              (option) => option.id !== BASIC_PROVIDER_ID
            ).map((option, index, list) => (
              <YStack key={option.id}>
                <BotSettingsRow
                  label={option.label}
                  value={safeKeySummary(queries.providerConfig, option.id)}
                  icon="Lock"
                  disabled={controlsReadOnly}
                  onPress={() =>
                    navigate('BotApiKeySettings', { provider: option.id })
                  }
                />
                {index < list.length - 1 ? <BotSettingsDivider /> : null}
              </YStack>
            ))}
          </BotSettingsSection>

          <BotSettingsSection title="Connections">
            <BotSettingsRow
              label="Connected services"
              value={
                (queries.oauthProvidersQuery.data?.length ?? 0) === 0
                  ? 'Unavailable'
                  : `${connectionsCount} connected`
              }
              icon="Link"
              onPress={() => navigate('BotMcpSettings')}
            />
          </BotSettingsSection>

          <BotSettingsSection title="Who can message Tlonbot">
            <BotSettingsRow
              label="DM allowlist"
              value={`${normalizeShipList(draft.chat.dmAllowlist).length} ships`}
              pending={pending.dmAllowlist}
              disabled={controlsReadOnly}
              onPress={() =>
                navigate('BotShipListSettings', { list: 'dmAllowlist' })
              }
            />
            <BotSettingsDivider />
            <BotSwitchRow
              label="Auto-accept DM invites"
              description="From ships on the allowlist"
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
            title="Authorized ships"
            description="These ships can always interact with Tlonbot, regardless of per-channel rules."
          >
            <BotSettingsRow
              label="Default authorized"
              value={`${normalizeShipList(draft.chat.defaultAuthorizedShips).length} ships`}
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
              value={`${normalizeShipList(draft.chat.groupInviteAllowlist).length} ships`}
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

          <BotSettingsErrorText>{applyError}</BotSettingsErrorText>
        </YStack>
      </SettingsContentScrollView>
      <ApplyChangesBar
        changeCount={changeCount}
        labels={changeLabels}
        applying={applying}
        disabled={controlsReadOnly}
        error={applyError}
        onDiscard={() => {
          setApplyError(null);
          discardChanges();
        }}
        onApply={() => setConfirmApplyOpen(true)}
      />
      <ConfirmDialog
        open={confirmApplyOpen}
        onOpenChange={setConfirmApplyOpen}
        title="Restart gateway?"
        description={`Applying ${changeCount} ${
          changeCount === 1 ? 'change' : 'changes'
        } restarts the Tlonbot gateway. Your Tlonbot will be offline for ~20 seconds.`}
        confirmText="Apply & restart"
        onConfirm={() => {
          setConfirmApplyOpen(false);
          applyChanges();
        }}
      />
    </View>
  );
}

function NicknameField({
  nickname,
  loading,
  readOnly,
  pending,
  onCommit,
}: {
  nickname: string;
  loading: boolean;
  readOnly: boolean;
  pending: boolean;
  onCommit: (nickname: string) => void;
}) {
  const [value, setValue] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const isEditingRef = useRef(false);

  // Adopt external changes (server sync, discard) — but never while the user
  // is typing, or a background refetch would wipe their in-progress input.
  useEffect(() => {
    if (!isEditingRef.current) {
      setValue(nickname);
    }
  }, [nickname]);

  const commit = useCallback(() => {
    isEditingRef.current = false;
    const trimmed = value.trim();
    if (trimmed.length >= 64) {
      setError('Nickname must be fewer than 64 characters.');
      return;
    }
    setError(null);
    onCommit(trimmed);
  }, [value, onCommit]);

  return (
    <YStack padding="$l" gap="$m">
      <Text size="$label/m" color="$tertiaryText">
        Nickname{pending ? ' (pending)' : ''}
      </Text>
      <TextInput
        value={value}
        placeholder={loading ? 'Loading…' : 'tlonbot'}
        editable={!loading && !readOnly}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onChangeText={setValue}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
      />
      {error ? (
        <Text size="$label/s" color="$negativeActionText">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
