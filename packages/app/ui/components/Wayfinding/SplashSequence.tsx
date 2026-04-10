// tamagui-ignore
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, Image, ScrollView } from 'react-native';
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
import { BotBehaviorScreenView } from '../BotBehaviorScreenView';
import type { BotBehaviorFormData } from '../BotBehaviorScreenView';
import { BotIdentityScreenView } from '../BotIdentityScreenView';
import type { BotIdentityFormData } from '../BotIdentityScreenView';
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
  BotIdentity = 'BotIdentity',
  BotBehavior = 'BotBehavior',
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
  const [botIdentityData, setBotIdentityData] =
    React.useState<BotIdentityFormData | null>(null);

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
          onActionPress={() => setCurrentPane(SplashPane.BotIdentity)}
        />
      )}
      {currentPane === 'BotIdentity' && (
        <BotIdentityScreenView
          onGoBack={() => setCurrentPane(SplashPane.TlonBot)}
          onContinue={(data) => {
            setBotIdentityData(data);
            setCurrentPane(SplashPane.BotBehavior);
          }}
        />
      )}
      {currentPane === 'BotBehavior' && (
        <BotBehaviorScreenView
          onGoBack={() => setCurrentPane(SplashPane.BotIdentity)}
          onSave={async (data) => {
            if (botIdentityData) {
              const config = {
                name: botIdentityData.name,
                emoji: botIdentityData.emoji,
                personalityType: botIdentityData.personalityType,
                customSoulPrompt: botIdentityData.customSoulPrompt,
                model: data.model,
                apiKey: data.apiKey || undefined,
                responseStyle: data.responseStyle,
                activeHoursStart: Number(data.activeHoursStart),
                activeHoursEnd: Number(data.activeHoursEnd),
                timezone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
              };
              try {
                await saveBotConfig(config);
              } catch (e) {
                console.error('Failed to save bot config during onboarding:', e);
              }
            }
            setCurrentPane(SplashPane.Group);
          }}
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

export function TlonBotPane(props: { onActionPress: () => void }) {
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
      <Button
        onPress={props.onActionPress}
        testID="bot-next"
        label="Next"
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginBottom={insets.bottom}
      />
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
