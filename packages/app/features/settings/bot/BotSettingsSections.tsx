import { getBotUserIdForUser } from '@tloncorp/api';
import { ConfirmDialog, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import { ListItem } from '../../../ui/components/ListItem';
import { useContact } from '../../../ui/contexts/appDataContext';
import {
  ApplyChangesBar,
  BotIdentityHeader,
  BotSettingsDivider,
  BotSettingsRow,
  BotSettingsSection,
  BotSwitchRow,
  PendingBadge,
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
 * Queries, draft and apply state for one bot-settings surface. Several of these
 * can be mounted at once (the Settings tab plus whichever bot screen is open on
 * top of it); the draft and the apply state both live in the shared store, so
 * every apply bar shows the same thing.
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
  // The bot's contact is already synced and cached, and it's what the DM tab
  // and chat list render. The hosting avatar endpoint is often empty or slow
  // while the gateway starts, which left this header on its fallback icon.
  const currentUserId = useCurrentUserId();
  const botContact = useContact(getBotUserIdForUser(currentUserId));

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
  const fallbacksValue = !settingsReady
    ? undefined
    : onBasicModel && draft.model.fallbacks.length === 0
      ? 'Managed by Tlon'
      : `${draft.model.fallbacks.length} set`;

  return (
    <YStack gap="$2xl">
      <BotIdentityHeader
        title={draft.nickname || 'Tlonbot'}
        subtitle={`Your personal bot · ${queries.moon ?? `~${queries.ship}`}`}
        avatarUrl={botContact?.avatarImage ?? undefined}
        sigilContactId={botContact?.id}
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
              : queries.llmAuthStatusQuery.isError &&
                  queries.llmAuthStatusQuery.data === undefined
                ? 'Unavailable'
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

      {/* Zero data retention stays in the open rather than moving under
          Advanced: it is a privacy control, and a pending toggle hidden behind
          a collapsed disclosure leaves the apply bar counting a change the user
          cannot see. */}
      {settingsReady && onBasicModel && draft.model.model ? (
        <BotSettingsSection title="Privacy">
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
        </BotSettingsSection>
      ) : null}

      <BotSettingsSection>
        <AdvancedToggle
          open={advancedOpen}
          pending={pending.nickname}
          onPress={() => setAdvancedOpen((open) => !open)}
        />
        {advancedOpen ? (
          <>
            <BotSettingsDivider />
            <BotSettingsRow
              label="Identity"
              description="Your bot's name"
              pending={pending.nickname}
              disabled={controlsReadOnly}
              onPress={() => navigate('BotIdentitySettings')}
            />
          </>
        ) : null}
      </BotSettingsSection>
    </YStack>
  );
}

function AdvancedToggle({
  open,
  pending,
  onPress,
}: {
  open: boolean;
  pending?: boolean;
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
        {/* A pending edit inside a collapsed Advanced would otherwise be
            invisible while the apply bar counts it. */}
        <XStack alignItems="center" gap="$s" flexShrink={0}>
          {pending && !open ? <PendingBadge /> : null}
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
