import { ConfirmDialog, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { ListItem } from '../../../ui/components/ListItem';
import {
  ApplyChangesBar,
  BotIdentityHeader,
  BotSettingsDivider,
  BotSettingsRow,
  BotSettingsSection,
  BotSwitchRow,
} from './BotSettingsUI';
import {
  BASIC_PROVIDER_ID,
  PROVIDER_OPTIONS,
  SUBSCRIPTION_PROVIDERS,
  providerLabel,
} from './constants';
import {
  getLLMAuthProviderStatus,
  isLLMAuthProviderConnected,
} from './openAiSubscription';
import { useBotSettingsQueries } from './useBotSettingsData';
import {
  useApplyBotSettings,
  useSyncBotSettingsDraft,
} from './useBotSettingsDraft';

/**
 * The screens these rows lead to. Both the Settings tab and the standalone bot
 * settings screen render these sections, and their navigators are different
 * types, so callers pass a narrowed navigate rather than the navigation object.
 */
export type BotSettingsNavigate = (
  screen:
    | 'BotModelSettings'
    | 'BotProviderListSettings'
    | 'BotMcpSettings'
    | 'BotPermissionsSettings'
    | 'BotIdentitySettings',
  params?: Record<string, unknown>
) => void;

/**
 * Queries, draft and apply state for one bot-settings surface. Mount this once
 * per screen: `useApplyBotSettings` keeps its own `applying`/`applyError`, so a
 * second instance would render an apply bar that never reflects the first.
 */
export function useBotSettingsHub() {
  const queries = useBotSettingsQueries();
  const settingsReady = useSyncBotSettingsDraft(queries);
  const apply = useApplyBotSettings(queries);

  return { queries, settingsReady, ...apply };
}

export type BotSettingsHub = ReturnType<typeof useBotSettingsHub>;

export function BotSettingsSections({
  hub,
  navigate,
  zdrRowLayout,
}: {
  hub: BotSettingsHub;
  navigate: BotSettingsNavigate;
  zdrRowLayout?: { descriptionGap?: number; paddingVertical?: number };
}) {
  const { queries, settingsReady, draft, pending, commitDraft, applying } = hub;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const controlsReadOnly = !settingsReady || applying;

  const connectedServicesCount = useMemo(
    () =>
      queries.oauthStatusQuery.data?.grants.filter((grant) => grant.connected)
        .length ?? 0,
    [queries.oauthStatusQuery.data]
  );

  const connectedSubscriptionCount = useMemo(
    () =>
      SUBSCRIPTION_PROVIDERS.filter((providerId) =>
        isLLMAuthProviderConnected(
          getLLMAuthProviderStatus(queries.llmAuthStatusQuery.data, providerId)
            ?.status
        )
      ).length,
    [queries.llmAuthStatusQuery.data]
  );

  const apiKeyCount = useMemo(
    () =>
      PROVIDER_OPTIONS.filter(
        (option) =>
          option.id !== BASIC_PROVIDER_ID &&
          Boolean(queries.providerConfig.keys?.[option.id])
      ).length,
    [queries.providerConfig.keys]
  );

  const onBasicModel = draft.model.provider === BASIC_PROVIDER_ID;
  // Tlon picks the fallback chain for its own hosted model, so there is no
  // count to show until the user moves off it or sets fallbacks themselves.
  const fallbacksValue =
    onBasicModel && draft.model.fallbacks.length === 0
      ? 'Managed by Tlon'
      : `${draft.model.fallbacks.length} set`;

  return (
    <YStack gap="$2xl">
      <BotIdentityHeader
        title={draft.nickname || 'Tlonbot'}
        subtitle={`Your personal bot · ${queries.moon ?? `~${queries.ship}`}`}
        avatarUrl={queries.avatarQuery.data ?? undefined}
        ready={queries.botReady}
        restarting={applying}
      />
      {!queries.botReady && settingsReady ? (
        <Text size="$label/s" color="$secondaryText" paddingHorizontal="$s">
          Tlonbot is starting. Settings may take a moment to become editable.
        </Text>
      ) : null}

      <BotSettingsSection title="Models">
        <BotSettingsRow
          label="Default model"
          description={
            draft.model.provider
              ? providerLabel(draft.model.provider)
              : 'Not set'
          }
          value={draft.model.model || undefined}
          pending={pending.modelProvider || pending.model}
          disabled={controlsReadOnly}
          onPress={() => navigate('BotModelSettings', { mode: 'default' })}
        />
        <BotSettingsDivider />
        <BotSettingsRow
          label="Fallback models"
          value={fallbacksValue}
          pending={pending.fallbacks}
          disabled={controlsReadOnly}
          onPress={() => navigate('BotModelSettings', { mode: 'fallbacks' })}
        />
      </BotSettingsSection>

      <BotSettingsSection title="Connections">
        <BotSettingsRow
          label="Provider subscriptions"
          value={
            queries.llmAuthStatusQuery.isLoading
              ? 'Checking…'
              : `${connectedSubscriptionCount} connected`
          }
          disabled={applying || !queries.providerConfigQuery.isSuccess}
          onPress={() =>
            navigate('BotProviderListSettings', { kind: 'subscriptions' })
          }
        />
        <BotSettingsDivider />
        <BotSettingsRow
          label="API keys"
          value={`${apiKeyCount} set`}
          disabled={applying || !queries.providerConfigQuery.isSuccess}
          onPress={() =>
            navigate('BotProviderListSettings', { kind: 'apiKeys' })
          }
        />
        <BotSettingsDivider />
        <BotSettingsRow
          label="Connected services"
          value={
            (queries.oauthProvidersQuery.data?.length ?? 0) === 0
              ? 'Unavailable'
              : `${connectedServicesCount} connected`
          }
          onPress={() => navigate('BotMcpSettings')}
        />
      </BotSettingsSection>

      <BotSettingsSection>
        <BotSettingsRow
          label="Permissions"
          description="People, invitations and channel access"
          pending={
            pending.dmAllowlist ||
            pending.autoAcceptDmInvites ||
            pending.autoDiscoverChannels ||
            pending.defaultAuthorizedShips ||
            pending.groupInviteAllowlist ||
            pending.channelRules
          }
          disabled={controlsReadOnly}
          onPress={() => navigate('BotPermissionsSettings')}
        />
      </BotSettingsSection>

      <BotSettingsSection>
        <AdvancedToggle
          open={advancedOpen}
          onPress={() => setAdvancedOpen((open) => !open)}
        />
        {advancedOpen ? (
          <>
            <BotSettingsDivider />
            <BotSettingsRow
              label="Identity"
              description="Name and self-description"
              pending={pending.nickname}
              disabled={controlsReadOnly}
              onPress={() => navigate('BotIdentitySettings')}
            />
            {settingsReady && onBasicModel && draft.model.model ? (
              <>
                <BotSettingsDivider />
                <BotSwitchRow
                  label="Zero data retention"
                  description="Avoid model providers that retain data. May use your included credits faster."
                  descriptionNumberOfLines={3}
                  multilineDescriptionGap={zdrRowLayout?.descriptionGap}
                  multilinePaddingVertical={zdrRowLayout?.paddingVertical}
                  checked={draft.model.zdr}
                  pending={pending.zdr}
                  disabled={controlsReadOnly}
                  onCheckedChange={(value) =>
                    commitDraft((current) => ({
                      ...current,
                      model: { ...current.model, zdr: value },
                    }))
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </BotSettingsSection>
    </YStack>
  );
}

function AdvancedToggle({
  open,
  onPress,
}: {
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <ListItem>
        <ListItem.SystemIcon
          icon={open ? 'ChevronDown' : 'ChevronRight'}
          rounded
        />
        <ListItem.MainContent justifyContent="center">
          <ListItem.Title>Advanced</ListItem.Title>
        </ListItem.MainContent>
        <XStack alignItems="center" flexShrink={0}>
          <Text size="$label/m" color="$tertiaryText">
            {open ? 'Hide' : 'Show'}
          </Text>
        </XStack>
      </ListItem>
    </Pressable>
  );
}

/**
 * The bar that commits the draft. Renders nothing until there is something to
 * apply, so hosts can mount it unconditionally below their scroll view.
 */
export function BotSettingsApplyBar({ hub }: { hub: BotSettingsHub }) {
  const {
    changeCount,
    changeLabels,
    applying,
    applyError,
    setApplyError,
    discardChanges,
    applyChanges,
    settingsReady,
  } = hub;
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  const handleDiscard = useCallback(() => {
    setApplyError(null);
    discardChanges();
  }, [discardChanges, setApplyError]);

  return (
    <>
      <ApplyChangesBar
        changeCount={changeCount}
        labels={changeLabels}
        applying={applying}
        disabled={!settingsReady || applying}
        error={applyError}
        onDiscard={handleDiscard}
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
    </>
  );
}
