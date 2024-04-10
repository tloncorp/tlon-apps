import * as db from '@tloncorp/shared/dist/db/types';

import { Dialog, View, XStack, YStack } from '../../core';
import { ActionList } from '../ActionList';
import ChatMessage from '../ChatMessage';
import { SizableEmoji } from '../Emoji/SizableEmoji';
import { Icon } from '../Icon';

export function ChatMessageActions({ post }: { post: db.PostWithRelations }) {
  return (
    <>
      <Dialog.Overlay
        // should we just have zIndex modal overlay and modal content tokens?
        zIndex="$zIndex.l"
        flex={1}
        backgroundColor="$darkOverlay"
      />
      <Dialog.Content zIndex="$zIndex.xl" unstyled>
        <YStack gap="$xs">
          <EmojiToolbar />
          <MessageContainer post={post} />
          <MessageActions />
        </YStack>
      </Dialog.Content>
    </>
  );
}

function EmojiToolbar() {
  return (
    <XStack
      padding="$l"
      backgroundColor="$positiveBackground"
      borderRadius="$l"
      justifyContent="space-between"
      width={256}
    >
      <SizableEmoji shortCode="seedling" fontSize={32} />
      <SizableEmoji shortCode="cyclone" fontSize={32} />
      <SizableEmoji shortCode="hot_pepper" fontSize={32} />
      <SizableEmoji shortCode="jack_o_lantern" fontSize={32} />
      <Icon type="ChevronDown" size="$l" />
    </XStack>
  );
}

function MessageActions() {
  return (
    <ActionList>
      <ActionList.Action>Reply</ActionList.Action>
      <ActionList.Action>Start thread</ActionList.Action>
      <ActionList.Action actionType="destructive" last>
        Delete message
      </ActionList.Action>
    </ActionList>
  );
}

function MessageContainer({ post }: { post: db.PostWithRelations }) {
  return (
    <View backgroundColor="$positiveBackground" padding="$l" borderRadius="$l">
      <ChatMessage post={post} />
    </View>
  );
}
