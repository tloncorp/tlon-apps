import { useEmbed, validOembedCheck } from '@tloncorp/shared';
import { Linking, Platform } from 'react-native';
import { Text, YStack } from 'tamagui';

import { Embed } from './Embed';
import { EmbedWebView } from './EmbedWebView';
import { getProviderConfig } from './providers';

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

export default function OutsideEmbed({ url }: { url: string }) {
  const { embed } = useEmbed(url);
  const isValidWithHtml = validOembedCheck(embed, url);
  const isValidWithoutHtml = embed && embed.title && embed.author_name;

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

  if (isValidWithHtml) {
    const {
      title,
      provider_name: provider,
      url: embedUrl,
      author_name: author,
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

  const fallBackProvider = url.split('/')[2].split('.')[1];
  const fallBackProviderName =
    fallBackProvider.charAt(0).toUpperCase() + fallBackProvider.slice(1);
  const fallBackTitle = `Open in ${fallBackProviderName}`;

  return (
    <GenericEmbed
      provider={fallBackProviderName}
      title={fallBackTitle}
      openLink={openLink}
    />
  );
}
