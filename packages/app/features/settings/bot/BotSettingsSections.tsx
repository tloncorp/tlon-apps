import { getBotUserIdForUser } from '@tloncorp/api';
import { ConfirmDialog } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import {
  type SettingsRowModel,
  type SettingsRowStatus,
  type SettingsSectionModel,
  SettingsSectionsView,
} from '../../../ui/components/SettingsList';
import { useContact } from '../../../ui/contexts/appDataContext';
import { ApplyChangesBar, BotAvatar } from './BotSettingsUI';
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

/**
 * The bot's settings as list sections: the bot itself, then its models, its
 * connections and who can reach it. The Settings tab places these in its own
 * list; the standalone screen draws them alone.
 */
export function useBotSettingsSectionModels(
  hub: BotSettingsHub,
  navigate: BotSettingsNavigate
): SettingsSectionModel[] {
  const { queries, settingsReady, draft, pending, commitDraft, applying } = hub;
  const controlsReadOnly = !settingsReady || applying;
  // The bot's contact is already synced and cached, and it's what the DM tab
  // and chat list render. The hosting avatar endpoint is often empty or slow
  // while the gateway starts, which left the avatar on its fallback icon.
  const currentUserId = useCurrentUserId();
  const botContact = useContact(getBotUserIdForUser(currentUserId));
  const botAvatarUrl = botContact?.avatarImage ?? undefined;
  const botContactId = botContact?.id;

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

  const renderBotAvatar = useCallback(
    ({ size }: { size: number }) => (
      <BotAvatar
        size={size}
        avatarUrl={botAvatarUrl}
        sigilContactId={botContactId}
      />
    ),
    [botAvatarUrl, botContactId]
  );

  return useMemo(() => {
    const onBasicModel = draft.model.provider === BASIC_PROVIDER_ID;
    // Tlon picks the fallback chain for its own hosted model, so there is no
    // count to show until the user moves off it or sets fallbacks themselves.
    const fallbacksValue = !settingsReady
      ? undefined
      : onBasicModel && draft.model.fallbacks.length === 0
        ? 'Managed by Tlon'
        : `${draft.model.fallbacks.length} set`;
    // Reflects the bot's runtime status only. Unsaved edits are surfaced by
    // the apply bar and the rows they touch, not here.
    const status: SettingsRowStatus = applying
      ? { text: 'Restarting…', tone: 'warning' }
      : queries.botReady
        ? { text: 'Online', tone: 'positive' }
        : { text: 'Starting', tone: 'neutral' };
    // Zero data retention stays in the open: it is a privacy control, and a
    // pending toggle hidden from view leaves the apply bar counting a change
    // the user cannot see.
    const showsZdr =
      settingsReady && onBasicModel && Boolean(draft.model.model);

    const modelRows: SettingsRowModel[] = [
      {
        key: 'default-model',
        title: 'Default model',
        subtitle: draft.model.provider
          ? providerLabel(draft.model.provider)
          : 'Not set',
        value: draft.model.model || undefined,
        pending: pending.modelProvider || pending.model,
        disabled: controlsReadOnly,
        onPress: () => navigate('BotModelSettings', { mode: 'default' }),
      },
      {
        key: 'fallback-models',
        title: 'Fallback models',
        value: fallbacksValue,
        pending: pending.fallbacks,
        disabled: controlsReadOnly,
        onPress: () => navigate('BotModelSettings', { mode: 'fallbacks' }),
      },
    ];
    if (showsZdr) {
      modelRows.push({
        key: 'zdr',
        title: 'Zero data retention',
        pending: pending.zdr,
        disabled: controlsReadOnly,
        toggle: {
          value: draft.model.zdr,
          onValueChange: (value) =>
            commitDraft((current) => ({
              ...current,
              model: { ...current.model, zdr: value },
            })),
        },
      });
    }

    return [
      {
        key: 'bot',
        footer:
          !queries.botReady && settingsReady
            ? 'Tlonbot is starting. Settings may take a moment to become editable.'
            : undefined,
        rows: [
          {
            key: 'bot-identity',
            title: draft.nickname || 'Tlonbot',
            subtitle: `Your personal bot · ${queries.moon ?? `~${queries.ship}`}`,
            leading: { kind: 'element', render: renderBotAvatar },
            prominent: true,
            status,
            pending: pending.nickname,
            // The bot's own row edits its name, the way your profile row
            // opens your profile.
            onPress: controlsReadOnly
              ? undefined
              : () => navigate('BotIdentitySettings'),
            testID: 'BotIdentityRow',
          },
        ],
      },
      {
        key: 'bot-models',
        title: 'Models',
        footer: showsZdr
          ? 'Zero data retention avoids model providers that retain data. It may use your included credits faster.'
          : undefined,
        rows: modelRows,
      },
      {
        key: 'bot-connections',
        title: 'Connections',
        rows: [
          {
            key: 'subscriptions',
            title: 'Provider subscriptions',
            value: queries.llmAuthStatusQuery.isLoading
              ? 'Checking…'
              : queries.llmAuthStatusQuery.isError &&
                  queries.llmAuthStatusQuery.data === undefined
                ? 'Unavailable'
                : `${connectedSubscriptionCount} connected`,
            disabled: applying || !queries.providerConfigQuery.isSuccess,
            onPress: () =>
              navigate('BotProviderListSettings', { kind: 'subscriptions' }),
          },
          {
            key: 'api-keys',
            title: 'API keys',
            value: `${apiKeyCount} set`,
            disabled: applying || !queries.providerConfigQuery.isSuccess,
            onPress: () =>
              navigate('BotProviderListSettings', { kind: 'apiKeys' }),
          },
          {
            key: 'connected-services',
            title: 'Connected services',
            value:
              (queries.oauthProvidersQuery.data?.length ?? 0) === 0
                ? 'Unavailable'
                : `${connectedServicesCount} connected`,
            onPress: () => navigate('BotMcpSettings'),
          },
        ],
      },
      {
        key: 'bot-access',
        rows: [
          {
            key: 'permissions',
            title: 'Permissions',
            subtitle: 'People, invitations and channel access',
            pending:
              pending.dmAllowlist ||
              pending.autoAcceptDmInvites ||
              pending.autoDiscoverChannels ||
              pending.defaultAuthorizedShips ||
              pending.groupInviteAllowlist ||
              pending.channelRules,
            disabled: controlsReadOnly,
            onPress: () => navigate('BotPermissionsSettings'),
          },
        ],
      },
    ];
  }, [
    apiKeyCount,
    applying,
    renderBotAvatar,
    commitDraft,
    connectedServicesCount,
    connectedSubscriptionCount,
    controlsReadOnly,
    draft.model.fallbacks.length,
    draft.model.model,
    draft.model.provider,
    draft.model.zdr,
    draft.nickname,
    navigate,
    pending,
    queries.botReady,
    queries.llmAuthStatusQuery.data,
    queries.llmAuthStatusQuery.isError,
    queries.llmAuthStatusQuery.isLoading,
    queries.moon,
    queries.oauthProvidersQuery.data,
    queries.providerConfigQuery.isSuccess,
    queries.ship,
    settingsReady,
  ]);
}

/** The bot's sections on their own, for the standalone bot settings screen. */
export function BotSettingsSections({
  hub,
  navigate,
}: {
  hub: BotSettingsHub;
  navigate: BotSettingsNavigate;
}) {
  const sections = useBotSettingsSectionModels(hub, navigate);

  return (
    <YStack gap="$2xl">
      <SettingsSectionsView sections={sections} />
    </YStack>
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
