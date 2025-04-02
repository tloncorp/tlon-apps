import { Button, Icon, Sheet, Text } from '@tloncorp/ui';
import React, { ComponentProps, PropsWithChildren, useCallback } from 'react';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack, isWeb, styled } from 'tamagui';

enum SplashPane {
  Welcome = 'welcome',
  Group = 'Group',
  Channels = 'Channels',
  Invite = 'Invite',
}

function SplashSheetComponent({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inset = useSafeAreaInsets();

  const [currentPane, setCurrentPane] = React.useState<SplashPane>(
    SplashPane.Welcome
  );

  const handleSplashCompleted = useCallback(() => {
    // mark the db that it's been completed
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet
      open={open}
      snapPointsMode="fit"
      modal
      disableDrag
      dismissOnOverlayPress={false}
      animation="quick"
    >
      <Sheet.Overlay />
      <Sheet.LazyFrame
        paddingTop="$s"
        paddingBottom={inset.bottom}
        paddingHorizontal="$2xl"
      >
        <Sheet.Handle marginBottom="$l" />
        {currentPane === 'welcome' && (
          <WelcomePane onActionPress={() => setCurrentPane(SplashPane.Group)} />
        )}
        {currentPane === 'Group' && (
          <GroupsPane
            onActionPress={() => setCurrentPane(SplashPane.Channels)}
          />
        )}
        {currentPane === 'Channels' && (
          <ChannelsPane
            onActionPress={() => setCurrentPane(SplashPane.Invite)}
          />
        )}
        {currentPane === 'Invite' && (
          <InvitePane onActionPress={handleSplashCompleted} />
        )}
      </Sheet.LazyFrame>
    </Sheet>
  );
}

export const SplashSheet = React.memo(SplashSheetComponent);

const SplashTitle = styled(Text, {
  fontSize: '$xl',
  fontWeight: '600',
});

const SplashParagraph = styled(Text, {
  size: '$body',
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
        <Icon type="ChevronRight" color="$white" />
      </XStack>
    </Button>
  );
};

export function WelcomePane(props: { onActionPress: () => void }) {
  return (
    <YStack height={540} gap="$xl">
      <SplashTitle textAlign="center">Welcome to Tlon Messenger</SplashTitle>
      <View borderRadius="$2xl" overflow="hidden">
        <Image
          style={{ width: '100%', height: 160 }}
          resizeMode={'cover'}
          source={
            isWeb
              ? './welcome_flowers.jpg'
              : require('../../assets/raster/welcome_flowers.jpg')
          }
        />
      </View>
      <YStack gap="$2xl">
        <SplashParagraph>Tlon Messenger is a new kind of app.</SplashParagraph>
        <SplashParagraph>
          Your data is yours and stored on your node. Nobody can access it but
          you.
        </SplashParagraph>
        <SplashParagraph>
          You can create whatever social space you can imagine and invite your
          friends. It’s designed to be clean and free of ads and distractions.
        </SplashParagraph>
        <SplashParagraph>
          Your node is always yours; there is no way to spoof accounts or
          impersonate anyone
        </SplashParagraph>
      </YStack>
      <SplashButton onPress={props.onActionPress}>
        Let's get started
      </SplashButton>
    </YStack>
  );
}

export function GroupsPane(props: { onActionPress: () => void }) {
  return (
    <YStack height={400} gap="$xl">
      <SplashTitle marginLeft="$l">
        This is a <Text color="$positiveActionText">group.</Text>
      </SplashTitle>
      <View
        borderRadius="$2xl"
        overflow="hidden"
        backgroundColor="$border"
        height={160}
        justifyContent="center"
        alignItems="center"
      >
        <Text size="$label/l">Placeholder</Text>
      </View>
      <YStack gap="$2xl">
        <SplashParagraph>
          A group lives on your node. You can personalize the group picture,
          name, description, and other things that make it your home on the
          network.
        </SplashParagraph>
      </YStack>
      <SplashButton marginTop="$l" onPress={props.onActionPress}>
        Got it
      </SplashButton>
    </YStack>
  );
}

export function ChannelsPane(props: { onActionPress: () => void }) {
  return (
    <YStack height={400} gap="$xl">
      <SplashTitle marginLeft="$l">
        A group contains <Text color="$positiveActionText">channels.</Text>
      </SplashTitle>
      <View
        borderRadius="$2xl"
        overflow="hidden"
        backgroundColor="$border"
        height={160}
        justifyContent="center"
        alignItems="center"
      >
        <Text size="$label/l">Placeholder</Text>
      </View>
      <YStack gap="$2xl">
        <SplashParagraph>
          People post messages to channels, which can take a variety of shapes.
          We've created a group for you with three channels, one of each basic
          type.
        </SplashParagraph>
      </YStack>
      <SplashButton marginTop="$l" onPress={props.onActionPress}>
        Sounds fun
      </SplashButton>
    </YStack>
  );
}

export function InvitePane(props: { onActionPress: () => void }) {
  return (
    <YStack height={400} gap="$xl">
      <SplashTitle marginLeft="$l">
        Invite your <Text color="$positiveActionText">friends.</Text>
      </SplashTitle>
      <View
        borderRadius="$2xl"
        overflow="hidden"
        backgroundColor="$border"
        height={160}
        justifyContent="center"
        alignItems="center"
      >
        <Text size="$label/l">Placeholder</Text>
      </View>
      <YStack gap="$2xl">
        <SplashParagraph>
          Whatever your group is about, it’s more fun with friends. We make it
          easy for your friends to join the group on your node so you can have
          fun privately, securely, and in perpetuity.
        </SplashParagraph>
      </YStack>
      <SplashButton
        marginTop="$l"
        onPress={props.onActionPress}
        backgroundColor="$positiveActionText"
        textProps={{ color: '$white' }}
      >
        Take me to my group
      </SplashButton>
    </YStack>
  );
}
