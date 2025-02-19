import { useEmbed, utils, validOembedCheck } from '@tloncorp/shared';
import { Linking, TouchableOpacity } from 'react-native';
import { View } from 'tamagui';

import { useCalm } from '../../contexts';
import { AudioEmbed, OutsideEmbed } from '../Embed';
import { Icon } from '../Icon';
import { ImageWithFallback } from '../Image';
import { Text } from '../TextV2';

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
  {
    name: 'TikTok',
    regex: /^https:\/\/www\.tiktok\.com\//,
  },
];

export default function ChatEmbedContent({
  url,
  content,
  onPressImage,
  onLongPress,
}: {
  url: string;
  content: string;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  const isAudio = utils.AUDIO_REGEX.test(url);
  const isImage = utils.IMAGE_REGEX.test(url);
  const isTrusted = trustedProviders.some((provider) =>
    provider.regex.test(url)
  );
  const calm = useCalm();
  const openLink = async () => {
    await Linking.openURL(url);
  };

  if (!calm.disableRemoteContent) {
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
                <Text color="$tertiaryText">Unable to load image</Text>
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

    if (isTrusted) {
      return <OutsideEmbed url={url} />;
    }
  }

  return (
    <Text textDecorationLine="underline" cursor="pointer" onPress={openLink}>
      {content || url}
    </Text>
  );
}
