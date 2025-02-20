import { useEmbed, utils, validOembedCheck } from '@tloncorp/shared';
import { Linking, Platform } from 'react-native';
import { Text } from 'tamagui';

import { useCalm } from '../../contexts';
import { AudioEmbed } from '../Embed';
import { Embed } from './Embed';
import { EmbedWebView } from './EmbedWebView';
import { getProviderConfig } from './providers';

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

interface GenericEmbedProps {
  provider: string;
  title: string;
  author?: string;
  description?: string;
  embedHtml?: string;
  thumbnailUrl?: string;
  openLink: () => void;
  height?: number;
  width?: number;
}

// Currently unused, could be used to display opengraph or oembed data
const GenericEmbed: React.FC<GenericEmbedProps> = ({
  provider,
  title,
  author,
  description,
  thumbnailUrl,
  openLink,
}) => {
  return (
    <Embed onPress={openLink}>
      <Embed.Header onPress={openLink}>
        <Embed.Title>{provider}</Embed.Title>
        <Embed.PopOutIcon type="ArrowRef" />
      </Embed.Header>
      <Embed.Preview onPress={openLink}>
        {thumbnailUrl && (
          <Embed.Thumbnail height={100} width={100} source={thumbnailUrl} />
        )}
        <Text lineHeight="$l" fontSize="$l" fontWeight="$xl">
          {title}
        </Text>
        {author && (
          <Text lineHeight="$xs" fontSize="$xs" color="$secondaryText">
            {author}
          </Text>
        )}
        {description && (
          <Text
            flexWrap="wrap"
            lineHeight="$m"
            fontSize="$s"
            color="$secondaryText"
            maxWidth="100%"
          >
            {description}
          </Text>
        )}
      </Embed.Preview>
    </Embed>
  );
};

interface EmbedContentProps {
  url: string;
  content?: string;
}

export default function EmbedContent({ url, content }: EmbedContentProps) {
  const { embed } = useEmbed(url);
  const isValidWithHtml = validOembedCheck(embed, url);
  const isValidWithoutHtml = embed && embed.title && embed.author_name;
  const calm = useCalm();

  const isAudio = utils.AUDIO_REGEX.test(url);
  const isTrusted = trustedProviders.some((provider) =>
    provider.regex.test(url)
  );

  const openLink = async () => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    }
  };

  if (!calm.disableRemoteContent) {
    if (isAudio) {
      return <AudioEmbed url={url} />;
    }

    if (isTrusted) {
      if (isValidWithHtml) {
        const {
          provider_name: provider,
          url: embedUrl,
          html: embedHtml,
        } = embed;

        const providerConfig = getProviderConfig(provider);

        if (providerConfig) {
          return (
            <EmbedWebView
              url={embedUrl ?? url}
              provider={providerConfig}
              embedHtml={embedHtml}
              onError={(error) => console.warn('Embed error:', error)}
            />
          );
        }
      }

      if (isValidWithoutHtml) {
        const { title, provider_name: provider, author_name: author } = embed;
        return (
          <GenericEmbed
            provider={provider}
            title={title}
            description={embed.description}
            thumbnailUrl={embed.thumbnail_url}
            author={author}
            openLink={openLink}
          />
        );
      }

      return (
        <Text
          onPress={openLink}
          textDecorationLine="underline"
          cursor="pointer"
        >
          {content || url}
        </Text>
      );
    }
  }

  return (
    <Text textDecorationLine="underline" cursor="pointer" onPress={openLink}>
      {content || url}
    </Text>
  );
}
