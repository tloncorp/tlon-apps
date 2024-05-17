import { ContentReference as ContentReferenceType } from '@tloncorp/shared/dist/api';

import { Text } from '../../core';
import Pressable from '../Pressable';
import ChannelReference from './ChannelReference';

export default function ContentReference({
  reference,
  asAttachment = false,
  inGalleryPost = false,
}: {
  reference: ContentReferenceType;
  asAttachment?: boolean;
  inGalleryPost?: boolean;
}) {
  if (reference.referenceType === 'channel') {
    return (
      <ChannelReference
        channelId={reference.channelId}
        postId={reference.postId}
        asAttachment={asAttachment}
        inGalleryPost={inGalleryPost}
      />
    );
  }

  if (reference.referenceType === 'group') {
    return (
      <Pressable>
        <Text fontSize="$m" color="$primaryText" marginLeft="$s">
          Group
        </Text>
      </Pressable>
    );
  }

  if (reference.referenceType === 'app') {
    return (
      <Pressable>
        <Text fontSize="$m" color="$primaryText" marginLeft="$s">
          App
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable>
      <Text fontSize="$m" color="$primaryText" marginLeft="$s">
        Unhandled reference type
      </Text>
    </Pressable>
  );
}
