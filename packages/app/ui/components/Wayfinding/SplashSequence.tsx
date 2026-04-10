// tamagui-ignore
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, Image, ScrollView, Share, TextInput as RNTextInput } from 'react-native';
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
import { useStore } from '../../contexts';
import { useSystemContactSearch } from '../../hooks/systemContactSorters';
import { ListItem, SystemContactListItem } from '../ListItem';
import { saveBotConfig } from '@tloncorp/shared/api';
import {
  DEFAULT_BOT_CONFIG,
  MODEL_OPTIONS,
  PERSONALITY_TYPES,
  SUGGESTED_EMOJIS,
  SUGGESTED_NAMES,
  type BotConfig,
  type PersonalityType,
} from '@tloncorp/shared/domain';
import { EmojiPicker } from '../EmojiPicker';
import { NameSuggestions } from '../NameSuggestions';
import { PersonalityCard } from '../PersonalityCard';
import { PersonalInviteButton } from '../PersonalInviteButton';
import { ScreenHeader } from '../ScreenHeader';
import { SearchBar } from '../SearchBar';
import { PrivacyThumbprint } from './visuals/PrivacyThumbprint';

enum SplashPane {
  Welcome = 'Welcome',
  Group = 'Group',
  Channels = 'Channels',
  Privacy = 'Privacy',
  TlonBot = 'TlonBot',
  BotName = 'BotName',
  BotPersonality = 'BotPersonality',
  BotModel = 'BotModel',
  BotLaunch = 'BotLaunch',
  BotLaunchLoading = 'BotLaunchLoading',
  ShareGroup = 'ShareGroup',
  Invite = 'Invite',
}

function SplashSequenceComponent(props: {
  onCompleted: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
  hostingBotEnabled?: boolean;
}) {
  const store = useStore();
  const [currentPane, setCurrentPane] = React.useState<SplashPane>(
    SplashPane.Welcome
  );
  const { hostingBotEnabled } = props;
  const [botName, setBotName] = React.useState(DEFAULT_BOT_CONFIG.name);
  const [botEmoji, setBotEmoji] = React.useState(DEFAULT_BOT_CONFIG.emoji);
  const [botPersonality, setBotPersonality] = React.useState<PersonalityType>(
    DEFAULT_BOT_CONFIG.personalityType
  );
  const [botModel, setBotModel] = React.useState(DEFAULT_BOT_CONFIG.model);
  const [botApiKey, setBotApiKey] = React.useState('');

  const handleSplashCompleted = useCallback(() => {
    store.completeWayfindingSplash();
    props.onCompleted();
  }, [props, store]);

  return (
    <View flex={1}>
      {currentPane === 'Welcome' && (
        <WelcomePane
          onActionPress={() =>
            setCurrentPane(
              hostingBotEnabled ? SplashPane.TlonBot : SplashPane.Group
            )
          }
          hostingBotEnabled={hostingBotEnabled}
        />
      )}
      {currentPane === 'TlonBot' && (
        <TlonBotPane
          onActionPress={() => setCurrentPane(SplashPane.BotName)}
          onSkip={() => setCurrentPane(SplashPane.Group)}
        />
      )}
      {currentPane === 'BotName' && (
        <BotNamePane
          name={botName}
          emoji={botEmoji}
          onNameChange={setBotName}
          onEmojiChange={setBotEmoji}
          onActionPress={() => setCurrentPane(SplashPane.BotPersonality)}
        />
      )}
      {currentPane === 'BotPersonality' && (
        <BotPersonalityPane
          personality={botPersonality}
          onPersonalityChange={setBotPersonality}
          onActionPress={() => setCurrentPane(SplashPane.BotModel)}
        />
      )}
      {currentPane === 'BotModel' && (
        <BotModelPane
          model={botModel}
          apiKey={botApiKey}
          onModelChange={setBotModel}
          onApiKeyChange={setBotApiKey}
          onActionPress={async () => {
            const config: BotConfig = {
              name: botName || 'Tlonbot',
              emoji: botEmoji,
              personalityType: botPersonality,
              model: botModel,
              apiKey: botApiKey || undefined,
              responseStyle: 'balanced',
              activeHoursStart: 0,
              activeHoursEnd: 24,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            };
            try {
              await saveBotConfig(config);
            } catch (e) {
              console.error('Failed to save bot config during onboarding:', e);
            }
            setCurrentPane(SplashPane.BotLaunch);
          }}
        />
      )}
      {currentPane === 'BotLaunch' && (
        <BotLaunchPane
          botName={botName || 'Tlonbot'}
          botEmoji={botEmoji}
          onCreateGroup={() => {
            setCurrentPane(SplashPane.BotLaunchLoading);
            // TODO: wire up actual group creation + bot invite + branch link
            // For now, simulate the loading period then show share screen
            setTimeout(() => {
              setCurrentPane(SplashPane.ShareGroup);
            }, 3000);
          }}
          onSkip={() => setCurrentPane(SplashPane.Group)}
        />
      )}
      {currentPane === 'BotLaunchLoading' && (
        <BotLaunchLoadingPane botEmoji={botEmoji} />
      )}
      {currentPane === 'ShareGroup' && (
        <ShareGroupPane
          botName={botName || 'Tlonbot'}
          botEmoji={botEmoji}
          onActionPress={handleSplashCompleted}
        />
      )}
      {currentPane === 'Group' && (
        <GroupsPane
          onActionPress={() => setCurrentPane(SplashPane.Channels)}
          hostingBotEnabled={props.hostingBotEnabled}
        />
      )}
      {currentPane === 'Channels' && (
        <ChannelsPane
          onActionPress={() =>
            setCurrentPane(
              hostingBotEnabled ? SplashPane.Invite : SplashPane.Privacy
            )
          }
          hostingBotEnabled={hostingBotEnabled}
        />
      )}
      {currentPane === 'Privacy' && (
        <PrivacyPane onActionPress={() => setCurrentPane(SplashPane.Invite)} />
      )}
      {currentPane === 'Invite' && (
        <InvitePane
          onActionPress={handleSplashCompleted}
          inviteSystemContacts={props.inviteSystemContacts}
        />
      )}
    </View>
  );
}

export const SplashSequence = React.memo(SplashSequenceComponent);

const SplashTitle = styled(Text, {
  fontSize: 34,
  lineHeight: 38,
  letterSpacing: -0.374,
  fontWeight: '600',
  marginHorizontal: '$xl',
});

const SplashSubtitle = styled(Text, {
  fontSize: 20,
  lineHeight: 24,
  letterSpacing: -0.408,
  fontWeight: '500',
  marginHorizontal: '$xl',
  color: '$secondaryText',
});

const SplashParagraph = styled(Text, {
  fontSize: 16,
  lineHeight: 24,
  letterSpacing: -0.032,
  fontWeight: '400',
  marginHorizontal: '$xl',
  marginBottom: '$l',
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
      <YStack flex={1} gap={'$xl'} paddingTop="$2xl">
        <SplashTitle>
          Welcome to{'\n'}Tlon{' '}
          <Text color="$positiveActionText">Messenger.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            Everything here lives on your personal cloud computer, a server
            that only you can access. Your messages, your data, your rules.
          </SplashParagraph>
          {props.hostingBotEnabled && (
            <SplashParagraph>
              Your account also comes with an AI agent called Tlonbot that can
              search the web, summarize threads, and help you stay organized.
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
    <View flex={1}>
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
      <YStack flex={1} gap={'$xl'} paddingTop="$xl">
        <SplashTitle>
          Meet your{'\n'}
          <Text color="$positiveActionText">Tlonbot.</Text>
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
            Your API keys, your agent's memory, and everything it learns stays
            on your personal node. You own it all.
          </SplashParagraph>
        </ScrollView>
      </YStack>
      <YStack
        paddingHorizontal="$xl"
        paddingBottom={insets.bottom}
        gap="$l"
      >
        <Button
          onPress={props.onActionPress}
          testID="bot-configure"
          label="Configure now"
          preset="hero"
          shadow
        />
        {props.onSkip && (
          <Button
            onPress={props.onSkip}
            testID="bot-skip"
            label="Skip"
            preset="secondary"
            fill="text"
          />
        )}
        <Text
          fontSize={12}
          color="$tertiaryText"
          textAlign="center"
          marginBottom="$xs"
        >
          You can always configure your bot later in Settings.
        </Text>
      </YStack>
    </View>
  );
}

function BotNamePane(props: {
  name: string;
  emoji: string;
  onNameChange: (name: string) => void;
  onEmojiChange: (emoji: string) => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useThemeName();
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1818';
  const placeholderColor = theme === 'dark' ? '#808080' : '#999999';

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$xl'} paddingTop="$3xl">
        <SplashTitle>
          Name your{'\n'}
          <Text color="$positiveActionText">bot.</Text>
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
            Pick a name and emoji for your Tlonbot. You can always change this
            later.
          </SplashParagraph>

          {/* Live Preview */}
          <XStack
            alignItems="center"
            gap="$m"
            padding="$l"
            borderRadius="$xl"
            backgroundColor="$secondaryBackground"
            marginBottom="$xl"
          >
            <Text fontSize={36}>{props.emoji}</Text>
            <Text fontSize={20} fontWeight="600" color="$primaryText">
              {props.name || 'Your Bot'}
            </Text>
          </XStack>

          {/* Name Input */}
          <YStack gap="$s" marginBottom="$xl">
            <View
              borderRadius="$xl"
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$secondaryBackground"
              paddingHorizontal="$l"
              paddingVertical="$m"
            >
              <RNTextInput
                value={props.name}
                onChangeText={props.onNameChange}
                placeholder="Give your bot a name"
                placeholderTextColor={placeholderColor}
                style={{
                  fontSize: 16,
                  color: textColor,
                }}
              />
            </View>
            <NameSuggestions
              onSelect={props.onNameChange}
              currentValue={props.name}
            />
          </YStack>

          {/* Emoji Picker */}
          <SplashParagraph marginHorizontal={0} marginBottom="$s" color="$tertiaryText">
            Choose an emoji
          </SplashParagraph>
          <View flexDirection="row" flexWrap="wrap" gap="$s">
            {SUGGESTED_EMOJIS.map((emoji) => (
              <Pressable key={emoji} onPress={() => props.onEmojiChange(emoji)}>
                <View
                  width={48}
                  height={48}
                  borderRadius="$m"
                  borderWidth={2}
                  borderColor={
                    props.emoji === emoji ? '$positiveActionText' : '$border'
                  }
                  backgroundColor={
                    props.emoji === emoji
                      ? '$positiveBackground'
                      : '$secondaryBackground'
                  }
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={24}>{emoji}</Text>
                </View>
              </Pressable>
            ))}
          </View>
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

function BotPersonalityPane(props: {
  personality: PersonalityType;
  onPersonalityChange: (p: PersonalityType) => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$xl'} paddingTop="$3xl">
        <SplashTitle>
          Give it a{'\n'}
          <Text color="$positiveActionText">persona.</Text>
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
            This shapes how your bot talks and thinks.
          </SplashParagraph>
          {PERSONALITY_TYPES.map((option) => (
            <PersonalityCard
              key={option.value}
              option={option}
              selected={props.personality === option.value}
              onPress={() => props.onPersonalityChange(option.value)}
            />
          ))}
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

function BotModelPane(props: {
  model: string;
  apiKey: string;
  onModelChange: (model: string) => void;
  onApiKeyChange: (key: string) => void;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useThemeName();
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1818';
  const placeholderColor = theme === 'dark' ? '#808080' : '#999999';
  const selectedOption = MODEL_OPTIONS.find((o) => o.value === props.model);
  const needsApiKey = selectedOption?.requiresKey ?? false;

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$xl'} paddingTop="$3xl">
        <SplashTitle>
          Choose a{'\n'}
          <Text color="$positiveActionText">brain.</Text>
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
            MiniMax is free. Bring your own API key to use a different provider.
          </SplashParagraph>
          {MODEL_OPTIONS.map((option) => {
            const isSelected = props.model === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => props.onModelChange(option.value)}
              >
                <XStack
                  padding="$l"
                  borderRadius="$xl"
                  borderWidth={2}
                  borderColor={isSelected ? '$positiveActionText' : '$border'}
                  backgroundColor={
                    isSelected ? '$positiveBackground' : '$secondaryBackground'
                  }
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <YStack>
                    <Text
                      fontSize={16}
                      fontWeight="500"
                      color={
                        isSelected ? '$positiveActionText' : '$primaryText'
                      }
                    >
                      {option.label}
                    </Text>
                    <Text
                      fontSize={12}
                      color={
                        isSelected ? '$positiveActionText' : '$secondaryText'
                      }
                    >
                      {option.description}
                    </Text>
                  </YStack>
                  {isSelected && (
                    <Icon type="Checkmark" color="$positiveActionText" />
                  )}
                </XStack>
              </Pressable>
            );
          })}
          {needsApiKey && (
            <View
              borderRadius="$xl"
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$secondaryBackground"
              paddingHorizontal="$l"
              paddingVertical="$m"
              marginTop="$s"
            >
              <RNTextInput
                value={props.apiKey}
                onChangeText={props.onApiKeyChange}
                placeholder={`${selectedOption?.label} API key`}
                placeholderTextColor={placeholderColor}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  fontSize: 16,
                  color: textColor,
                }}
              />
            </View>
          )}
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

function BotLaunchPane(props: {
  botName: string;
  botEmoji: string;
  onCreateGroup: () => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$xl'} paddingTop="$3xl">
        <SplashTitle>
          Put it to{'\n'}
          <Text color="$positiveActionText">work.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            Create a group and invite your friends. {props.botEmoji}{' '}
            {props.botName} will join automatically and can help keep
            conversations going, answer questions, and make things more fun.
          </SplashParagraph>
        </ScrollView>
      </YStack>
      <YStack
        paddingHorizontal="$xl"
        paddingBottom={insets.bottom}
        gap="$l"
      >
        <Button
          onPress={props.onCreateGroup}
          label="Create a group"
          preset="hero"
          shadow
        />
        <Button
          onPress={props.onSkip}
          label="I'll do this later"
          preset="secondary"
          fill="text"
        />
        <Text
          fontSize={12}
          color="$tertiaryText"
          textAlign="center"
          marginBottom="$xs"
        >
          You can always create groups from the home screen.
        </Text>
      </YStack>
    </View>
  );
}

function BotLaunchLoadingPane(props: { botEmoji: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      flex={1}
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
      alignItems="center"
      justifyContent="center"
      gap="$2xl"
    >
      <Text fontSize={64}>{props.botEmoji}</Text>
      <YStack alignItems="center" gap="$m">
        <LoadingSpinner size="large" />
        <Text fontSize={16} fontWeight="500" color="$primaryText">
          Setting things up...
        </Text>
        <Text fontSize={14} color="$secondaryText">
          Creating your group and inviting your bot.
        </Text>
      </YStack>
    </View>
  );
}

function ShareGroupPane(props: {
  botName: string;
  botEmoji: string;
  onActionPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  // TODO: replace with actual invite link from group creation
  const inviteLink = 'https://join.tlon.io/example-invite-link';

  const handleCopy = useCallback(async () => {
    try {
      await Share.share({
        message: `Join my group on Tlon! ${inviteLink}`,
      });
    } catch {
      // User cancelled share sheet
    }
  }, [inviteLink]);

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$xl'} paddingTop="$3xl" alignItems="center">
        <Text fontSize={64}>{props.botEmoji}</Text>
        <SplashTitle textAlign="center">
          You're all{'\n'}
          <Text color="$positiveActionText">set.</Text>
        </SplashTitle>
        <SplashParagraph textAlign="center">
          Your group is ready and {props.botName} is in it. Share the link
          below to invite your friends.
        </SplashParagraph>

        <YStack
          marginHorizontal="$xl"
          width="100%"
          paddingHorizontal="$xl"
          gap="$m"
        >
          <View
            borderRadius="$xl"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$secondaryBackground"
            paddingHorizontal="$l"
            paddingVertical="$m"
          >
            <Text
              fontSize={14}
              color="$secondaryText"
              numberOfLines={1}
              textAlign="center"
            >
              {inviteLink}
            </Text>
          </View>
        </YStack>
      </YStack>

      <YStack
        paddingHorizontal="$xl"
        paddingBottom={insets.bottom}
        gap="$l"
      >
        <Button
          onPress={handleCopy}
          label="Share invite link"
          preset="hero"
          shadow
        />
        <Button
          onPress={props.onActionPress}
          label="Continue"
          preset="secondary"
          fill="text"
        />
      </YStack>
    </View>
  );
}

export function GroupsPane(props: {
  onActionPress: () => void;
  hostingBotEnabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
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
      <YStack flex={1} gap={'$xl'} paddingTop="$2xl">
        <SplashTitle>
          This is a <Text color="$positiveActionText">group.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            A group lives on your computer. Family chats, work collaboration,
            newsletters. A group can be anything you need.
          </SplashParagraph>
          {props.hostingBotEnabled && (
            <SplashParagraph>
              Add your Tlonbot to any group channel and it can participate
              alongside everyone else.
            </SplashParagraph>
          )}
        </ScrollView>
      </YStack>
      <Button
        data-testid="got-it"
        testID="got-it"
        onPress={props.onActionPress}
        label="Got it"
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginTop="$xl"
      />
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
      <YStack flex={1} gap={'$xl'} paddingTop="$2xl">
        <SplashTitle>
          Groups contain{'\n'}
          <Text color="$positiveActionText">channels.</Text>
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
              Mention your Tlonbot in any channel to search the web, summarize
              threads, or draft messages.
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
        <YStack flex={1} gap={'$xl'} paddingTop="$2xl">
          <SplashTitle>
            Groups are{'\n'}
            <Text color="$positiveActionText">secret</Text> by default.
          </SplashTitle>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <SplashParagraph>
              Only people you invite can see your group. You can change this
              anytime in your group settings.
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
  "Anyone you invite will skip the waitlist and be added to your contacts. You'll receive a DM when they join.";

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
    <View flex={1}>
      <InviteFriendsDisplay />
      <YStack
        flex={1}
        paddingHorizontal="$xl"
        paddingBottom={insets.bottom}
        gap="$xl"
      >
        <SplashTitle>
          Better with{'\n'}
          <Text color="$positiveActionText">friends.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph marginHorizontal={0}>
            When your friends join, they get their own computer too. Post
            together with peace of mind, for as long as your group exists.
          </SplashParagraph>
          {shouldShowConnectOption && (
            <SplashParagraph marginHorizontal={0}>
              Sync your contact book to find people you know on Tlon.
            </SplashParagraph>
          )}
        </ScrollView>
        {props.isProcessing && !isWeb && (
          <YStack alignItems="center">
            <LoadingSpinner />
          </YStack>
        )}
      </YStack>
      <YStack paddingBottom={insets.bottom} paddingHorizontal="$xl" gap="$2xl">
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
