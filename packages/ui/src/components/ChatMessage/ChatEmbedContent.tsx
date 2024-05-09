import { useEmbed, utils, validOembedCheck } from '@tloncorp/shared';
import { Linking } from 'react-native';

import { useCalm } from '../../contexts';
import { Text } from '../../core';
import { AudioEmbed, OutsideEmbed, VideoEmbed } from '../Embed';
import { InlineContent } from './ChatContent';

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
}: {
  url: string;
  content: string;
}) {
  const isAudio = utils.AUDIO_REGEX.test(url);
  const isVideo = utils.VIDEO_REGEX.test(url);
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

    if (isAudio) {
      return <AudioEmbed url={url} />;
    }

    if (isOembed) {
      return <OutsideEmbed url={url} />;
    }
  }

  return (
    <Text textDecorationLine="underline" lineHeight="$m" onPress={openLink}>
      <InlineContent story={content} />
    </Text>
  );
}
