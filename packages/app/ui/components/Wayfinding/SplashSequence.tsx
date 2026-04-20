// tamagui-ignore
import * as api from '@tloncorp/api';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { DEFAULT_BOT_CONFIG } from '@tloncorp/shared/domain';
import { Button, Icon, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, Image, ScrollView, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  XStack,
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
import { useStore } from '../../contexts/storeContext';
import { useSystemContactSearch } from '../../hooks/systemContactSorters';
import { AvatarPicker } from '../AvatarPicker';
import { Field, TextInput } from '../Form';
import { ListItem } from '../ListItem';
import { PersonalInviteButton } from '../PersonalInviteButton';
import { ScreenHeader } from '../ScreenHeader';
import { SearchBar } from '../SearchBar';
import { SystemContactListItem } from '../listItems';
import { BotChatPreview } from './BotChatPreview';
import { validateProviderKey } from './providerKeyValidation';
import { PrivacyThumbprint } from './visuals/PrivacyThumbprint';

/**
 * Splash sequence panes.
 *
 * Bot-enabled flow:
 *   Welcome → TlonBot → BotName → BotProvider → BotModel → Group → Invite
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
  BotProvider = 'BotProvider',
  BotModel = 'BotModel',
  Invite = 'Invite',
}

function SplashSequenceComponent(props: {
  onCompleted: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
  hostingBotEnabled?: boolean;
}) {
  const store = useStore();
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

  // Save nickname and avatar; basic is the user's default so no primary-model
  // poke is needed there.
  const saveNicknameAndAvatar = useCallback(async () => {
    const shipId = await db.hostedUserNodeId.getValue();
    if (!shipId) return;
    const name = botName || 'Tlonbot';
    await Promise.allSettled([
      api.setTlawnNickname(shipId, name),
      avatarDirty && botAvatarUrl
        ? api.setTlawnAvatar(shipId, botAvatarUrl)
        : Promise.resolve(),
    ]);
  }, [botName, avatarDirty, botAvatarUrl]);

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
      if (!userId) return;

      const provider = botModel || BASIC_PROVIDER_ID;
      const selected = providerOptions.find((p) => p.provider === provider);

      if (provider === BASIC_PROVIDER_ID) {
        await saveNicknameAndAvatar();
        setSavingConfig(false);
        setDidConfigureBot(true);
        setCurrentPane(SplashPane.Group);
        return;
      }

      if (selected?.requiresKey) {
        const keyError = validateProviderKey(provider, botApiKey);
        if (keyError) {
          setConfigError(keyError);
          setSavingConfig(false);
          return;
        }
        await api.setTlawnProviderKey(userId, provider, botApiKey);
      }

      const result = await api.getTlawnProviderModels(userId, provider);
      setProviderModels(result.data);
      setBotPrimaryModel(result.data[0]?.id ?? `${provider}/auto`);

      setSavingConfig(false);
      setCurrentPane(SplashPane.BotModel);
    } catch (e) {
      console.error('Failed to validate provider during onboarding:', e);
      setConfigError(
        'Could not validate provider. Check your API key and try again.'
      );
      setSavingConfig(false);
    }
  }, [botModel, botApiKey, providerOptions, saveNicknameAndAvatar]);

  // Step 2 (non-basic only): persist chosen model along with nickname/avatar.
  const handleSaveBotConfig = useCallback(async () => {
    setSavingConfig(true);
    setConfigError(null);
    try {
      const userId = await db.hostingUserId.getValue();
      if (!userId) return;

      const provider = botModel || BASIC_PROVIDER_ID;
      const model = botPrimaryModel || `${provider}/auto`;

      await Promise.allSettled([
        saveNicknameAndAvatar(),
        api.setTlawnPrimaryModel(userId, { provider, model }),
      ]);

      setSavingConfig(false);
      setDidConfigureBot(true);
      setCurrentPane(SplashPane.Group);
    } catch (e) {
      console.error('Failed to save bot config during onboarding:', e);
      setSavingConfig(false);
    }
  }, [botModel, botPrimaryModel, saveNicknameAndAvatar]);

  const handleSplashCompleted = useCallback(() => {
    store.completeWayfindingSplash();
    props.onCompleted();
  }, [props, store]);

  return (
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
          onSkip={() => setCurrentPane(SplashPane.Group)}
        />
      )}
      {currentPane === SplashPane.BotName && (
        <BotNamePane
          name={botName}
          avatarUrl={avatarDirty ? botAvatarUrl : null}
          userNickname={userNickname}
          onNameChange={setBotName}
          onAvatarUrlChange={handleAvatarUrlChange}
          onActionPress={() => setCurrentPane(SplashPane.BotProvider)}
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
          onSelectModel={setBotPrimaryModel}
          onActionPress={handleSaveBotConfig}
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
        <PrivacyPane onActionPress={() => setCurrentPane(SplashPane.Invite)} />
      )}

      {currentPane === SplashPane.Invite && (
        <InvitePane
          onActionPress={handleSplashCompleted}
          inviteSystemContacts={props.inviteSystemContacts}
        />
      )}
    </View>
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
            Everything here is stored on your private server–only you can
            access it.
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

export function TlonBotPane(props: {
  onActionPress: () => void;
  onSkip?: () => void;
}) {
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
        {props.onSkip && (
          <>
            <Button
              onPress={props.onSkip}
              testID="bot-skip"
              label="Skip"
              preset="secondary"
              fill="text"
            />
            <Text
              fontSize={12}
              color="$tertiaryText"
              textAlign="center"
              marginBottom="$xs"
            >
              You can always configure your bot later in Settings.
            </Text>
          </>
        )}
      </YStack>
    </View>
  );
}

export function BotNamePane(props: {
  name: string;
  avatarUrl?: string | null;
  userNickname?: string | null;
  onNameChange: (name: string) => void;
  onAvatarUrlChange: (url: string | null) => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const placeholder = props.userNickname
    ? `${props.userNickname}'s Tlonbot`
    : 'Give your bot a name';

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          Name your <Text color="$positiveActionText">bot.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: getTokenValue('$xl', 'size'),
          }}
        >
          <SplashParagraph marginHorizontal={0} marginBottom="$xl">
            Pick a name and avatar for your Tlonbot.
          </SplashParagraph>

          <Field label="Name" marginBottom="$xl">
            <TextInput
              value={props.name}
              onChangeText={props.onNameChange}
              placeholder={placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </Field>

          <SplashParagraph
            marginHorizontal={0}
            marginBottom="$s"
            color="$tertiaryText"
          >
            Choose an avatar
          </SplashParagraph>
          <AvatarPicker
            value={props.avatarUrl ?? null}
            onSelect={props.onAvatarUrlChange}
          />
        </ScrollView>
      </YStack>
      <Button
        onPress={props.onActionPress}
        label="Next"
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginTop="$xl"
      />
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

  return (
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
          contentContainerStyle={{
            paddingHorizontal: getTokenValue('$xl', 'size'),
            gap: getTokenValue('$s', 'size'),
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
  );
}

export function BotModelPane(props: {
  models: api.TlawnProviderModel[];
  selectedModel: string;
  loading?: boolean;
  onSelectModel: (modelId: string) => void;
  onActionPress: () => void;
}) {
  const { models, selectedModel, loading, onSelectModel, onActionPress } =
    props;
  const insets = useSafeAreaInsets();

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          Pick a <Text color="$positiveActionText">model.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{
            paddingHorizontal: getTokenValue('$xl', 'size'),
            gap: getTokenValue('$s', 'size'),
          }}
        >
          <SplashParagraph marginHorizontal={0} marginBottom="$m">
            Your key is valid. Choose which model your Tlonbot should use.
          </SplashParagraph>
          {models.map((m) => (
            <ModelOptionCard
              key={m.id}
              option={{ label: m.id, description: '' }}
              selected={selectedModel === m.id}
              onPress={() => onSelectModel(m.id)}
            />
          ))}
        </ScrollView>
      </YStack>
      <Button
        onPress={onActionPress}
        label={loading ? 'Saving...' : 'Save'}
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
  userShipId?: string | null;
  botShipId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const homeGroupInviteLink = db.homeGroupInviteLink.useValue();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
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
      <YStack flex={1} gap={'$2xl'} paddingTop="$xl">
        <SplashTitle>
          {props.hostingBotEnabled ? (
            <>
              {props.didConfigureBot && props.botName
                ? props.botName
                : 'Your Tlonbot'}{' '}
              works in groups{' '}
              <Text color="$positiveActionText">with others.</Text>
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
            <SplashParagraph marginBottom={0}>
              {props.didConfigureBot ? props.botName : 'Your Tlonbot'} lives in
              groups, reading messages and helping everyone. Groups last
              forever on your server. Invite friends–
              {props.didConfigureBot ? props.botName : 'your bot'} will be
              there too.
            </SplashParagraph>
          ) : (
            <SplashParagraph>
              A group lives on your private personal server. Family chats, work
              collaboration, newsletters. A group can be anything you need.
            </SplashParagraph>
          )}
        </ScrollView>
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$2xl" marginTop="$xl">
        <Button
          onPress={() =>
            shareTlonbotGroupInvite(
              homeGroupInviteLink ? homeGroupInviteLink : ''
            )
          }
          label="Share invite with friends"
          preset="hero"
          leadingIcon="AddPerson"
          shadow
        />
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
            onPress={props.onComplete}
          >
            Next
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
          <XStack paddingHorizontal="$xl">
            <SearchBar
              height="$4xl"
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
          </XStack>
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
          label={shouldShowConnectOption ? 'Connect contact book' : 'Finish'}
          preset="hero"
          shadow
          disabled={props.isProcessing}
        />
        {shouldShowConnectOption && (
          <Button
            onPress={props.onSkip}
            label="Skip"
            preset="secondary"
            fill="text"
            disabled={props.isProcessing}
          />
        )}
      </YStack>
    </View>
  );
}

export function InvitePane(props: {
  onActionPress: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
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
      />
    );
  }

  return (
    <ConnectContactBookContent
      onConnectContacts={handleConnectContacts}
      onSkip={handleSkip}
      isProcessing={isProcessing}
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
