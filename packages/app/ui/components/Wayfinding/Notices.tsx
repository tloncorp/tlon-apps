import * as db from '@tloncorp/shared/db';
import { Button, Icon, Text } from '@tloncorp/ui';
import { View, XStack, YStack, isWeb, styled } from 'tamagui';

const NoticeContainer = styled(YStack, {
  backgroundColor: '$positiveBackground',
  padding: '$2xl',
  borderRadius: '$l',
  maxWidth: 600,
});

const NoticeText = styled(Text, {
  size: '$body',
});

const WayfindingNotice = {
  EmptyChannel,
  GroupChannels,
  CustomizeGroup,
};
export default WayfindingNotice;

function EmptyChannel({ channel }: { channel: db.Channel }) {
  if (channel.type === 'gallery') {
    return (
      <View
        flex={1}
        justifyContent="flex-start"
        alignItems="center"
        marginHorizontal="$2xl"
      >
        <EmptyPersonalGallery />
      </View>
    );
  }

  if (channel.type === 'notebook') {
    return (
      <View
        flex={1}
        justifyContent="flex-start"
        alignItems="center"
        marginHorizontal="$2xl"
      >
        <EmptyPersonalNotebook />
      </View>
    );
  }

  return (
    <View
      flex={1}
      justifyContent="flex-end"
      alignItems="flex-start"
      marginHorizontal="$2xl"
    >
      <EmptyPersonalChat />
    </View>
  );
}

function EmptyPersonalChat() {
  return (
    <NoticeContainer>
      <NoticeText>
        This is a Chat channel, best for real-time messaging. You can send text,
        images, and links. You can also react to messages, quote them, and reply
        in threads.
      </NoticeText>
    </NoticeContainer>
  );
}

function EmptyPersonalGallery() {
  return (
    <NoticeContainer>
      <NoticeText>
        This is a Gallery channel, best for storing images and links. You can
        react to and comment on posts.
      </NoticeText>
    </NoticeContainer>
  );
}

function EmptyPersonalNotebook() {
  return (
    <NoticeContainer>
      <NoticeText>
        This is a Notebook channel, best for posting long-form thoughts and
        writing. You can edit and comment on posts.
      </NoticeText>
    </NoticeContainer>
  );
}

function GroupChannels(props: { onPressCta?: () => void }) {
  return (
    <View
      paddingHorizontal={isWeb ? 'unset' : '$xl'}
      marginVertical={isWeb ? '$xl' : 'unset'}
    >
      <NoticeContainer gap="$xl">
        <NoticeText>
          Welcome to your group! We’ve created three basic channels to get you
          started. Tap into each to explore how Tlon Messenger works.
        </NoticeText>
        {/* <Button
          backgroundColor="$positiveActionText"
          justifyContent="space-between"
          padding="$xl"
          onPress={props.onPressCta}
        >
          <XStack alignItems="center" gap="$m">
            <Button.Icon color="$white">
              <Icon type="Link" color="white" />
            </Button.Icon>
            <Button.Text color="$white">Invite Friends</Button.Text>
          </XStack>
          <Button.Icon color="$white">
            <Icon type="ChevronRight" color="white" />
          </Button.Icon>
        </Button> */}
      </NoticeContainer>
    </View>
  );
}

function CustomizeGroup() {
  return (
    <View marginHorizontal="$2xl">
      <NoticeContainer>
        <NoticeText>
          You can customize the appearance of your group before you send it to
          your friends.
        </NoticeText>
      </NoticeContainer>
    </View>
  );
}
