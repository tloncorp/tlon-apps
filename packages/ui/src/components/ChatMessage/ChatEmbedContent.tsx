import { useEmbed, utils, validOembedCheck } from '@tloncorp/shared';
import { Linking, TouchableOpacity } from 'react-native';
import { SizableText, View } from 'tamagui';

import { useCalm } from '../../contexts';
import { PostViewMode } from '../ContentRenderer';
import { AudioEmbed, OutsideEmbed, VideoEmbed } from '../Embed';
import { Icon } from '../Icon';
import { ImageWithFallback } from '../Image';

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
    await Linking.openURL(url);
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
          <ImageWithFallback
            source={{
              uri: url,
            }}
            borderRadius="$m"
            width={200}
            fallback={
              <View width={200} alignItems="center" justifyContent="center">
                <Icon type="Placeholder" color="$tertiaryText" />
                <SizableText color="$tertiaryText">
                  Unable to load image
                </SizableText>
              </View>
            }
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
    <SizableText
      textDecorationLine="underline"
      size={viewMode === 'block' || viewMode === 'activity' ? '$s' : '$m'}
      onPress={openLink}
    >
      {content || url}
    </SizableText>
  );
}
