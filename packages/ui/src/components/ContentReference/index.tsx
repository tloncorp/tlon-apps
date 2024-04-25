import { ContentReference as ContentReferenceType } from '@tloncorp/shared/dist/api';
import { TouchableOpacity } from 'react-native';

import { Text } from '../../core';
import ChannelReference from './ChannelReference';

export default function ContentReference({
  reference,
}: {
  reference: ContentReferenceType;
}) {
  if (reference.referenceType === 'channel') {
    return (
      <ChannelReference
        channelId={reference.channelId}
        postId={reference.postId}
      />
    );
  }

  if (reference.referenceType === 'group') {
    return (
      <TouchableOpacity>
        <Text fontSize="$m" color="$primaryText" marginLeft="$s">
          Group
        </Text>
      </TouchableOpacity>
    );
  }

  if (reference.referenceType === 'app') {
    return (
      <TouchableOpacity>
        <Text fontSize="$m" color="$primaryText" marginLeft="$s">
          App
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity>
      <Text fontSize="$m" color="$primaryText" marginLeft="$s">
        Unhandled reference type
      </Text>
    </TouchableOpacity>
  );
}
