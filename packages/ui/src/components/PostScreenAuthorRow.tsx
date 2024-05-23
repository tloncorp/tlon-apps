import type * as db from '@tloncorp/shared/dist/db';

import { SizableText, XStack } from '../core';
import { Avatar } from './Avatar';
import ContactName from './ContactName';
import { ListItem } from './ListItem';
import Pressable from './Pressable';

export default function PostScreenAuthorRow({
  parentPost,
  timeDisplay,
  setShowComments,
}: {
  parentPost: db.Post;
  timeDisplay: string;
  setShowComments: (show: boolean) => void;
}) {
  return (
    <Pressable onPress={() => setShowComments(true)}>
      <XStack
        padding="$l"
        alignItems="center"
        gap="$s"
        justifyContent="space-between"
      >
        <XStack maxWidth="80%" gap="$s" alignItems="center">
          <Avatar
            size="$2xl"
            contact={parentPost.author}
            contactId={parentPost.authorId}
          />
          <ContactName
            maxWidth="80%"
            showNickname
            fontWeight="500"
            userId={parentPost.authorId}
          />
        </XStack>
        <XStack gap="$s" alignItems="center">
          <SizableText color="$primaryText" size="$xs">
            {timeDisplay}
          </SizableText>
          <ListItem.Count>{parentPost.replyCount ?? 0}</ListItem.Count>
        </XStack>
      </XStack>
    </Pressable>
  );
}
