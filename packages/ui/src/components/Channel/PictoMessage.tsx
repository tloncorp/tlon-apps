import { extractContentTypesFromPost } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as ub from '@tloncorp/shared/urbit';
import { Story } from '@tloncorp/shared/urbit';
import { useMemo } from 'react';
import { Image, View, XStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import ContactName from '../ContactName';

export function PictoMessage({
  post,
}: {
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  onPress?: (post: db.Post) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
}) {
  const image = useMemo(() => {
    const content = extractContentTypesFromPost(post);
    return content.blocks.find((b): b is ub.Image => 'image' in b);
  }, [post]);

  if (!image) return null;
  return (
    <View padding="$s" paddingVertical="$xs">
      <View borderColor="$border" borderWidth={1} borderRadius={'$m'}>
        <Image
          width={'100%'}
          aspectRatio={image.image.width / image.image.height}
          source={{ uri: image.image.src }}
        />
        <XStack
          position="absolute"
          top={'100%'}
          left={0}
          padding="$s"
          paddingRight="$m"
          gap="$m"
          alignItems={'center'}
          borderBottomRightRadius={'$m'}
        >
          <ContactAvatar size="$xl" contactId={post.authorId}></ContactAvatar>
          <ContactName size="$s" maxWidth={'unset'} userId={post.authorId} />
        </XStack>
      </View>
    </View>
  );
}
