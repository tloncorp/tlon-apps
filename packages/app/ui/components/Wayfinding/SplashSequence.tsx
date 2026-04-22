// tamagui-ignore
import Clipboard from '@react-native-clipboard/clipboard';
import * as api from '@tloncorp/api';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { DEFAULT_BOT_CONFIG } from '@tloncorp/shared/domain';
import {
  extractTokenFromInviteLink,
  generateHomeGroupTitle,
  getFallbackHomeGroupId,
  getMetadataFromInviteToken,
  withRetry,
} from '@tloncorp/shared/logic';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import {
  Button,
  Icon,
  KeyboardAvoidingView,
  LoadingSpinner,
  Pressable,
  Text,
} from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, Image, Keyboard, ScrollView, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  YStack,
  ZStack,
  getTokenValue,
  isWeb,
  styled,
  useThemeName,
} from 'tamagui';

import { useContactPermissions } from '../../../hooks/useContactPermissions';
import {
  InviteSystemContactsFn,
  useInviteSystemContactHandler,
} from '../../../hooks/useInviteSystemContactHandler';
import { useActiveTheme } from '../../../provider';
import { AttachmentProvider } from '../../contexts/attachment';
import { useStore } from '../../contexts/storeContext';
import { useSystemContactSearch } from '../../hooks/systemContactSorters';
import { Field, ImageInput, TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { PersonalInviteButton } from '../PersonalInviteButton';
import { ScreenHeader } from '../ScreenHeader';
import { SearchBar } from '../SearchBar';
import { SystemContactListItem } from '../listItems';
import { BotChatPreview } from './BotChatPreview';
import { validateProviderKey } from './providerKeyValidation';
import { useHomeGroupInviteLink } from './useHomeGroupInviteLink';
import { PrivacyThumbprint } from './visuals/PrivacyThumbprint';

/**
 * Splash sequence panes.
 *
 * Bot-enabled flow:
 *   Welcome → TlonBot → BotName → BotAvatar → BotProvider → BotModel → Group
 *     → Invite
 *
 * Standard flow:
 *   Welcome → Group → Channels → Privacy → Invite
 */
enum SplashPane {
  Welcome = 'Welcome',
  Group = 'Group',
  Channels = 'Channels',
  Privacy = 'Privacy',
  TlonBot = 'TlonBot',
  BotName = 'BotName',
  BotAvatar = 'BotAvatar',
  BotProvider = 'BotProvider',
  BotModel = 'BotModel',
  Invite = 'Invite',
}

type CustomBotSetupStatus = 'idle' | 'pending' | 'ready' | 'failed';

function SplashSequenceComponent(props: {
  onCompleted: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
  hostingBotEnabled?: boolean;
}) {
  const store = useStore();
  const canUpload = useCanUpload();
  const [currentPane, setCurrentPane] = React.useState(SplashPane.Welcome);
  const { hostingBotEnabled } = props;
  const [botName, setBotName] = React.useState(DEFAULT_BOT_CONFIG.name);
  const [botAvatarUrl, setBotAvatarUrl] = React.useState<string | null>(
    DEFAULT_BOT_CONFIG.avatarUrl
  );
  const [botModel, setBotModel] = React.useState('');
  const [botApiKey, setBotApiKey] = React.useState('');
  const [userShipId, setUserShipId] = React.useState<string | null>(null);
  const [userNickname, setUserNickname] = React.useState<string | null>(null);
  const [botShipId, setBotShipId] = React.useState<string | null>(null);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [avatarDirty, setAvatarDirty] = React.useState(false);
  const [didConfigureBot, setDidConfigureBot] = React.useState(false);
  const [configError, setConfigError] = React.useState<string | null>(null);
  const [providerOptions, setProviderOptions] = React.useState<
    { label: string; provider: string; requiresKey: boolean }[]
  >([]);
  const [providerModels, setProviderModels] = React.useState<
    api.TlawnProviderModel[]
  >([]);
  const [botPrimaryModel, setBotPrimaryModel] = React.useState('');
  const [customBotSetupStatus, setCustomBotSetupStatus] =
    React.useState<CustomBotSetupStatus>('idle');
  const [finishingSplash, setFinishingSplash] = React.useState(false);
  const customBotSetupPromiseRef = useRef<Promise<boolean> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    logger.trackEvent('Wayfinding Splash Pane Viewed', {
      pane: currentPane,
    });
  }, [currentPane]);

  // Fetch bot info and provider config from hosting API on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shipId = await db.hostedUserNodeId.getValue();
        const userId = await db.hostingUserId.getValue();
        if (shipId) {
          setUserShipId(`~${shipId}`);
          const [botInfo, providerConfig, userContact] = await Promise.all([
            api.getTlawnBotInfo(shipId).catch(() => null),
            userId ? api.getTlawnProviderKeys(userId).catch(() => null) : null,
            db.getContact({ id: `~${shipId}` }).catch(() => null),
          ]);
          if (!cancelled) {
            if (userContact?.nickname) {
              setUserNickname(userContact.nickname);
              // Prefill the bot name from the user's nickname. We ignore any
              // nickname stored on hosting so the field always reflects the
              // user's current identity at splash time.
              setBotName(`${userContact.nickname}'s Tlonbot`);
            }
            if (botInfo?.moon) {
              // Hosting returns the moon prefix (e.g., `pinser-botter`); the
              // full @p is `~<prefix>-<shipName>`.
              setBotShipId(`~${botInfo.moon}-${shipId}`);
            }

            // Build provider options from hosting config
            if (providerConfig) {
              const providers: {
                label: string;
                provider: string;
                requiresKey: boolean;
              }[] = [];
              // Providers with default keys (free, no user key needed)
              for (const provider of Object.keys(
                providerConfig.defaultKeys ?? {}
              )) {
                providers.push({
                  label: providerLabel(provider),
                  provider,
                  requiresKey: false,
                });
              }
              // Providers the user already has keys for
              for (const provider of Object.keys(providerConfig.keys ?? {})) {
                if (!providers.some((p) => p.provider === provider)) {
                  providers.push({
                    label: providerLabel(provider),
                    provider,
                    requiresKey: true,
                  });
                }
              }
              // Always include common BYOK providers
              for (const provider of ['anthropic', 'openai', 'openrouter']) {
                if (!providers.some((p) => p.provider === provider)) {
                  providers.push({
                    label: providerLabel(provider),
                    provider,
                    requiresKey: true,
                  });
                }
              }
              setProviderOptions(providers);
              // Default to the first free provider
              const freeProvider = providers.find((p) => !p.requiresKey);
              if (freeProvider) {
                setBotModel(freeProvider.provider);
              }
            }
          }
        }
      } catch {
        // Best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAvatarUrlChange = useCallback((url: string | null) => {
    setBotAvatarUrl(url);
    setAvatarDirty(true);
  }, []);

  const persistBotIdentityInBackground = useCallback(
    ({
      flow,
      provider,
      shipId,
      nickname,
      avatarUrl,
    }: {
      flow: 'basic' | 'custom' | 'identity';
      provider: string;
      shipId: string | null;
      nickname: string;
      avatarUrl: string | null;
    }) => {
      const name = nickname.trim() || 'Tlonbot';
      const meta = {
        flow,
        provider,
        hasAvatar: !!avatarUrl,
      };

      logger.trackEvent('Wayfinding Bot Identity Sync Started', meta);

      void (async () => {
        const resolvedShipId = shipId ?? (await db.hostedUserNodeId.getValue());

        if (!resolvedShipId) {
          logger.trackError('Wayfinding Bot Identity Sync Failed', {
            ...meta,
            step: 'missing_ship_id',
          });
          return;
        }

        try {
          await withRetry(() => api.setTlawnNickname(resolvedShipId, name), {
            startingDelay: 750,
            numOfAttempts: 4,
            maxDelay: 4000,
          });
          logger.trackEvent('Wayfinding Bot Nickname Sync Succeeded', meta);
        } catch (error) {
          logger.trackError('Wayfinding Bot Nickname Sync Failed', {
            ...meta,
            error,
          });
        }

        if (avatarUrl) {
          try {
            await withRetry(
              () => api.setTlawnAvatar(resolvedShipId, avatarUrl),
              {
                startingDelay: 750,
                numOfAttempts: 4,
                maxDelay: 4000,
              }
            );
            logger.trackEvent('Wayfinding Bot Avatar Sync Succeeded', meta);
          } catch (error) {
            logger.trackError('Wayfinding Bot Avatar Sync Failed', {
              ...meta,
              error,
            });
          }
        }

        try {
          await applyHomeGroupBotIdentity(name);
          logger.trackEvent('Wayfinding Home Group Sync Succeeded', meta);
        } catch (error) {
          logger.trackError('Wayfinding Home Group Sync Failed', {
            ...meta,
            error,
          });
        }

        logger.trackEvent('Wayfinding Bot Identity Sync Completed', meta);
      })();
    },
    [store]
  );

  const handleBotAvatarCompleted = useCallback(() => {
    persistBotIdentityInBackground({
      flow: 'identity',
      provider: botModel || 'unselected',
      shipId: userShipId ? userShipId.slice(1) : null,
      nickname: botName,
      avatarUrl: avatarDirty ? botAvatarUrl : null,
    });
    setCurrentPane(SplashPane.BotProvider);
  }, [
    avatarDirty,
    botAvatarUrl,
    botModel,
    botName,
    persistBotIdentityInBackground,
    userShipId,
  ]);

  const startCustomBotSetup = useCallback(
    ({
      userId,
      shipId,
      provider,
      model,
    }: {
      userId: string | null;
      shipId: string | null;
      provider: string;
      model: string;
    }) => {
      if (isMountedRef.current) {
        setCustomBotSetupStatus('pending');
      }

      const promise = (async () => {
        const meta = { provider, model };
        logger.trackEvent('Wayfinding Bot Reconfigure Started', meta);

        if (!userId || !shipId) {
          if (isMountedRef.current) {
            setCustomBotSetupStatus('failed');
          }
          logger.trackError('Wayfinding Bot Reconfigure Failed', {
            ...meta,
            step: 'missing_ids',
            hasUserId: !!userId,
            hasShipId: !!shipId,
          });
          return false;
        }

        try {
          await withRetry(
            () => api.setTlawnPrimaryModel(userId, { provider, model }),
            {
              startingDelay: 750,
              numOfAttempts: 4,
              maxDelay: 4000,
            }
          );
          logger.trackEvent(
            'Wayfinding Bot Primary Model Sync Succeeded',
            meta
          );
        } catch (error) {
          if (isMountedRef.current) {
            setCustomBotSetupStatus('failed');
          }
          logger.trackError('Wayfinding Bot Reconfigure Failed', {
            ...meta,
            step: 'set_primary_model',
            error,
          });
          return false;
        }

        const running = await api.awaitBotRunning(shipId, {
          timeoutMs: 30_000,
          pollIntervalMs: 1500,
        });

        if (running) {
          if (isMountedRef.current) {
            setCustomBotSetupStatus('ready');
          }
          logger.trackEvent('Wayfinding Bot Reconfigure Ready', meta);
          return true;
        }

        if (isMountedRef.current) {
          setCustomBotSetupStatus('failed');
        }
        logger.trackError('Wayfinding Bot Reconfigure Failed', {
          ...meta,
          step: 'await_bot_running_timeout',
        });
        return false;
      })();

      customBotSetupPromiseRef.current = promise;
      return promise;
    },
    []
  );

  // Step 1: if the user picks `basic` (their hosting default), save
  // nickname/avatar and skip straight to the group pane — nothing to validate
  // or configure. Otherwise, save the provider key and call
  // getTlawnProviderModels to validate it against the real provider and
  // populate the model picker.
  const handleValidateProvider = useCallback(async () => {
    setSavingConfig(true);
    setConfigError(null);
    try {
      const userId = await db.hostingUserId.getValue();
      const provider = botModel || BASIC_PROVIDER_ID;
      const selected = providerOptions.find((p) => p.provider === provider);

      if (provider === BASIC_PROVIDER_ID) {
        setDidConfigureBot(true);
        setCustomBotSetupStatus('ready');
        setCurrentPane(SplashPane.Group);
        return;
      }

      if (!userId) {
        setConfigError('Could not validate provider. Please try again.');
        logger.trackError('Wayfinding Bot Provider Validation Failed', {
          provider,
          step: 'missing_user_id',
        });
        return;
      }

      if (selected?.requiresKey) {
        const keyError = validateProviderKey(provider, botApiKey);
        if (keyError) {
          setConfigError(keyError);
          return;
        }
      }

      if (selected?.requiresKey) {
        try {
          await api.setTlawnProviderKey(userId, provider, botApiKey);
          logger.trackEvent('Wayfinding Bot Provider Key Sync Succeeded', {
            provider,
          });
        } catch (error) {
          logger.trackError('Wayfinding Bot Provider Key Sync Failed', {
            provider,
            error,
          });
          throw error;
        }
      }
      const result = await api.getTlawnProviderModels(userId, provider);
      setProviderModels(result.data);
      setBotPrimaryModel(result.data[0]?.id ?? `${provider}/auto`);
      setCurrentPane(SplashPane.BotModel);
    } catch (e) {
      console.error('Failed to validate provider during onboarding:', e);
      setConfigError(
        'Could not validate provider. Check your API key and try again.'
      );
    } finally {
      if (isMountedRef.current) {
        setSavingConfig(false);
      }
    }
  }, [botApiKey, botModel, providerOptions]);

  // Step 2 (non-basic only): start the restart-causing work in the background.
  const handleSaveModelConfig = useCallback(async () => {
    setSavingConfig(true);
    setConfigError(null);
    try {
      const userId = await db.hostingUserId.getValue();
      const shipId = await db.hostedUserNodeId.getValue();
      const provider = botModel || BASIC_PROVIDER_ID;
      const model = botPrimaryModel || `${provider}/auto`;
      setDidConfigureBot(true);
      logger.trackEvent('Customized TlonBot API Key', {
        botProvider: provider,
        botModel: model,
      });
      startCustomBotSetup({ userId, shipId, provider, model });
      setCurrentPane(SplashPane.Group);
    } catch (e) {
      console.error('Failed to save bot config during onboarding:', e);
      logger.trackError('Wayfinding Bot Reconfigure Failed', {
        step: 'save_handler',
        error: e,
      });
      setCurrentPane(SplashPane.Group);
    } finally {
      if (isMountedRef.current) {
        setSavingConfig(false);
      }
    }
  }, [botModel, botPrimaryModel, startCustomBotSetup]);

  const handleSplashCompleted = useCallback(async () => {
    if (finishingSplash) return;

    setFinishingSplash(true);
    try {
      const pendingCustomBotSetup = customBotSetupPromiseRef.current;
      if (customBotSetupStatus === 'pending' && pendingCustomBotSetup) {
        logger.trackEvent('Wayfinding Bot Exit Wait Started', {
          timeoutMs: 7000,
        });
        const exitWaitResult = await Promise.race([
          pendingCustomBotSetup.then((ready) => ({
            kind: 'resolved' as const,
            ready,
          })),
          new Promise<{ kind: 'timeout' }>((resolve) => {
            setTimeout(() => resolve({ kind: 'timeout' }), 7000);
          }),
        ]);

        if (exitWaitResult.kind === 'resolved' && exitWaitResult.ready) {
          logger.trackEvent('Wayfinding Bot Exit Wait Succeeded', {
            timeoutMs: 7000,
          });
        } else if (exitWaitResult.kind === 'resolved') {
          logger.trackEvent('Wayfinding Bot Exit Wait Finished Unready', {
            timeoutMs: 7000,
          });
        } else {
          logger.trackEvent('Wayfinding Bot Exit Wait Timed Out', {
            timeoutMs: 7000,
          });
        }
      }

      void store.completeWayfindingSplash();
      props.onCompleted();
    } finally {
      if (isMountedRef.current) {
        setFinishingSplash(false);
      }
    }
  }, [customBotSetupStatus, finishingSplash, props, store]);

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <View flex={1}>
        {currentPane === SplashPane.Welcome && (
          <WelcomePane
            onActionPress={() =>
              setCurrentPane(
                hostingBotEnabled ? SplashPane.TlonBot : SplashPane.Group
              )
            }
            hostingBotEnabled={hostingBotEnabled}
          />
        )}

        {currentPane === SplashPane.TlonBot && (
          <TlonBotPane
            onActionPress={() => setCurrentPane(SplashPane.BotName)}
          />
        )}
        {currentPane === SplashPane.BotName && (
          <BotNamePane
            name={botName}
            userNickname={userNickname}
            onNameChange={setBotName}
            onActionPress={() => setCurrentPane(SplashPane.BotAvatar)}
          />
        )}
        {currentPane === SplashPane.BotAvatar && (
          <BotAvatarPane
            avatarUrl={avatarDirty ? botAvatarUrl : null}
            onAvatarUrlChange={handleAvatarUrlChange}
            onActionPress={handleBotAvatarCompleted}
          />
        )}
        {currentPane === SplashPane.BotProvider && (
          <BotProviderPane
            model={botModel}
            apiKey={botApiKey}
            providers={providerOptions}
            loading={savingConfig}
            error={configError}
            onModelChange={setBotModel}
            onApiKeyChange={setBotApiKey}
            onActionPress={handleValidateProvider}
          />
        )}
        {currentPane === SplashPane.BotModel && (
          <BotModelPane
            models={providerModels}
            selectedModel={botPrimaryModel}
            loading={savingConfig}
            error={configError}
            onSelectModel={setBotPrimaryModel}
            onBackPress={() => setCurrentPane(SplashPane.BotProvider)}
            onActionPress={handleSaveModelConfig}
          />
        )}

        {currentPane === SplashPane.Group && (
          <GroupsPane
            onActionPress={() =>
              setCurrentPane(
                hostingBotEnabled ? SplashPane.Invite : SplashPane.Channels
              )
            }
            hostingBotEnabled={hostingBotEnabled}
            botName={botName || 'Tlonbot'}
            didConfigureBot={didConfigureBot}
            botSetupStatus={customBotSetupStatus}
            userShipId={userShipId}
            botShipId={botShipId}
          />
        )}

        {currentPane === SplashPane.Channels && (
          <ChannelsPane
            onActionPress={() => setCurrentPane(SplashPane.Privacy)}
            hostingBotEnabled={hostingBotEnabled}
          />
        )}
        {currentPane === SplashPane.Privacy && (
          <PrivacyPane
            onActionPress={() => setCurrentPane(SplashPane.Invite)}
          />
        )}

        {currentPane === SplashPane.Invite && (
          <InvitePane
            onActionPress={handleSplashCompleted}
            inviteSystemContacts={props.inviteSystemContacts}
            isCompleting={finishingSplash}
          />
        )}
      </View>
    </AttachmentProvider>
  );
}

export const SplashSequence = React.memo(SplashSequenceComponent);

const BASIC_PROVIDER_ID = 'basic';

// Resolve the home group ID from the cached lure token metadata so we don't
// rely on the hardcoded slug. Falls back to the conventional slug if the
// token metadata hasn't been cached or fails to resolve.
async function resolveHomeGroupId(currentUserId: string): Promise<string> {
  const cached = await db.homeGroupId.getValue();
  if (cached) {
    return cached;
  }

  const inviteLink = await db.homeGroupInviteLink.getValue();
  const token = inviteLink ? extractTokenFromInviteLink(inviteLink) : null;
  if (token) {
    try {
      const metadata = await getMetadataFromInviteToken(token);
      if (metadata?.invitedGroupId) {
        await db.homeGroupId.setValue(metadata.invitedGroupId);
        return metadata.invitedGroupId;
      }
    } catch (e) {
      logger.trackError('failed to resolve home group id from invite token', {
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return getFallbackHomeGroupId(currentUserId);
}

// Hosting provisions the home group generic and unpinned; once the user
// picks a bot nickname we retitle and pin it client-side.
//
// Goes through `api` directly (rather than the `store.updateGroupMeta` /
// `store.pinGroup` helpers) because those swallow poke failures and roll back
// optimistically. We want errors to propagate here so `withRetry` actually
// retries transient failures and the Wayfinding analytics reflect server state.
async function applyHomeGroupBotIdentity(botNickname: string) {
  const currentUserId = api.getCurrentUserId();
  const homeGroupId = await resolveHomeGroupId(currentUserId);
  const newTitle = generateHomeGroupTitle(botNickname);

  await withRetry(
    async () => {
      const homeGroup = await db.getGroup({ id: homeGroupId });
      if (!homeGroup) {
        throw new Error('Home group not yet available');
      }
      if (homeGroup.title !== newTitle) {
        await api.updateGroupMeta({
          groupId: homeGroup.id,
          meta: {
            title: newTitle,
            description: homeGroup.description ?? '',
            cover: homeGroup.coverImage ?? homeGroup.coverImageColor ?? '',
            image: homeGroup.iconImage ?? homeGroup.iconImageColor ?? '',
          },
        });
      }
      if (!homeGroup.pin) {
        await api.pinItem(homeGroup.id);
      }
    },
    {
      startingDelay: 1000,
      numOfAttempts: 5,
      maxDelay: 4000,
    }
  );
}

async function shareTlonbotGroupInvite(homeGroupInviteLink: string) {
  if (isWeb) {
    try {
      await navigator.clipboard.writeText(homeGroupInviteLink);
    } catch (e) {
      console.error('Failed to copy invite link:', e);
    }
    return;
  }
  try {
    await Share.share({ message: homeGroupInviteLink });
  } catch (e) {
    console.error('Failed to share invite link:', e);
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  basic: 'MiniMax',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

const SplashTitle = styled(Text, {
  fontSize: '$xl',
  fontWeight: '600',
  marginHorizontal: '$xl',
});

const SplashParagraph = styled(Text, {
  size: '$body',
  marginHorizontal: '$xl',
  marginBottom: '$2xl',
  color: '$secondaryText',
});

export function WelcomePane(props: {
  onActionPress: () => void;
  hostingBotEnabled?: boolean;
}) {
  const activeTheme = useActiveTheme();
  const insets = useSafeAreaInsets();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <Image
        style={{
          width: '100%',
          height: 321,
        }}
        resizeMode="cover"
        source={
          isWeb
            ? isDark
              ? `./sourdough-starter-dark.png`
              : `./sourdough-starter.png`
            : isDark
              ? require(`../../assets/raster/sourdough-starter-dark.png`)
              : require(`../../assets/raster/sourdough-starter.png`)
        }
      />
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          Welcome to <Text color="$positiveActionText">Tlon Messenger.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            Everything here is stored on your private server–only you can access
            it.
          </SplashParagraph>
          {props.hostingBotEnabled && (
            <SplashParagraph>
              Tlonbot, your AI agent, helps you search, summarize, draft
              messages, and more.
            </SplashParagraph>
          )}
        </ScrollView>
      </YStack>
      <Button
        data-testid="lets-get-started"
        onPress={props.onActionPress}
        label="Let's get started"
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
}

export function TlonBotPane(props: { onActionPress: () => void }) {
  const activeTheme = useActiveTheme();
  const insets = useSafeAreaInsets();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <Image
        style={{ width: '100%', height: 330 }}
        resizeMode="cover"
        source={
          isWeb
            ? isDark
              ? `./bot-dark.png`
              : `./bot.png`
            : isDark
              ? require(`../../assets/raster/bot-dark.png`)
              : require(`../../assets/raster/bot.png`)
        }
      />
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          Meet your <Text color="$positiveActionText">Tlonbot.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1, marginBottom: getTokenValue('$l', 'size') }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            Tlonbot has its own identity on the network. DM it to search the
            web, draft messages, or set up daily briefings. Add it to group
            channels and it can participate in conversations alongside you.
          </SplashParagraph>
          <SplashParagraph>
            Your API keys, your agent&#39;s memory, and everything it learns
            stays on your personal node. You own it all.
          </SplashParagraph>
        </ScrollView>
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$2xl">
        <Button
          onPress={props.onActionPress}
          testID="bot-configure"
          label="Configure now"
          preset="hero"
          shadow
        />
      </YStack>
    </View>
  );
}

export function BotNamePane(props: {
  name: string;
  userNickname?: string | null;
  onNameChange: (name: string) => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Real default we'd save if the user advances with an empty field.
  // Without a nickname we can't personalize, so fall back to plain "Tlonbot".
  const fallbackName = props.userNickname
    ? `${props.userNickname}'s Tlonbot`
    : 'Tlonbot';
  // When we have a personalized fallback, surface it as the placeholder so
  // the user sees what they'll get. Otherwise show instructional text — we
  // must not write that instructional text into state.
  const placeholder = props.userNickname
    ? fallbackName
    : 'Give your bot a name';

  const handlePress = () => {
    if (!props.name.trim()) {
      props.onNameChange(fallbackName);
    }
    props.onActionPress();
  };

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: getTokenValue('$xl', 'size'),
          gap: getTokenValue('$2xl', 'size'),
        }}
      >
        <SplashTitle marginHorizontal={0}>
          Name your <Text color="$positiveActionText">bot.</Text>
        </SplashTitle>
        <SplashParagraph marginHorizontal={0} marginBottom={0}>
          Pick a name for your Tlonbot.
        </SplashParagraph>
        <Field label="Name">
          <TextInput
            value={props.name}
            onChangeText={props.onNameChange}
            placeholder={placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </Field>
      </ScrollView>
      <Button
        onPress={handlePress}
        label="Next"
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
}

export function BotAvatarPane(props: {
  avatarUrl?: string | null;
  onAvatarUrlChange: (url: string | null) => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();

  const handleImageChange = useCallback(
    (value?: string) => {
      props.onAvatarUrlChange(value ?? null);
    },
    [props]
  );

  // `ImageInput` emits the local URI the moment the user picks an image,
  // then swaps it for the remote CDN URL once upload finishes. Only the
  // remote URL is safe to persist. Uses the same `file|data` check as
  // `EditProfileScreenView` / `MetaEditorScreenView` so the convention
  // stays consistent across the app.
  const hasAvatar = !!props.avatarUrl;
  const isUploading = hasAvatar && !/^(?!file|data).+/.test(props.avatarUrl!);

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: getTokenValue('$xl', 'size'),
          gap: getTokenValue('$2xl', 'size'),
        }}
      >
        <SplashTitle marginHorizontal={0}>
          Choose an <Text color="$positiveActionText">avatar.</Text>
        </SplashTitle>
        <SplashParagraph marginHorizontal={0} marginBottom={0}>
          Pick an avatar for your Tlonbot, or skip and add one later.
        </SplashParagraph>
        <Field label="Avatar">
          <ImageInput
            value={props.avatarUrl ?? undefined}
            onChange={handleImageChange}
            buttonLabel="Upload image"
          />
        </Field>
      </ScrollView>
      <YStack paddingHorizontal="$xl" gap="$2xl" marginTop="$xl">
        {hasAvatar ? (
          <Button
            onPress={props.onActionPress}
            label={isUploading ? 'Uploading…' : 'Next'}
            preset="hero"
            shadow
            loading={isUploading}
            disabled={isUploading}
          />
        ) : null}
        <Button
          onPress={props.onActionPress}
          label="Skip"
          preset="secondary"
          fill="text"
          disabled={isUploading}
        />
      </YStack>
    </View>
  );
}

export function BotProviderPane(props: {
  model: string;
  apiKey: string;
  providers: { label: string; provider: string; requiresKey: boolean }[];
  loading?: boolean;
  error?: string | null;
  onModelChange: (model: string) => void;
  onApiKeyChange: (key: string) => void;
  onActionPress: () => void;
}) {
  const {
    model,
    apiKey,
    providers,
    loading,
    error,
    onModelChange,
    onApiKeyChange,
    onActionPress,
  } = props;
  const insets = useSafeAreaInsets();
  const selected = providers.find((p) => p.provider === model);
  const needsApiKey = selected?.requiresKey ?? false;
  const handlePasteApiKey = useCallback(async () => {
    try {
      const clipboardContents = isWeb
        ? await navigator.clipboard.readText()
        : await Clipboard.getString();
      onApiKeyChange(clipboardContents.trim());
    } catch (error) {
      logger.trackError('Wayfinding Bot API Key Paste Failed', {
        error,
        provider: selected?.provider ?? null,
      });
    }
  }, [onApiKeyChange, selected?.provider]);

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={isWeb ? 0 : insets.top}>
      <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
        <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
          <SplashTitle>
            Choose a <Text color="$positiveActionText">brain.</Text>
          </SplashTitle>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: getTokenValue('$xl', 'size'),
              gap: getTokenValue('$s', 'size'),
              paddingBottom: getTokenValue('$6xl', 'size'),
            }}
          >
            <SplashParagraph marginHorizontal={0} marginBottom="$m">
              {providers.some((p) => !p.requiresKey)
                ? 'A free model is included. Bring your own API key to use a different provider.'
                : 'Enter your API key to use a provider.'}
            </SplashParagraph>
            {providers.map((option) => (
              <ModelOptionCard
                key={option.provider}
                option={{
                  label: option.label,
                  description: option.requiresKey
                    ? 'Requires API key'
                    : 'Default (free, used as fallback)',
                }}
                selected={model === option.provider}
                onPress={() => onModelChange(option.provider)}
              />
            ))}
            {needsApiKey && (
              <Field
                label={`${selected?.label} API key`}
                error={error ?? undefined}
                marginTop="$xl"
              >
                <TextInput
                  value={apiKey}
                  onChangeText={onApiKeyChange}
                  placeholder="Paste your key here"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  rightControls={
                    <TextInput.InnerButton
                      label="Paste"
                      onPress={handlePasteApiKey}
                    />
                  }
                />
              </Field>
            )}
          </ScrollView>
        </YStack>
        <Button
          onPress={onActionPress}
          label={loading ? 'Validating...' : 'Next'}
          preset="hero"
          loading={loading}
          disabled={loading || (needsApiKey && !apiKey)}
          marginHorizontal="$xl"
          marginTop="$xl"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export function BotModelPane(props: {
  models: api.TlawnProviderModel[];
  selectedModel: string;
  loading?: boolean;
  error?: string | null;
  onSelectModel: (modelId: string) => void;
  onBackPress?: () => void;
  onActionPress: () => void;
}) {
  const {
    models,
    selectedModel,
    loading,
    error,
    onSelectModel,
    onBackPress,
    onActionPress,
  } = props;
  const insets = useSafeAreaInsets();
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  const visibleModels = useMemo(() => {
    const normalizedQuery = modelSearchQuery.trim().toLowerCase();
    const sortedModels = [...models].sort((a, b) => {
      if (a.id === selectedModel) return -1;
      if (b.id === selectedModel) return 1;
      return a.id.localeCompare(b.id, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    if (!normalizedQuery) {
      return sortedModels;
    }

    return sortedModels.filter((model) =>
      model.id.toLowerCase().includes(normalizedQuery)
    );
  }, [modelSearchQuery, models, selectedModel]);

  const handleModelListScrollBeginDrag = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <View paddingHorizontal="$xl">
          <ScreenHeader.BackButton
            onPress={loading ? undefined : onBackPress}
          />
        </View>
        <SplashTitle>
          Pick a <Text color="$positiveActionText">model.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={handleModelListScrollBeginDrag}
          contentContainerStyle={{
            paddingHorizontal: getTokenValue('$xl', 'size'),
            gap: getTokenValue('$s', 'size'),
          }}
        >
          <SplashParagraph marginHorizontal={0} marginBottom="$m">
            Your key is valid. Choose which model your Tlonbot should use.
          </SplashParagraph>
          <SearchBar
            placeholder="Search models"
            onChangeQuery={setModelSearchQuery}
            debounceTime={0}
            paddingBottom="$m"
            inputProps={{
              autoCapitalize: 'none',
              autoComplete: 'off',
              flex: 1,
            }}
          />
          <Text
            size="$label/m"
            color="$secondaryText"
            paddingBottom="$s"
            paddingHorizontal="$xs"
          >
            Showing {visibleModels.length} of {models.length} models
          </Text>
          {visibleModels.length ? (
            visibleModels.map((m) => (
              <ModelOptionCard
                key={m.id}
                option={{ label: m.id, description: '' }}
                selected={selectedModel === m.id}
                onPress={() => onSelectModel(m.id)}
              />
            ))
          ) : (
            <Text size="$body" color="$secondaryText" paddingVertical="$xl">
              No models match "{modelSearchQuery.trim()}".
            </Text>
          )}
          {error ? (
            <Text
              size="$label/m"
              color="$negativeActionText"
              paddingHorizontal="$xl"
              paddingTop="$l"
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </YStack>
      <Button
        onPress={onActionPress}
        label={loading ? 'Starting bot…' : 'Save'}
        preset="hero"
        loading={loading}
        disabled={loading || !selectedModel}
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
}

export function GroupsPane(props: {
  onActionPress: () => void;
  hostingBotEnabled?: boolean;
  botName?: string;
  didConfigureBot?: boolean;
  botSetupStatus?: CustomBotSetupStatus;
  userShipId?: string | null;
  botShipId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
  const { inviteUrl: homeGroupInviteUrl, state: homeGroupInviteState } =
    useHomeGroupInviteLink({
      enabled: !!props.hostingBotEnabled,
    });
  const groupInviteIsLoading = homeGroupInviteState === 'loading';
  const groupInviteIsReady = homeGroupInviteState === 'ready';
  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      {props.hostingBotEnabled ? (
        <View style={{ width: '100%', height: 368 }}>
          {props.userShipId && props.botShipId ? (
            <BotChatPreview
              userShipId={props.userShipId}
              botShipId={props.botShipId}
            />
          ) : null}
        </View>
      ) : (
        <ZStack height={368}>
          <Image
            style={{ width: '100%', height: 368 }}
            resizeMode="cover"
            source={
              isWeb
                ? isDark
                  ? `./garden-party-invite-dark.png`
                  : `./garden-party-invite.png`
                : isDark
                  ? require(`../../assets/raster/garden-party-invite-dark.png`)
                  : require(`../../assets/raster/garden-party-invite.png`)
            }
          />
        </ZStack>
      )}
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          {props.hostingBotEnabled ? (
            <>
              Your <Text color="$positiveActionText">group</Text> is ready.
            </>
          ) : (
            <>
              This is a <Text color="$positiveActionText">group.</Text>
            </>
          )}
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {props.hostingBotEnabled ? (
            <>
              <SplashParagraph>
                We made you a group on your server, and{' '}
                {props.didConfigureBot ? props.botName : 'your Tlonbot'} is
                already there.{' '}
                {props.didConfigureBot ? props.botName : 'Your Tlonbot'} loves
                conversation, reading along with the group and chiming in to
                help.
              </SplashParagraph>
              <SplashParagraph>
                Share the link below to bring your friends in.
              </SplashParagraph>
            </>
          ) : (
            <SplashParagraph>
              A group lives on your private personal server. Family chats, work
              collaboration, newsletters. A group can be anything you need.
            </SplashParagraph>
          )}
        </ScrollView>
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$2xl" marginTop="$xl">
        {props.hostingBotEnabled ? (
          <Button
            onPress={
              groupInviteIsReady && homeGroupInviteUrl
                ? () => shareTlonbotGroupInvite(homeGroupInviteUrl)
                : undefined
            }
            label={
              groupInviteIsReady
                ? 'Share invite link'
                : groupInviteIsLoading
                  ? 'Preparing invite link'
                  : 'Invite link unavailable'
            }
            intent="positive"
            size="large"
            leadingIcon={groupInviteIsLoading ? undefined : 'Link'}
            loading={groupInviteIsLoading}
            disabled={!groupInviteIsReady}
            glow
          />
        ) : null}
        <Button
          data-testid="got-it"
          testID="got-it"
          onPress={props.onActionPress}
          label="Got it"
          preset="secondary"
          fill="text"
        />
      </YStack>
    </View>
  );
}

export function ChannelsPane(props: {
  onActionPress: () => void;
  hostingBotEnabled?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <Image
        style={{ width: '100%', height: 382 }}
        resizeMode="contain"
        source={
          isWeb
            ? `./app-screens.png`
            : require(`../../assets/raster/app-screens.png`)
        }
      />
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          Groups contain <Text color="$positiveActionText">channels.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            Chats for quick messages, notebooks for longer thoughts, galleries
            for images and links. Everything happens in a channel.
          </SplashParagraph>
          {props.hostingBotEnabled && (
            <SplashParagraph>
              Mention your Tlonbot in any channel and it can search the web,
              summarize threads, or draft messages for you.
            </SplashParagraph>
          )}
        </ScrollView>
      </YStack>
      <Button
        data-testid="one-quick-thing"
        testID="one-quick-thing"
        onPress={props.onActionPress}
        label={
          props.hostingBotEnabled ? 'Invite your friends' : 'One quick thing'
        }
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
}

export function PrivacyPane(props: { onActionPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ZStack flex={1}>
      <PrivacyThumbprint />
      <View
        zIndex={1000}
        flex={1}
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <PrivacyLevelsDisplay />
        <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
          <SplashTitle>
            By default, groups are{' '}
            <Text color="$positiveActionText">secret.</Text>
          </SplashTitle>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <SplashParagraph>
              Only the people you invite can see your group. If you want to open
              it up to other people on the network, edit the privacy controls in
              your group settings.
            </SplashParagraph>
          </ScrollView>
        </YStack>
        <Button
          data-testid="invite-friends"
          testID="invite-friends"
          onPress={props.onActionPress}
          label="Invite your friends"
          preset="hero"
          shadow
          marginHorizontal="$xl"
          marginTop="$xl"
        />
      </View>
    </ZStack>
  );
}

const logger = createDevLogger('SplashSequence', true);

const INVITE_EXPLANATION_TEXT =
  "Anyone you invite will skip the waitlist. You'll receive a DM when they join.";

export function InviteContactsContent(props: {
  onComplete: () => void;
  systemContacts: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
  completing?: boolean;
}) {
  const inviteLink = db.personalInviteLink.useValue();
  const handleInviteContact = useInviteSystemContactHandler(
    props.inviteSystemContacts,
    inviteLink
  );
  const isReady = !!inviteLink;
  const hasContacts = props.systemContacts && props.systemContacts.length > 0;

  const { displayContacts, handleSearch } = useSystemContactSearch(
    props.systemContacts ?? []
  );

  return (
    <YStack flex={1}>
      <ScreenHeader
        title="Invite your friends"
        rightControls={
          <ScreenHeader.TextButton
            testID="finish-invites"
            disabled={props.completing}
            onPress={props.completing ? undefined : props.onComplete}
          >
            {props.completing ? 'Finishing...' : 'Next'}
          </ScreenHeader.TextButton>
        }
      />
      {!hasContacts ? (
        <ShareInviteLinkEmptyState />
      ) : !isReady ? (
        <LoadingState />
      ) : (
        <>
          <SplashParagraph marginTop="$l" marginBottom="$xl">
            {INVITE_EXPLANATION_TEXT}
          </SplashParagraph>
          <SearchBar
            paddingHorizontal="$xl"
            flexGrow={0}
            debounceTime={100}
            onChangeQuery={handleSearch}
            placeholder="Search contacts"
            inputProps={{
              spellCheck: false,
              autoCapitalize: 'none',
              autoComplete: 'off',
              flex: 1,
            }}
          />
          <FlatList
            data={displayContacts}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: getTokenValue('$l', 'size'),
              paddingBottom: getTokenValue('$4xl', 'size'),
            }}
            renderItem={({ item: contact }) => (
              <SystemContactListItem
                systemContact={contact}
                onPress={() => handleInviteContact(contact)}
                showInvitedStatus
              />
            )}
          />
        </>
      )}
    </YStack>
  );
}

function LoadingState() {
  const insets = useSafeAreaInsets();

  return (
    <YStack
      flex={1}
      paddingHorizontal="$xl"
      paddingBottom={insets.bottom + getTokenValue('$6xl', 'size')}
    >
      <SplashParagraph marginTop="$l">
        {INVITE_EXPLANATION_TEXT}
      </SplashParagraph>
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$xl">
        <LoadingSpinner size="large" />
        <Text size="$body" color="$secondaryText">
          Preparing your invite link
        </Text>
      </YStack>
    </YStack>
  );
}

function ShareInviteLinkEmptyState() {
  const insets = useSafeAreaInsets();
  const themeName = useThemeName();
  const isDark = themeName === 'dark';

  const facesImage = isDark
    ? isWeb
      ? `./faces-dark.png`
      : require(`../../assets/raster/faces-dark.png`)
    : isWeb
      ? `./faces.png`
      : require(`../../assets/raster/faces.png`);

  return (
    <YStack
      flex={1}
      justifyContent="flex-start"
      alignItems="center"
      paddingHorizontal="$xl"
      paddingBottom={insets.bottom}
    >
      <YStack alignItems="center" gap="$3xl" width="100%" maxWidth={340}>
        <View paddingTop="$5xl" paddingBottom={'$2xl'}>
          <Image
            style={{ width: 200, height: 141 }}
            resizeMode="contain"
            source={facesImage}
          />
        </View>
        <SplashParagraph marginHorizontal={0}>
          {INVITE_EXPLANATION_TEXT}
        </SplashParagraph>
        <View width="100%">
          <PersonalInviteButton />
        </View>
      </YStack>
    </YStack>
  );
}

function ConnectContactBookContent(props: {
  onConnectContacts: () => void;
  onSkip: () => void;
  isProcessing: boolean;
  isCompleting?: boolean;
  forceShowConnect?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const shouldShowConnectOption = props.forceShowConnect || !isWeb;

  const handleAction = shouldShowConnectOption
    ? props.onConnectContacts
    : props.onSkip;

  return (
    <View flex={1} paddingBottom={insets.bottom}>
      <InviteFriendsDisplay />
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          Works best with{' '}
          <Text color="$positiveActionText">people you know.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            When your friends join, they get their own private personal server
            too. Post together with peace of mind, for as long as your group
            exists.
          </SplashParagraph>
          {shouldShowConnectOption && (
            <SplashParagraph fontWeight="600" color="$primaryText">
              We don&#39;t store your contacts — they&#39;re only referenced by
              secure hash.
            </SplashParagraph>
          )}
        </ScrollView>
        {props.isProcessing && !isWeb && (
          <YStack alignItems="center">
            <LoadingSpinner />
          </YStack>
        )}
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$2xl">
        <Button
          data-testid="connect-contact-book"
          onPress={handleAction}
          label={
            props.isCompleting
              ? 'Finishing...'
              : shouldShowConnectOption
                ? 'Connect contact book'
                : 'Finish'
          }
          preset="hero"
          shadow
          disabled={props.isProcessing || props.isCompleting}
        />
        {shouldShowConnectOption && (
          <Button
            onPress={props.onSkip}
            label="Skip"
            preset="secondary"
            fill="text"
            disabled={props.isProcessing || props.isCompleting}
          />
        )}
      </YStack>
    </View>
  );
}

export function InvitePane(props: {
  onActionPress: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
  isCompleting?: boolean;
}) {
  const storeContext = useStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInviteContacts, setShowInviteContacts] = useState(false);
  const [sysContacts, setSysContacts] = useState<db.SystemContact[]>([]);
  const hasAutoProcessed = useRef(false);
  const perms = useContactPermissions();

  const processContacts = useCallback(async () => {
    try {
      setIsProcessing(true);
      await storeContext.syncSystemContacts();
      // Log analytics if no contacts were found
      const syncedContacts = await db.getSystemContacts();
      setSysContacts(syncedContacts);
      if (!syncedContacts || syncedContacts.length === 0) {
        logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped, {
          reason: 'no_contacts_synced',
        });
      }
    } catch (err) {
      logger.trackError('Failed to sync system contacts', { error: err });
    } finally {
      setIsProcessing(false);
      setShowInviteContacts(true);
    }
  }, [storeContext]);

  useEffect(() => {
    if (
      !isWeb &&
      perms.hasPermission &&
      !perms.isLoading &&
      !hasAutoProcessed.current
    ) {
      hasAutoProcessed.current = true;
      processContacts();
    }
  }, [perms.hasPermission, perms.isLoading, processContacts]);

  const handleConnectContacts = async () => {
    try {
      if (perms.canAskPermission) {
        const status = await perms.requestPermissions();
        if (status === 'granted') {
          await processContacts();
        }
      }
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorSystemContacts, {
        context: 'handleConnectContacts threw',
        error: e,
        severity: AnalyticsSeverity.Critical,
      });
    }
  };

  const handleSkip = () => {
    if (isWeb) {
      props.onActionPress();
      return;
    }
    logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped);
    setShowInviteContacts(true);
  };

  if (showInviteContacts) {
    return (
      <InviteContactsContent
        onComplete={props.onActionPress}
        systemContacts={sysContacts}
        inviteSystemContacts={props.inviteSystemContacts}
        completing={props.isCompleting}
      />
    );
  }

  return (
    <ConnectContactBookContent
      onConnectContacts={handleConnectContacts}
      onSkip={handleSkip}
      isProcessing={isProcessing}
      isCompleting={props.isCompleting}
    />
  );
}

function PrivacyLevelsDisplay() {
  return (
    <View
      style={
        isWeb
          ? {}
          : {
              shadowColor: '$shadow',
              shadowOffset: { width: 0, height: 12 },
              shadowRadius: 32,
            }
      }
      elevationAndroid={4}
      marginHorizontal="$l"
      marginVertical="$2xl"
    >
      <YStack paddingHorizontal="$3xl" justifyContent="center" gap="$xl">
        <ListItem
          backgroundColor="$positiveBackground"
          borderWidth={1}
          padding="$l"
          borderColor="$positiveBorder"
        >
          <ListItem.SystemIcon
            icon="Lock"
            backgroundColor="unset"
            color="$positiveActionText"
          />
          <ListItem.MainContent>
            <ListItem.Title color="$positiveActionText">Secret</ListItem.Title>
            <ListItem.Subtitle color="$positiveActionText">
              Invite-only
            </ListItem.Subtitle>
          </ListItem.MainContent>
        </ListItem>

        <ListItem
          backgroundColor="$background"
          borderWidth={1}
          padding="$l"
          borderColor="$border"
        >
          <ListItem.SystemIcon
            icon="EyeClosed"
            backgroundColor="unset"
            color="$primaryText"
          />
          <ListItem.MainContent>
            <ListItem.Title>Private</ListItem.Title>
            <ListItem.Subtitle>New members require approval</ListItem.Subtitle>
          </ListItem.MainContent>
        </ListItem>

        <ListItem
          backgroundColor="$background"
          borderWidth={1}
          padding="$l"
          borderColor="$border"
        >
          <ListItem.SystemIcon
            icon="EyeOpen"
            backgroundColor="unset"
            color="$primaryText"
          />
          <ListItem.MainContent>
            <ListItem.Title>Public</ListItem.Title>
            <ListItem.Subtitle>Everyone can find and join</ListItem.Subtitle>
          </ListItem.MainContent>
        </ListItem>
      </YStack>
    </View>
  );
}

const InviteFriendsDisplay = () => {
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <View marginBottom="$2xl" height={410}>
      <ZStack flex={1}>
        <View position="relative" top={-80} right={isWeb ? 120 : 0}>
          <Image
            style={{ width: '100%', height: 340 }}
            resizeMode="contain"
            source={
              isWeb
                ? isDark
                  ? `./tlon-ids-dark.png`
                  : `./tlon-ids.png`
                : isDark
                  ? require(`../../assets/raster/tlon-ids-dark.png`)
                  : require(`../../assets/raster/tlon-ids.png`)
            }
          />
        </View>
        <InviteCard position="absolute" bottom={0} right={30} />
      </ZStack>
    </View>
  );
};

const InviteCard = (props: ComponentProps<typeof View>) => {
  return (
    <View
      width={300}
      height={200}
      borderRadius="$xl"
      overflow="hidden"
      {...props}
    >
      <ZStack flex={1}>
        <Image
          style={{ width: 300, height: 200 }}
          resizeMode="cover"
          source={
            isWeb
              ? `./plant-light.png`
              : require(`../../assets/raster/plant-light.png`)
          }
        />
        <ZStack width="100%" height={50} position="absolute" bottom={0}>
          <View flex={1} backgroundColor="$black" opacity={0.4} />
          <YStack flex={1} justifyContent="center" marginLeft="$l" gap="$m">
            <Text size="$label/s" color="$white" fontWeight="500">
              Tlon Messenger: kylie invited you to The Garden
            </Text>
            <Text size="$label/s" color="$white" opacity={0.8}>
              join.tlon.io
            </Text>
          </YStack>
        </ZStack>
      </ZStack>
    </View>
  );
};

function ModelOptionCard({
  option,
  selected,
  onPress,
}: {
  option: { label: string; description: string };
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <ListItem
        backgroundColor={selected ? '$positiveBackground' : '$background'}
        borderWidth={1}
        borderColor={selected ? '$positiveActionText' : '$border'}
      >
        <ListItem.MainContent>
          <ListItem.Title
            color={selected ? '$positiveActionText' : '$primaryText'}
          >
            {option.label}
          </ListItem.Title>
          {option.description && (
            <ListItem.Subtitle
              color={selected ? '$positiveActionText' : '$secondaryText'}
            >
              {option.description}
            </ListItem.Subtitle>
          )}
        </ListItem.MainContent>
        {selected && (
          <ListItem.EndContent>
            <Icon type="Checkmark" color="$positiveActionText" />
          </ListItem.EndContent>
        )}
      </ListItem>
    </Pressable>
  );
}
