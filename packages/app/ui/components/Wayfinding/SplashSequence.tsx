// tamagui-ignore
import Clipboard from '@react-native-clipboard/clipboard';
import * as api from '@tloncorp/api';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Attachment, DEFAULT_BOT_CONFIG } from '@tloncorp/shared/domain';
import { withRetry } from '@tloncorp/shared/logic';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import {
  Button,
  Icon,
  KeyboardAvoidingView,
  LoadingSpinner,
  Pressable,
  Text,
  useToast,
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
import {
  AttachmentProvider,
  useAttachmentContext,
  useMappedImageAttachments,
} from '../../contexts/attachment';
import { useStore } from '../../contexts/storeContext';
import { useSystemContactSearch } from '../../hooks/systemContactSorters';
import AttachmentSheet from '../AttachmentSheet';
import { Field, RawTextInput, TextInput } from '../Form';
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
 *   Welcome → TlonBot → BotName → BotAvatar → BotProvider
 *     → (BotApiKey if provider requires key) → BotModel → Group → Invite
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
  BotApiKey = 'BotApiKey',
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
  const [botName, setBotName] = React.useState('');
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

        logger.trackEvent('Wayfinding Bot Identity Sync Completed', meta);
      })();
    },
    []
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
      // Require an explicit model pick on BotModelPane. `handleSaveModelConfig`
      // falls back to `${provider}/auto` on save if the list ever comes up empty.
      setBotPrimaryModel('');
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

  // When the user advances from BotProviderPane: if the chosen provider needs
  // a key, step into BotApiKey; otherwise (e.g. the free basic provider) fall
  // straight through to the validate/save path.
  const handleProviderSelected = useCallback(() => {
    setConfigError(null);
    const provider = botModel || BASIC_PROVIDER_ID;
    const selected = providerOptions.find((p) => p.provider === provider);
    if (selected?.requiresKey) {
      setCurrentPane(SplashPane.BotApiKey);
      return;
    }
    handleValidateProvider();
  }, [botModel, providerOptions, handleValidateProvider]);

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
            onBackPress={() => setCurrentPane(SplashPane.BotName)}
            onActionPress={handleBotAvatarCompleted}
          />
        )}
        {currentPane === SplashPane.BotProvider && (
          <BotProviderPane
            model={botModel}
            providers={providerOptions}
            loading={savingConfig}
            error={configError}
            onModelChange={setBotModel}
            onBackPress={() => setCurrentPane(SplashPane.BotAvatar)}
            onActionPress={handleProviderSelected}
          />
        )}
        {currentPane === SplashPane.BotApiKey && (
          <BotApiKeyPane
            providerLabel={
              providerOptions.find((p) => p.provider === botModel)?.label ??
              botModel
            }
            apiKey={botApiKey}
            loading={savingConfig}
            error={configError}
            onApiKeyChange={setBotApiKey}
            onBackPress={() => setCurrentPane(SplashPane.BotProvider)}
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
  const [error, setError] = useState<string | null>(null);
  const handleNameChange = (value: string) => {
    setError(null);
    props.onNameChange(value);
  };

  const handlePress = () => {
    if (!props.name.trim()) {
      setError('Please give your bot a name.');
      return;
    }
    props.onActionPress();
  };

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <SplashTitle>
            Name your <Text color="$positiveActionText">bot.</Text>
          </SplashTitle>
          <YStack paddingHorizontal="$xl" gap="$m">
            <View
              borderBottomWidth={1}
              borderBottomColor={error ? '$negativeBorder' : '$tertiaryText'}
              paddingBottom="$m"
            >
              <RawTextInput
                value={props.name}
                onChangeText={handleNameChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                autoFocus
                fontSize="$l"
                color="$primaryText"
                placeholderTextColor="$tertiaryText"
              />
            </View>
            <Text
              size="$label/m"
              color={error ? '$negativeActionText' : '$secondaryText'}
            >
              {error ?? 'Pick a name for your Tlonbot.'}
            </Text>
          </YStack>
        </YStack>
        <Button
          onPress={handlePress}
          label="Next"
          preset="hero"
          shadow
          marginHorizontal="$xl"
          marginTop="$xl"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export function BotAvatarPane(props: {
  avatarUrl?: string | null;
  onAvatarUrlChange: (url: string | null) => void;
  onBackPress?: () => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { canUpload } = useAttachmentContext();
  const showToast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Local URIs (file:// or data:) mean the upload is still pending; once the
  // attachment pipeline swaps in the remote CDN URL, the avatar is safe to
  // persist. Same check used in EditProfileScreenView.
  const hasAvatar = !!props.avatarUrl;
  const isUploading = hasAvatar && !/^(?!file|data).+/.test(props.avatarUrl!);

  const { attachment } = useMappedImageAttachments(
    props.avatarUrl ? { attachment: props.avatarUrl } : {}
  );

  useEffect(() => {
    if (!attachment) return;
    if (attachment.uploadState?.status === 'success') {
      const remote = attachment.uploadState.remoteUri;
      if (remote && remote !== props.avatarUrl) {
        props.onAvatarUrlChange(remote);
      }
    } else if (attachment.uploadState?.status === 'error') {
      const msg = attachment.uploadState.errorMessage || 'Upload failed';
      showToast({
        message: `Failed to upload image: ${msg}`,
        duration: 5000,
      });
      props.onAvatarUrlChange(null);
    }
  }, [attachment, props, showToast]);

  const openSheet = useCallback(() => {
    if (!canUpload) {
      showToast({
        message: 'Please configure storage settings to upload images',
        duration: 3000,
      });
      return;
    }
    setSheetOpen(true);
  }, [canUpload, showToast]);

  const handleImageSelected = useCallback(
    (assets: Attachment.UploadIntent[]) => {
      const uri =
        Attachment.UploadIntent.extractImagePickerAssets(assets)[0]?.uri;
      if (uri) {
        props.onAvatarUrlChange(uri);
      }
    },
    [props]
  );

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        {props.onBackPress ? (
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton
              onPress={isUploading ? undefined : props.onBackPress}
            />
          </View>
        ) : null}
        <SplashTitle>
          Choose an <Text color="$positiveActionText">avatar.</Text>
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          Pick an avatar for your Tlonbot, or skip and add one later.
        </SplashParagraph>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Pressable onPress={openSheet} disabled={!canUpload || isUploading}>
            <View
              width={160}
              height={160}
              borderRadius={80}
              backgroundColor="$secondaryBackground"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {hasAvatar ? (
                <Image
                  source={{ uri: props.avatarUrl! }}
                  style={{ width: 160, height: 160 }}
                />
              ) : (
                <Icon
                  type="Camera"
                  customSize={[72, 72]}
                  color="$tertiaryText"
                />
              )}
              {isUploading ? (
                <View
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$shadow"
                >
                  <LoadingSpinner />
                </View>
              ) : null}
            </View>
          </Pressable>
        </YStack>
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$l" marginTop="$xl">
        {hasAvatar ? (
          <>
            <Button
              onPress={openSheet}
              label="Change photo"
              preset="secondary"
              disabled={!canUpload || isUploading}
            />
            <Button
              onPress={props.onActionPress}
              label={isUploading ? 'Uploading…' : 'Continue'}
              preset="hero"
              shadow
              loading={isUploading}
              disabled={isUploading}
            />
          </>
        ) : (
          <>
            <Button
              onPress={openSheet}
              label="Upload photo"
              preset="hero"
              shadow
              disabled={!canUpload}
            />
            <Button
              onPress={props.onActionPress}
              label="Skip"
              preset="secondary"
              fill="text"
            />
          </>
        )}
      </YStack>
      <AttachmentSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        onAttach={handleImageSelected}
        showClearOption={hasAvatar}
        onClearAttachments={() => props.onAvatarUrlChange(null)}
        mediaType="image"
      />
    </View>
  );
}

export function BotProviderPane(props: {
  model: string;
  providers: { label: string; provider: string; requiresKey: boolean }[];
  loading?: boolean;
  error?: string | null;
  onModelChange: (model: string) => void;
  onBackPress?: () => void;
  onActionPress: () => void;
}) {
  const {
    model,
    providers,
    loading,
    error,
    onModelChange,
    onBackPress,
    onActionPress,
  } = props;
  const insets = useSafeAreaInsets();

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        {onBackPress ? (
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton
              onPress={loading ? undefined : onBackPress}
            />
          </View>
        ) : null}
        <SplashTitle>
          Choose a <Text color="$positiveActionText">brain.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{
            paddingHorizontal: getTokenValue('$xl', 'size'),
            gap: getTokenValue('$s', 'size'),
            paddingBottom: getTokenValue('$6xl', 'size'),
          }}
        >
          <SplashParagraph marginHorizontal={0} marginBottom="$m">
            {providers.some((p) => !p.requiresKey)
              ? 'A free model is included. Bring your own API key to use a different provider.'
              : 'Pick a provider, then enter your API key on the next screen.'}
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
        label={loading ? 'Validating...' : 'Next'}
        preset="hero"
        loading={loading}
        disabled={loading || !model}
        marginHorizontal="$xl"
        marginTop="$xl"
      />
    </View>
  );
}

export function BotApiKeyPane(props: {
  providerLabel: string;
  apiKey: string;
  loading?: boolean;
  error?: string | null;
  onApiKeyChange: (key: string) => void;
  onBackPress: () => void;
  onActionPress: () => void;
}) {
  const {
    providerLabel,
    apiKey,
    loading,
    error,
    onApiKeyChange,
    onBackPress,
    onActionPress,
  } = props;
  const insets = useSafeAreaInsets();

  const handlePasteApiKey = useCallback(async () => {
    try {
      const clipboardContents = isWeb
        ? await navigator.clipboard.readText()
        : await Clipboard.getString();
      onApiKeyChange(clipboardContents.trim());
    } catch (error) {
      logger.trackError('Wayfinding Bot API Key Paste Failed', {
        error,
        provider: providerLabel,
      });
    }
  }, [onApiKeyChange, providerLabel]);

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
        <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton
              onPress={loading ? undefined : onBackPress}
            />
          </View>
          <SplashTitle>
            Add your <Text color="$positiveActionText">API key.</Text>
          </SplashTitle>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: getTokenValue('$xl', 'size'),
              gap: getTokenValue('$2xl', 'size'),
            }}
          >
            <SplashParagraph marginHorizontal={0} marginBottom={0}>
              Paste your {providerLabel} key so your bot can talk to the
              provider. Your key stays on your server.
            </SplashParagraph>
            <Field
              label={`${providerLabel} API key`}
              error={error ?? undefined}
            >
              <TextInput
                value={apiKey}
                onChangeText={onApiKeyChange}
                placeholder="Paste your key here"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                autoFocus
                rightControls={
                  <TextInput.InnerButton
                    label="Paste"
                    onPress={handlePasteApiKey}
                  />
                }
              />
            </Field>
          </ScrollView>
        </YStack>
        <Button
          onPress={onActionPress}
          label={loading ? 'Validating...' : 'Next'}
          preset="hero"
          loading={loading}
          disabled={loading || !apiKey}
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
    const sortedModels = [...models].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );

    if (!normalizedQuery) {
      return sortedModels;
    }

    return sortedModels.filter((model) =>
      model.id.toLowerCase().includes(normalizedQuery)
    );
  }, [modelSearchQuery, models]);

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
