// tamagui-ignore
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, LoadingSpinner, Text, triggerHaptic } from '@tloncorp/ui';
import React, {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Dimensions, FlatList, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ColorTokens,
  View,
  XStack,
  YStack,
  ZStack,
  getTokenValue,
  isWeb,
  styled,
} from 'tamagui';

import { useContactPermissions } from '../../../hooks/useContactPermissions';
import {
  InviteSystemContactsFn,
  useInviteSystemContactHandler,
} from '../../../hooks/useInviteSystemContactHandler';
import { useActiveTheme } from '../../../provider';
import { useStore } from '../../contexts';
import { ListItem, SystemContactListItem } from '../ListItem';
import { ScreenHeader } from '../ScreenHeader';
import { PrivacyThumbprint } from './visuals/PrivacyThumbprint';

enum SplashPane {
  Welcome = 'Welcome',
  Group = 'Group',
  Channels = 'Channels',
  Privacy = 'Privacy',
  Invite = 'Invite',
}

function SplashSequenceComponent(props: {
  onCompleted: () => void;
  systemContacts?: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
}) {
  const store = useStore();
  const [currentPane, setCurrentPane] = React.useState<SplashPane>(
    SplashPane.Welcome
  );

  const handleSplashCompleted = useCallback(() => {
    store.completeWayfindingSplash();
    props.onCompleted();
  }, [props, store]);

  return (
    <View flex={1}>
      {currentPane === 'Welcome' && (
        <WelcomePane onActionPress={() => setCurrentPane(SplashPane.Group)} />
      )}
      {currentPane === 'Group' && (
        <GroupsPane onActionPress={() => setCurrentPane(SplashPane.Channels)} />
      )}
      {currentPane === 'Channels' && (
        <ChannelsPane
          onActionPress={() => setCurrentPane(SplashPane.Privacy)}
        />
      )}
      {currentPane === 'Privacy' && (
        <PrivacyPane onActionPress={() => setCurrentPane(SplashPane.Invite)} />
      )}
      {currentPane === 'Invite' && (
        <InvitePane
          onActionPress={handleSplashCompleted}
          systemContacts={props.systemContacts}
          inviteSystemContacts={props.inviteSystemContacts}
        />
      )}
    </View>
  );
}

export const SplashSequence = React.memo(SplashSequenceComponent);

const SplashTitle = styled(Text, {
  fontSize: '$xl',
  fontWeight: '600',
  marginHorizontal: '$xl',
});

const SplashParagraph = styled(Text, {
  size: '$body',
  marginHorizontal: '$xl',
});

const SplashButton = ({
  children,
  textProps = {},
  ...rest
}: PropsWithChildren<
  {
    onPress: () => void;
    textProps?: ComponentProps<typeof Button.Text>;
  } & ComponentProps<typeof Button>
>) => {
  const handlePress = useCallback(() => {
    triggerHaptic('baseButtonClick');
    rest.onPress();
  }, [rest]);

  return (
    <Button
      hero
      height={72}
      width={isWeb ? 300 : 'unset'}
      padding={isWeb ? 30 : 'unset'}
      {...rest}
      onPress={handlePress}
    >
      <XStack width="100%" justifyContent="space-between" alignItems="center">
        <Button.Text
          flexShrink={1}
          textAlign="left"
          marginLeft="$l"
          {...textProps}
        >
          {children}
        </Button.Text>
        <Icon
          type="ChevronRight"
          color={(textProps.color as ColorTokens) ?? '$background'}
        />
      </XStack>
    </Button>
  );
};

export function WelcomePane(props: { onActionPress: () => void }) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <YStack
      marginTop={isWeb ? '$4xl' : insets.top}
      marginBottom={isWeb || Platform.OS === 'android' ? '$4xl' : insets.bottom}
      marginHorizontal={isWeb ? '$4xl' : 'unset'}
      flex={1}
      justifyContent="space-between"
    >
      <YStack>
        <View marginBottom="$2xl" overflow="hidden">
          <Image
            style={{ width: '100%', height: 300 }}
            resizeMode="contain"
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
        </View>
        <View marginHorizontal="$2xl">
          <SplashTitle marginTop="$4xl">Welcome to Tlon Messenger</SplashTitle>
          <SplashParagraph marginTop="$2xl">
            On Tlon Messenger you control your data. Unlike other apps,
            everything is stored on your personal cloud computer that only you
            can access.
          </SplashParagraph>
        </View>
      </YStack>
      <XStack width="100%" justifyContent="center" marginTop="$2xl">
        <SplashButton
          data-testid="lets-get-started"
          onPress={props.onActionPress}
          marginHorizontal="$2xl"
        >
          Let's get started
        </SplashButton>
      </XStack>
    </YStack>
  );
}

export function GroupsPane(props: { onActionPress: () => void }) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <YStack
      marginTop={insets.top}
      marginBottom={isWeb || Platform.OS === 'android' ? '$4xl' : insets.bottom}
      flex={1}
      justifyContent="space-between"
    >
      <YStack>
        <View marginBottom="$2xl" overflow="hidden">
          <Image
            style={{ width: '100%', height: 360 }}
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
        </View>
        <YStack marginHorizontal={isWeb ? '$4xl' : '$2xl'}>
          <SplashTitle marginTop="$4xl">
            This is a <Text color="$positiveActionText">group.</Text>
          </SplashTitle>
          <SplashParagraph marginTop="$2xl">
            A group lives on your Tlon computer. A group can serve a lot of
            purposes: family chats, work collaboration, newsletters, etc.
          </SplashParagraph>
        </YStack>
      </YStack>
      <XStack width="100%" justifyContent="center" marginTop="$2xl">
        <SplashButton
          data-testid="got-it"
          marginTop="$l"
          onPress={props.onActionPress}
          marginHorizontal={isWeb ? '$4xl' : '$2xl'}
        >
          Got it
        </SplashButton>
      </XStack>
    </YStack>
  );
}

export function ChannelsPane(props: { onActionPress: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <YStack
      marginTop={isWeb ? '$2xl' : insets.top}
      marginBottom={isWeb || Platform.OS === 'android' ? '$4xl' : insets.bottom}
      marginHorizontal={isWeb ? '$4xl' : 'unset'}
      flex={1}
      justifyContent="space-between"
    >
      <YStack>
        <View marginBottom="$2xl" overflow="hidden">
          <Image
            style={{ width: '100%', height: 360 }}
            resizeMode="contain"
            source={
              isWeb
                ? `./app-screens.png`
                : require(`../../assets/raster/app-screens.png`)
            }
          />
        </View>
        <YStack marginHorizontal="$2xl">
          <SplashTitle marginTop="$2xl">
            A group contains <Text color="$positiveActionText">channels.</Text>
          </SplashTitle>
          <SplashParagraph marginTop="$2xl">
            No matter what you use your group for, everything happens in a
            channel.
          </SplashParagraph>
          <SplashParagraph marginTop="$2xl">
            Send messages in chats, post longer thoughts in notebooks, collect
            images and links in galleries.
          </SplashParagraph>
        </YStack>
      </YStack>
      <XStack width="100%" justifyContent="center" marginTop="$2xl">
        <SplashButton
          data-testid="one-quick-thing"
          marginTop="$l"
          onPress={props.onActionPress}
          marginHorizontal="$2xl"
        >
          One quick thing
        </SplashButton>
      </XStack>
    </YStack>
  );
}

export function PrivacyPane(props: { onActionPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ZStack flex={1}>
      <PrivacyThumbprint />
      <YStack
        zIndex={1000}
        flex={1}
        justifyContent="space-between"
        marginTop={isWeb ? '$4xl' : insets.top}
        marginBottom={
          isWeb || Platform.OS === 'android' ? '$4xl' : insets.bottom
        }
        marginHorizontal={isWeb ? '$4xl' : 'unset'}
      >
        <YStack>
          <View marginTop="$4xl">
            <PrivacyLevelsDisplay />
          </View>
          <YStack marginHorizontal="$2xl">
            <SplashTitle marginTop={86}>
              By default, groups are{' '}
              <Text color="$positiveActionText">secret.</Text>
            </SplashTitle>
            <SplashParagraph marginTop="$2xl">
              Only the people you invite can see your group. If you want to open
              it up to other people on the network, edit the privacy controls in
              your group settings.
            </SplashParagraph>
          </YStack>
        </YStack>
        <XStack width="100%" justifyContent="center" marginTop="$2xl">
          <SplashButton
            data-testid="invite-friends"
            marginTop="$l"
            onPress={props.onActionPress}
            marginHorizontal="$2xl"
          >
            Invite friends
          </SplashButton>
        </XStack>
      </YStack>
    </ZStack>
  );
}

const logger = createDevLogger('SplashSequence', true);

export function InviteContactsContent(props: {
  onComplete: () => void;
  systemContacts?: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
}) {
  const inviteLink = db.personalInviteLink.useValue();
  const handleInviteContact = useInviteSystemContactHandler(
    props.inviteSystemContacts,
    inviteLink
  );
  const { data: storeSystemContacts } = store.useSystemContacts();
  const systemContacts = props.systemContacts ?? storeSystemContacts;
  const isReady = !!inviteLink;

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
      <SplashParagraph marginTop="$l">
        Tap a contact to send them an invite to join you on Tlon Messenger.
      </SplashParagraph>
      {!isReady ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <LoadingSpinner />
          <Text marginTop="$l" color="$secondaryText">
            Preparing your invite link...
          </Text>
        </YStack>
      ) : (
        <FlatList
          data={systemContacts ?? []}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, marginTop: getTokenValue('$l', 'size') }}
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
      )}
    </YStack>
  );
}

function ConnectContactBookContent(props: {
  onConnectContacts: () => void;
  onSkip: () => void;
  isProcessing: boolean;
  error: string | null;
  forceShowConnect?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const shouldShowConnectOption = props.forceShowConnect || !isWeb;

  const handleAction = shouldShowConnectOption
    ? props.onConnectContacts
    : props.onSkip;

  return (
    <YStack flex={1} justifyContent="space-between">
      <YStack flex={1}>
        <InviteFriendsDisplay />
        <YStack marginHorizontal={isWeb ? '$4xl' : '$2xl'}>
          <SplashTitle
            marginTop={isWeb || !shouldShowConnectOption ? '$4xl' : 'unset'}
          >
            Tlon is better{' '}
            <Text color="$positiveActionText">with friends.</Text>
          </SplashTitle>
          <SplashParagraph marginTop="$xl">
            Social spaces are more fun with friends. When your friends join Tlon
            Messenger, they get their own cloud computer. You can all post
            together with peace of mind, for as long as your group exists.
          </SplashParagraph>
          {shouldShowConnectOption && (
            <SplashParagraph marginTop="$xl">
              Sync your contact book to easily find people you know on Tlon.
            </SplashParagraph>
          )}
          {props.error && !isWeb && (
            <Text marginTop="$m" size="$label/m" color="$red">
              {props.error}
            </Text>
          )}
        </YStack>
      </YStack>
      <XStack
        width="100%"
        justifyContent="center"
        marginTop="$2xl"
        marginBottom={
          isWeb || Platform.OS === 'android' ? '$4xl' : insets.bottom
        }
      >
        {props.isProcessing && !isWeb && (
          <YStack alignItems="center" marginBottom="$l">
            <LoadingSpinner />
          </YStack>
        )}
        <YStack
          width={isWeb ? 'auto' : '100%'}
          paddingHorizontal={isWeb ? 'unset' : '$2xl'}
        >
          <SplashButton
            data-testid="connect-contact-book"
            marginTop="$l"
            onPress={handleAction}
            marginHorizontal={isWeb ? '$2xl' : 'unset'}
            backgroundColor="$positiveActionText"
            textProps={{ color: '$white' }}
            disabled={props.isProcessing}
          >
            {shouldShowConnectOption ? 'Connect contact book' : 'Finish'}
          </SplashButton>
          {shouldShowConnectOption && (
            <SplashButton
              marginTop="$l"
              secondary
              textProps={{ color: '$secondaryText' }}
              backgroundColor="$background"
              disabled={props.isProcessing}
              onPress={props.onSkip}
            >
              Skip
            </SplashButton>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}

export function InvitePane(props: {
  onActionPress: () => void;
  systemContacts?: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
}) {
  const storeContext = useStore();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInviteContacts, setShowInviteContacts] = useState(false);
  const hasAutoProcessed = useRef(false);
  const perms = useContactPermissions();
  const hasProvidedContacts = !!props.systemContacts?.length;

  const processContacts = useCallback(async () => {
    if (hasProvidedContacts) {
      setShowInviteContacts(true);
      return;
    }

    try {
      setIsProcessing(true);
      await storeContext.syncSystemContacts();

      // Check if any contacts were imported - skip invite screen if none
      const syncedContacts = await db.getSystemContacts();
      if (!syncedContacts || syncedContacts.length === 0) {
        logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped, {
          reason: 'no_contacts_synced',
        });
        props.onActionPress();
        return;
      }

      setShowInviteContacts(true);
    } catch (err) {
      setError('Something went wrong, please try again.');
      Alert.alert('Error', "We weren't able to sync your contacts.", [
        {
          text: 'OK',
          onPress: () => {
            props.onActionPress();
          },
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProvidedContacts, props.onActionPress, storeContext]);

  useEffect(() => {
    if (
      !isWeb &&
      !hasProvidedContacts &&
      perms.hasPermission &&
      !perms.isLoading &&
      !hasAutoProcessed.current
    ) {
      hasAutoProcessed.current = true;
      processContacts();
    }
  }, [perms.hasPermission, perms.isLoading, hasProvidedContacts, processContacts]);

  const handleConnectContacts = async () => {
    if (hasProvidedContacts) {
      await processContacts();
      return;
    }

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
    logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped);
    props.onActionPress();
  };

  if (showInviteContacts) {
    return (
      <InviteContactsContent
        onComplete={props.onActionPress}
        systemContacts={props.systemContacts}
        inviteSystemContacts={props.inviteSystemContacts}
      />
    );
  }

  return (
    <ConnectContactBookContent
      onConnectContacts={handleConnectContacts}
      onSkip={handleSkip}
      isProcessing={isProcessing}
      error={error}
      forceShowConnect={hasProvidedContacts}
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
  const deviceIsTinyHeight = useMemo(() => {
    const { height } = Dimensions.get('window');
    return height < 800;
  }, []);

  const displayHeight = useMemo(() => {
    if (isWeb) {
      return 300;
    }

    if (deviceIsTinyHeight) {
      return 220;
    }

    return 340;
  }, [deviceIsTinyHeight]);

  return (
    <View height={displayHeight} marginBottom="$2xl" overflow="hidden">
      <ZStack flex={1}>
        <View position="relative" top={-80} right={isWeb ? 120 : 50}>
          <Image
            style={{ width: '100%', height: 360 }}
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
        <ZStack width="100%" height={40} position="absolute" bottom={0}>
          <View flex={1} backgroundColor="$black" opacity={0.4} />
          <YStack flex={1} justifyContent="center" marginLeft="$l" gap="$xs">
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
