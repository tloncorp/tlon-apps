import { useEmbed, utils, validOembedCheck } from '@tloncorp/shared';
import { TouchableOpacity } from 'react-native';
import { Linking } from 'react-native';

import { useCalm } from '../../contexts';
import { Image, Text } from '../../core';
import { AudioEmbed, OutsideEmbed, VideoEmbed } from '../Embed';
import { PostViewMode } from './ChatContent';

const trustedProviders = [
  {
    name: 'YouTube',
    regex: /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=|youtu\.be\//,
  },
  {
    name: 'Twitter',
    regex: /^https:\/\/(?:twitter\.com|x\.com)\/\w+\/status\//,
  },
  {
    name: 'Spotify',
    regex: /^https:\/\/open\.spotify\.com\//,
  },
];

export default function ChatEmbedContent({
  url,
  content,
  onPressImage,
  onLongPress,
  viewMode = 'chat',
}: {
  url: string;
  content: string;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
  viewMode?: PostViewMode;
}) {
  const isAudio = utils.AUDIO_REGEX.test(url);
  const isVideo = utils.VIDEO_REGEX.test(url);
  const isImage = utils.IMAGE_REGEX.test(url);
  const isTrusted = trustedProviders.some((provider) =>
    provider.regex.test(url)
  );
  const embed = useEmbed(url);
  const isOembed = isTrusted && validOembedCheck(embed, url);
  const calm = useCalm();
  const openLink = async () => {
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  };

  if (!calm.disableRemoteContent) {
    if (isVideo) {
      return <VideoEmbed url={url} />;
    }

    if (isImage) {
      return (
        <TouchableOpacity
          onPress={onPressImage ? () => onPressImage(url) : undefined}
          onLongPress={onLongPress}
          activeOpacity={0.9}
        >
          <Image
            source={{
              uri: url,
            }}
            borderRadius="$m"
            width={200}
            backgroundColor={'$secondaryBackground'}
          />
        </TouchableOpacity>
      );
    }

    if (isAudio) {
      return <AudioEmbed url={url} />;
    }

    if (isOembed) {
      return <OutsideEmbed url={url} />;
    }
  }

  return (
    <Text
      textDecorationLine="underline"
      fontSize={viewMode === 'block' ? '$s' : '$m'}
      lineHeight="$m"
      onPress={openLink}
    >
      {content}
    </Text>
  );
}
