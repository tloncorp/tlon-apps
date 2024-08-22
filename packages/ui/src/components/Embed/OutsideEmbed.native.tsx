import { useEmbed, validOembedCheck } from '@tloncorp/shared';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import WebView from 'react-native-webview';
import { MediaDetails, Tweet, getTweet } from 'react-tweet/api';
import { Text, YStack } from 'tamagui';

import { Image } from '../Image';
import { Embed } from './Embed';

// this is a basic twitter embed, we could use the react-tweet api
// to build a richer one.
// The preview is a truncated version of the tweet text and the author
// The modal shows the full tweet text and the first photo if there is one
const TwitterEmbed = ({
  embedHtml,
  openLink,
}: {
  embedHtml: string;
  openLink: () => void;
}) => {
  const [showModal, setShowModal] = useState(false);
  const [tweet, setTweet] = useState<Tweet>();
  // find the tweet url
  const tweetUrl = embedHtml.match(
    /https:\/\/twitter.com\/[^/]+\/status\/[^/]+/g
  )?.[0];

  // extract the tweet id from the url, strip out any query params
  const tweetIdFromUrl = tweetUrl?.split('/status/')[1].split('?')[0];

  useEffect(() => {
    const fetchTweet = async () => {
      const tweetFromApi = await getTweet(tweetIdFromUrl!);
      if (!tweetFromApi) return;
      setTweet(tweetFromApi);
    };

    if (tweetIdFromUrl) {
      fetchTweet();
    }
  }, [tweetIdFromUrl]);

  if (!tweetIdFromUrl || !tweet) {
    return (
      <GenericEmbedFallback
        provider="Twitter"
        title="Open in Twitter"
        openLink={openLink}
      />
    );
  }

  const tweetDisplayText = tweet.text.slice(
    tweet.display_text_range[0],
    tweet.display_text_range[1]
  );
  const truncatedDisplayText =
    tweetDisplayText.length > 128
      ? `${tweetDisplayText.slice(0, 128)}...`
      : tweetDisplayText;
  const tweetPhotos = tweet.mediaDetails?.filter(
    (media: MediaDetails) => media.type === 'photo'
  );
  const firstPhoto = tweetPhotos?.[0];

  return (
    <Embed width={250}>
      <Embed.Header onPress={openLink}>
        <Embed.Title>Twitter</Embed.Title>
        <Embed.PopOutIcon />
      </Embed.Header>
      <Embed.Preview onPress={() => setShowModal(true)}>
        <YStack gap="$s">
          <YStack
            gap="$s"
            borderLeftWidth={2}
            borderColor="$border"
            paddingLeft="$l"
          >
            <Text>{truncatedDisplayText}</Text>
          </YStack>
          <Text color="$tertiaryText">
            {tweet.user.name} (@{tweet.user.screen_name})
          </Text>
        </YStack>
      </Embed.Preview>
      <Embed.Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        onPress={openLink}
        height="auto"
        width={250}
      >
        <YStack gap="$s">
          <YStack
            gap="$s"
            borderLeftWidth={2}
            borderColor="$border"
            paddingLeft="$l"
          >
            <Text>{tweetDisplayText}</Text>
            {firstPhoto && (
              <Image
                source={{ uri: firstPhoto.media_url_https }}
                height={100}
                width={100}
              />
            )}
          </YStack>
          <Text color="$tertiaryText">
            {tweet.user.name} (@{tweet.user.screen_name})
          </Text>
        </YStack>
      </Embed.Modal>
    </Embed>
  );
};

const GenericEmbed = ({
  provider,
  title,
  author,
  embedHtml,
  openLink,
  height,
  width,
}: {
  provider: string;
  title: string;
  author?: string;
  embedHtml: string;
  openLink: () => void;
  height?: number;
  width?: number;
}) => {
  const [showModal, setShowModal] = useState(false);
  return (
    <Embed>
      <Embed.Header onPress={openLink}>
        <Embed.Title>{provider}</Embed.Title>
        <Embed.PopOutIcon />
      </Embed.Header>
      <Embed.Preview onPress={() => setShowModal(true)}>
        <YStack>
          <Text>{title}</Text>
          {author && <Text>{author}</Text>}
        </YStack>
      </Embed.Preview>
      <Embed.Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        height={height ? height + 12 : undefined}
        width={width ? width + 12 : undefined}
      >
        <WebView
          bounces={false}
          style={{ width, height }}
          source={{ html: embedHtml }}
          automaticallyAdjustContentInsets={false}
        />
      </Embed.Modal>
    </Embed>
  );
};

const GenericEmbedFallback = ({
  provider,
  title,
  author,
  openLink,
}: {
  provider: string;
  title: string;
  author?: string;
  openLink: () => void;
}) => {
  return (
    <Embed>
      <Embed.Header onPress={openLink}>
        <Embed.Title>{provider}</Embed.Title>
        <Embed.PopOutIcon />
      </Embed.Header>
      <Embed.Preview onPress={openLink}>
        <YStack>
          <Text>{title}</Text>
          {author && <Text>{author}</Text>}
        </YStack>
      </Embed.Preview>
    </Embed>
  );
};

export default function OutsideEmbed({ url }: { url: string }) {
  const { embed } = useEmbed(url);
  const isValid = validOembedCheck(embed, url);
  const fallBackProvider = url.split('/')[2].split('.')[1];
  const fallBackProviderName =
    fallBackProvider.charAt(0).toUpperCase() + fallBackProvider.slice(1);
  const fallBackTitle = `Open in ${fallBackProviderName}`;
  const openLink = async () => {
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  };

  if (isValid) {
    const {
      title,
      // TODO: Maybe use thumbnail?
      // thumbnail_url: thumbnail,
      provider_name: provider,
      url: embedUrl,
      author_name: author,
      html: embedHtmlReturned,
    } = embed;

    let embedHtml = '';
    let height = 120;
    let width = undefined;

    if (provider === 'YouTube') {
      height = 240;
      width = 320;
      const videoId = embedUrl.split('v=')[1];
      embedHtml = `
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${videoId}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
        </iframe>`;
    }

    if (provider === 'Spotify') {
      const playlistOrTrack = url.split('/')[3];
      const id = url.split('/')?.pop()?.split('?')[0];
      width = 330;
      embedHtml = `
        <iframe
          style="width: 100%; height: 100%;"
          src="https://open.spotify.com/embed/${playlistOrTrack}/${id}"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      `;
    }

    if (provider === 'Twitter') {
      return <TwitterEmbed embedHtml={embedHtmlReturned} openLink={openLink} />;
    }

    return (
      <GenericEmbed
        provider={provider}
        title={title}
        author={author}
        embedHtml={embedHtml}
        openLink={openLink}
        height={height}
        width={width}
      />
    );
  }

  return (
    <GenericEmbedFallback
      provider={fallBackProviderName}
      title={fallBackTitle}
      openLink={openLink}
    />
  );
}
