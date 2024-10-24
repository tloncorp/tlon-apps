import { extractContentTypesFromPost } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';
import { Story } from '@tloncorp/shared/dist/urbit';
import { useMemo } from 'react';
import { Image, View, XStack } from 'tamagui';

import { useContact } from '../../contexts';
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
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
}) {
  const image = useMemo(() => {
    const content = extractContentTypesFromPost(post);
    return content.blocks.find((b): b is ub.Image => 'image' in b);
  }, [post]);
  const postContact = useContact(post.authorId);

  if (!image) return null;
  return (
    <View padding="$s" paddingVertical="$xs">
      <View
        borderColor="$border"
        borderWidth={1}
        borderRadius={'$m'}
        overflow="hidden"
      >
        <Image
          width={'100%'}
          aspectRatio={image.image.width / image.image.height}
          source={{ uri: image.image.src }}
        />
        <XStack
          position="absolute"
          backgroundColor={postContact?.color || 'black'}
          top={0}
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
