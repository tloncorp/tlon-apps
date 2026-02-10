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
import { Dimensions, FlatList, Image, ScrollView } from 'react-native';
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
import { PersonalInviteButton } from '../PersonalInviteButton';
import { ScreenHeader } from '../ScreenHeader';
import { SearchBar } from '../SearchBar';
import { PrivacyThumbprint } from './visuals/PrivacyThumbprint';

enum SplashPane {
  Welcome = 'Welcome',
  Group = 'Group',
  Channels = 'Channels',
  Privacy = 'Privacy',
  Invite = 'Invite',
}

function useDeviceSize() {
  return useMemo(() => {
    const { height } = Dimensions.get('window');
    const isTiny = height < 700;
    const isSmall = height < 800;
    return { isTiny, isSmall, height };
  }, []);
}

type DeviceSize = ReturnType<typeof useDeviceSize>;

function SplashSequenceComponent(props: {
  onCompleted: () => void;
  systemContacts?: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
}) {
  const store = useStore();
  const [currentPane, setCurrentPane] = React.useState<SplashPane>(
    SplashPane.Welcome
  );
  const deviceSize = useDeviceSize();

  const handleSplashCompleted = useCallback(() => {
    store.completeWayfindingSplash();
    props.onCompleted();
  }, [props, store]);

  return (
    <View flex={1}>
      {currentPane === 'Welcome' && (
        <WelcomePane
          onActionPress={() => setCurrentPane(SplashPane.Group)}
          deviceSize={deviceSize}
        />
      )}
      {currentPane === 'Group' && (
        <GroupsPane
          onActionPress={() => setCurrentPane(SplashPane.Channels)}
          deviceSize={deviceSize}
        />
      )}
      {currentPane === 'Channels' && (
        <ChannelsPane
          onActionPress={() => setCurrentPane(SplashPane.Privacy)}
          deviceSize={deviceSize}
        />
      )}
      {currentPane === 'Privacy' && (
        <PrivacyPane
          onActionPress={() => setCurrentPane(SplashPane.Invite)}
          deviceSize={deviceSize}
        />
      )}
      {currentPane === 'Invite' && (
        <InvitePane
          onActionPress={handleSplashCompleted}
          systemContacts={props.systemContacts}
          inviteSystemContacts={props.inviteSystemContacts}
          deviceSize={deviceSize}
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

export function WelcomePane(props: {
  onActionPress: () => void;
  deviceSize: DeviceSize;
}) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
  const { isTiny = false, isSmall = false } = props.deviceSize || {};

  const imageHeight = useMemo(() => {
    if (isWeb) return 300;
    if (isTiny) return 180;
    if (isSmall) return 240;
    return 300;
  }, [isTiny, isSmall]);

  const topMargin = useMemo(() => {
    if (isWeb) return '$4xl';
    if (isTiny) return '$xl';
    if (isSmall) return '$2xl';
    return '$4xl';
  }, [isTiny, isSmall]);

  return (
    <View flex={1}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image
          style={{ width: '100%', height: imageHeight }}
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
        <YStack gap={'$2xl'} marginTop={topMargin}>
          <SplashTitle>Welcome to Tlon Messenger</SplashTitle>
          <SplashParagraph>
            On Tlon Messenger you control your data. Unlike other apps,
            everything is stored on your personal cloud computer that only you
            can access.
          </SplashParagraph>
          <Button
            data-testid="lets-get-started"
            onPress={props.onActionPress}
            label="Let's get started"
            preset="hero"
            shadow
            marginHorizontal="$xl"
            marginTop="$xl"
          />
        </YStack>
      </ScrollView>
    </View>
  );
}

export function GroupsPane(props: {
  onActionPress: () => void;
  deviceSize: DeviceSize;
}) {
  const insets = useSafeAreaInsets();
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
  const { isTiny = false, isSmall = false } = props.deviceSize || {};

  const imageHeight = useMemo(() => {
    if (isWeb) return 360;
    if (isTiny) return 200;
    if (isSmall) return 260;
    return 360;
  }, [isTiny, isSmall]);

  const topMargin = useMemo(() => {
    if (isWeb) return '$4xl';
    if (isTiny) return '$xl';
    if (isSmall) return '$2xl';
    return '$4xl';
  }, [isTiny, isSmall]);

  return (
    <View flex={1}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image
          style={{ width: '100%', height: imageHeight }}
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

        <YStack gap={'$2xl'} marginTop={topMargin}>
          <SplashTitle>
            This is a <Text color="$positiveActionText">group.</Text>
          </SplashTitle>
          <SplashParagraph>
            A group lives on your Tlon computer. A group can serve a lot of
            purposes: family chats, work collaboration, newsletters, etc.
          </SplashParagraph>
          <Button
            data-testid="got-it"
            onPress={props.onActionPress}
            label="Got it"
            preset="hero"
            shadow
            marginHorizontal="$xl"
            marginTop="$xl"
          />
        </YStack>
      </ScrollView>
    </View>
  );
}

export function ChannelsPane(props: {
  onActionPress: () => void;
  deviceSize: DeviceSize;
}) {
  const insets = useSafeAreaInsets();
  const { isTiny = false, isSmall = false } = props.deviceSize || {};

  const imageHeight = useMemo(() => {
    if (isWeb) return 360;
    if (isTiny) return 200;
    if (isSmall) return 260;
    return 360;
  }, [isTiny, isSmall]);

  const topMargin = useMemo(() => {
    if (isWeb) return '$2xl';
    if (isTiny) return '$l';
    if (isSmall) return '$xl';
    return '$2xl';
  }, [isTiny, isSmall]);

  return (
    <View flex={1}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image
          style={{ width: '100%', height: imageHeight }}
          resizeMode="contain"
          source={
            isWeb
              ? `./app-screens.png`
              : require(`../../assets/raster/app-screens.png`)
          }
        />

        <YStack gap={'$2xl'} marginTop={topMargin}>
          <SplashTitle>
            A group contains <Text color="$positiveActionText">channels.</Text>
          </SplashTitle>
          <SplashParagraph>
            No matter what you use your group for, everything happens in a
            channel.
          </SplashParagraph>
          <SplashParagraph>
            Send messages in chats, post longer thoughts in notebooks, collect
            images and links in galleries.
          </SplashParagraph>
          <Button
            data-testid="one-quick-thing"
            onPress={props.onActionPress}
            label="One quick thing"
            preset="hero"
            shadow
            marginHorizontal="$xl"
            marginTop="$xl"
          />
        </YStack>
      </ScrollView>
    </View>
  );
}

export function PrivacyPane(props: {
  onActionPress: () => void;
  deviceSize: DeviceSize;
}) {
  const insets = useSafeAreaInsets();
  const { isTiny = false, isSmall = false } = props.deviceSize || {};

  const topMarginValue = useMemo(() => {
    if (isWeb) return '$4xl';
    if (isTiny) return '$xl';
    if (isSmall) return '$2xl';
    return '$4xl';
  }, [isTiny, isSmall]);

  const titleTopMargin = useMemo(() => {
    if (isTiny) return 40;
    if (isSmall) return 60;
    return 86;
  }, [isTiny, isSmall]);

  return (
    <ZStack flex={1}>
      <PrivacyThumbprint />
      <View zIndex={1000} flex={1}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View marginTop={topMarginValue}>
            <PrivacyLevelsDisplay />
          </View>

          <YStack gap={'$2xl'} marginTop={titleTopMargin}>
            <SplashTitle>
              By default, groups are{' '}
              <Text color="$positiveActionText">secret.</Text>
            </SplashTitle>
            <SplashParagraph>
              Only the people you invite can see your group. If you want to open
              it up to other people on the network, edit the privacy controls in
              your group settings.
            </SplashParagraph>
            <Button
              data-testid="invite-friends"
              onPress={props.onActionPress}
              label="Invite friends"
              preset="hero"
              shadow
              marginHorizontal="$xl"
              marginTop="$xl"
            />
          </YStack>
        </ScrollView>
      </View>
    </ZStack>
  );
}

const logger = createDevLogger('SplashSequence', true);

const INVITE_EXPLANATION_TEXT =
  "Anyone you invite will skip the waitlist and be added to your contacts. You'll receive a DM when they join.";

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
  const hasContacts = systemContacts && systemContacts.length > 0;

  const { displayContacts, handleSearch } = useSystemContactSearch(
    systemContacts ?? []
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
  deviceSize: DeviceSize;
}) {
  const insets = useSafeAreaInsets();
  const { isTiny = false, isSmall = false } = props.deviceSize || {};

  const shouldShowConnectOption = props.forceShowConnect || !isWeb;

  const handleAction = shouldShowConnectOption
    ? props.onConnectContacts
    : props.onSkip;

  const topMargin = useMemo(() => {
    if (isWeb || !shouldShowConnectOption) return '$4xl';
    if (isTiny) return '$l';
    if (isSmall) return '$xl';
    return 'unset';
  }, [shouldShowConnectOption, isTiny, isSmall]);

  return (
    <View flex={1}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <InviteFriendsDisplay deviceSize={props.deviceSize} />

        <YStack gap={'$2xl'} marginTop={topMargin}>
          <SplashTitle>
            Tlon is better{' '}
            <Text color="$positiveActionText">with friends.</Text>
          </SplashTitle>
          <SplashParagraph>
            Social spaces are more fun with friends. When your friends join Tlon
            Messenger, they get their own cloud computer. You can all post
            together with peace of mind, for as long as your group exists.
          </SplashParagraph>
          {shouldShowConnectOption && (
            <SplashParagraph>
              Sync your contact book to easily find people you know on Tlon.
            </SplashParagraph>
          )}
          {props.isProcessing && !isWeb && (
            <YStack alignItems="center">
              <LoadingSpinner />
            </YStack>
          )}
          <Button
            data-testid="connect-contact-book"
            onPress={handleAction}
            label={shouldShowConnectOption ? 'Connect contact book' : 'Finish'}
            preset="hero"
            shadow
            disabled={props.isProcessing}
            marginHorizontal="$xl"
          />
          {shouldShowConnectOption && (
            <Button
              onPress={props.onSkip}
              label="Skip"
              preset="minimal"
              disabled={props.isProcessing}
              marginHorizontal="$xl"
            />
          )}
        </YStack>
      </ScrollView>
    </View>
  );
}

export function InvitePane(props: {
  onActionPress: () => void;
  systemContacts?: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
  deviceSize: DeviceSize;
}) {
  const storeContext = useStore();
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

      // Log analytics if no contacts were found
      const syncedContacts = await db.getSystemContacts();
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
  }, [hasProvidedContacts, storeContext]);

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
  }, [
    perms.hasPermission,
    perms.isLoading,
    hasProvidedContacts,
    processContacts,
  ]);

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
      forceShowConnect={hasProvidedContacts}
      deviceSize={props.deviceSize}
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

const InviteFriendsDisplay = ({ deviceSize }: { deviceSize: DeviceSize }) => {
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
  const { isTiny = false, isSmall = false } = deviceSize || {};

  const displayHeight = useMemo(() => {
    if (isWeb) {
      return 300;
    }
    if (isTiny) {
      return 180;
    }
    if (isSmall) {
      return 220;
    }
    return 340;
  }, [isTiny, isSmall]);

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
