// tamagui-ignore
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import {
  Button,
  Icon,
  LoadingSpinner,
  Text,
  triggerHaptic,
} from '@tloncorp/ui';
import React, {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Alert, Dimensions, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ColorTokens,
  View,
  XStack,
  YStack,
  ZStack,
  isWeb,
  styled,
} from 'tamagui';

import { useContactPermissions } from '../../../hooks/useContactPermissions';
import { useActiveTheme } from '../../../provider';
import { useStore } from '../../contexts';
import { ListItem } from '../ListItem';
import { PrivacyThumbprint } from './visuals/PrivacyThumbprint';

enum SplashPane {
  Welcome = 'Welcome',
  Group = 'Group',
  Channels = 'Channels',
  Privacy = 'Privacy',
  Invite = 'Invite',
}

function SplashSequenceComponent(props: { onCompleted: () => void }) {
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
        <InvitePane onActionPress={handleSplashCompleted} />
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
          <SplashTitle marginTop="$xs">We've created one for you.</SplashTitle>
          <SplashParagraph marginTop="$2xl">
            This group lives on your Tlon computer. Your group can serve a lot
            of purposes: family chats, work collaboration, newsletters, etc.
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

export function InvitePane(props: { onActionPress: () => void }) {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const perms = useContactPermissions();

  const processContacts = async () => {
    try {
      setIsProcessing(true);
      await store.syncSystemContacts();
      Alert.alert('Success', 'Your contacts have been synced.', [
        {
          text: 'OK',
          onPress: () => {
            props.onActionPress();
          },
        },
      ]);
    } catch (error) {
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
  };

  const handleShareContacts = async () => {
    try {
      if (perms.canAskPermission) {
        const status = await perms.requestPermissions();
        if (status === 'granted') {
          await processContacts();
        }
      }
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorSystemContacts, {
        context: 'handleShareContacts threw',
        error: e,
        severity: AnalyticsSeverity.Critical,
      });
    }
  };

  const handleSkip = () => {
    logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped);
    props.onActionPress();
  };

  const shouldPromptForPermission = useMemo(() => {
    return !isWeb && !perms.hasPermission;
  }, [perms]);
  const handleAction = shouldPromptForPermission
    ? handleShareContacts
    : props.onActionPress;

  return (
    <YStack flex={1} justifyContent="space-between">
      <YStack flex={1}>
        <InviteFriendsDisplay />
        <YStack marginHorizontal={isWeb ? '$4xl' : '$2xl'}>
          <SplashTitle
            marginTop={isWeb || !shouldPromptForPermission ? '$4xl' : 'unset'}
          >
            Tlon is better{' '}
            <Text color="$positiveActionText">with friends.</Text>
          </SplashTitle>
          <SplashParagraph marginTop="$xl">
            Social spaces are more fun with friends. When your friends join Tlon
            Messenger, they get their own cloud computer. You can all post
            together with peace of mind, for as long as your group exists.
          </SplashParagraph>
          {shouldPromptForPermission && (
            <SplashParagraph marginTop="$xl">
              Sync your contact book to easily find people you know on Tlon.
            </SplashParagraph>
          )}
          {error && !isWeb && (
            <Text marginTop="$m" size="$label/m" color="$red">
              {error}
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
        {isProcessing && !isWeb && (
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
            disabled={isProcessing}
          >
            {shouldPromptForPermission ? 'Connect contact book' : 'Finish'}
          </SplashButton>
          {shouldPromptForPermission && (
            <SplashButton
              marginTop="$l"
              secondary
              textProps={{ color: '$secondaryText' }}
              backgroundColor="$background"
              disabled={isProcessing}
              onPress={handleSkip}
            >
              Skip
            </SplashButton>
          )}
        </YStack>
      </XStack>
    </YStack>
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
