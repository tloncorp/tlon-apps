import * as db from '@tloncorp/shared/db';
import { Button, Icon, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useMemo,
} from 'react';
import { Image } from 'react-native';
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

import { useActiveTheme } from '../../../provider';
import { ListItem } from '../ListItem';
import { Squiggle } from '../Squiggle';

enum SplashPane {
  Welcome = 'welcome',
  Group = 'Group',
  Channels = 'Channels',
  Privacy = 'Privacy',
  Invite = 'Invite',
}

function SplashSequenceComponent(props: { onCompleted: () => void }) {
  const insets = useSafeAreaInsets();
  const [currentPane, setCurrentPane] = React.useState<SplashPane>(
    SplashPane.Welcome
  );

  const handleSplashCompleted = useCallback(() => {
    // mark the db that it's been completed
    db.showWayfindingSplash.setValue(false);
    props.onCompleted();
  }, [props]);

  return (
    <View
      flex={1}
      marginTop={insets.top}
      marginBottom={insets.bottom}
      paddingTop="$2xl"
      paddingBottom="$xl"
    >
      {currentPane === 'welcome' && (
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
  size: '$label/m',
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
  return (
    <Button hero height={72} {...rest}>
      <XStack justifyContent="space-between" alignItems="center">
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
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <YStack flex={1} justifyContent="space-between">
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
            Tlon Messenger is a new kind of app where you control your data.
            Unlike other apps, everything is stored on your personal cloud
            computer that only you can access. Most apps keep your content on
            servers they own, but we're different.
          </SplashParagraph>
        </View>
      </YStack>
      <SplashButton onPress={props.onActionPress} marginHorizontal="$2xl">
        Let's get started
      </SplashButton>
    </YStack>
  );
}

export function GroupsPane(props: { onActionPress: () => void }) {
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);

  return (
    <YStack flex={1} justifyContent="space-between">
      <YStack>
        <View marginBottom="$2xl" overflow="hidden">
          <Image
            style={{ width: '100%', height: 300 }}
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
        <YStack marginHorizontal="$2xl">
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
      <SplashButton
        marginTop="$l"
        onPress={props.onActionPress}
        marginHorizontal="$2xl"
      >
        Got it
      </SplashButton>
    </YStack>
  );
}

export function ChannelsPane(props: { onActionPress: () => void }) {
  return (
    <YStack flex={1} justifyContent="space-between">
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
            Whether your group is for posting memes, sharing knowledge, or
            keeping up with the latest on a project, everything happens in a
            channel.
          </SplashParagraph>
          <SplashParagraph marginTop="$2xl">
            Send messages in chats; post longer thoughts in notebooks; collect
            images and links in galleries.
          </SplashParagraph>
        </YStack>
      </YStack>
      <SplashButton
        marginTop="$l"
        onPress={props.onActionPress}
        marginHorizontal="$2xl"
      >
        One quick thing
      </SplashButton>
    </YStack>
  );
}

export function PrivacyPane(props: { onActionPress: () => void }) {
  return (
    <YStack flex={1} justifyContent="space-between">
      <YStack>
        <PrivacyGraphic />
        <YStack marginHorizontal="$2xl">
          <SplashTitle marginTop="$4xl">
            By default, groups are{' '}
            <Text color="$positiveActionText">secret.</Text>
          </SplashTitle>
          <SplashParagraph marginTop="$2xl">
            Only the people you invite can see your group. If you want to open
            it up to other people on the network, edit your privacy selection in
            your group settings.
          </SplashParagraph>
        </YStack>
      </YStack>
      <SplashButton
        marginTop="$l"
        onPress={props.onActionPress}
        marginHorizontal="$2xl"
      >
        Got it
      </SplashButton>
    </YStack>
  );
}

export function InvitePane(props: { onActionPress: () => void }) {
  const activeTheme = useActiveTheme();
  const isDark = useMemo(() => activeTheme === 'dark', [activeTheme]);
  return (
    <YStack flex={1} justifyContent="space-between">
      <YStack>
        <View marginBottom="$2xl" overflow="hidden">
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
        <YStack marginHorizontal="$2xl">
          <SplashTitle marginTop="$2xl">
            Invite your <Text color="$positiveActionText">friends.</Text>
          </SplashTitle>
          <SplashParagraph marginTop="$2xl">
            Your group is a social space and social spaces are more fun with
            friends. When your friends join, they get their own cloud computer.
            So you can all post together, privately, with peace of mind, for as
            long as your group exists.
          </SplashParagraph>
        </YStack>
      </YStack>
      <SplashButton
        marginTop="$l"
        marginHorizontal="$2xl"
        onPress={props.onActionPress}
        backgroundColor="$positiveActionText"
        textProps={{ color: '$white' }}
      >
        Take me to my group
      </SplashButton>
    </YStack>
  );
}

const squiggles = new Array(120).fill(true);
function PrivacyGraphic() {
  return (
    <View marginBottom="$2xl" overflow="hidden" width="100%" height={360}>
      <ZStack flex={1}>
        <View flex={1} opacity={0.2}>
          {squiggles.map((_item, index) => {
            return (
              <Squiggle
                key={index}
                // zIndex={index}
                height={600}
                width={600}
                top={-(400 - index * 4)}
                left={-(300 - index * 4)}
                position="absolute"
              />
            );
          })}
        </View>
        <YStack
          flex={1}
          zIndex={1000}
          paddingHorizontal="$3xl"
          justifyContent="center"
          gap="$xl"
        >
          <ListItem
            backgroundColor="$positiveBackground"
            borderWidth={1}
            padding="$xl"
            borderColor="$positiveBorder"
          >
            <ListItem.SystemIcon
              icon="Lock"
              backgroundColor="unset"
              color="$positiveActionText"
            />
            <ListItem.MainContent>
              <ListItem.Title color="$positiveActionText">
                Secret
              </ListItem.Title>
              <ListItem.Subtitle color="$positiveActionText">
                Invite-only
              </ListItem.Subtitle>
            </ListItem.MainContent>
          </ListItem>

          <ListItem
            backgroundColor="$background"
            borderWidth={1}
            padding="$xl"
            borderColor="$border"
          >
            <ListItem.SystemIcon
              icon="EyeClosed"
              backgroundColor="unset"
              color="$primaryText"
            />
            <ListItem.MainContent>
              <ListItem.Title>Private</ListItem.Title>
              <ListItem.Subtitle>
                New members require approval
              </ListItem.Subtitle>
            </ListItem.MainContent>
          </ListItem>

          <ListItem
            backgroundColor="$background"
            borderWidth={1}
            padding="$xl"
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
      </ZStack>
    </View>
  );
}
