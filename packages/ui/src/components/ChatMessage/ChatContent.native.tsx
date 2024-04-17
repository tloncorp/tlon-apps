import { utils } from '@tloncorp/shared';
import {
  Block,
  Story,
  VerseBlock,
  VerseInline,
  isImage,
} from '@tloncorp/shared/dist/urbit/channel';
import {
  Inline,
  isBlockCode,
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isShip,
  isStrikethrough,
} from '@tloncorp/shared/dist/urbit/content';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { Image, Text, View, XStack, YStack } from '../../core';
import { Button } from '../Button';
import ContactName from '../ContactName';

function ShipMention({ ship }: { ship: string }) {
  return (
    <Button
      // TODO: implement this once we have a profile screen or sheet
      // onPress={() => naivigate('Profile', { ship })}
      backgroundColor="$blueSoft"
      paddingHorizontal="$xs"
      paddingVertical={0}
      borderRadius="$xl"
    >
      <ContactName name={ship} showAlias />
    </Button>
  );
}

export function InlineContent({ story }: { story: Inline | null }) {
  if (story === null) {
    return null;
  }
  if (typeof story === 'string') {
    if (utils.isSingleEmoji(story)) {
      return (
        <Text paddingTop="$xl" fontSize="$xl">
          {story}
        </Text>
      );
    }
    return (
      <Text color="$primaryText" fontSize="$m">
        {story}
      </Text>
    );
  }

  if (isBold(story)) {
    return (
      <>
        {story.bold.map((s, k) => (
          <Text fontSize="$m" fontWeight="bold" key={k}>
            <InlineContent story={s} />
          </Text>
        ))}
      </>
    );
  }

  if (isItalics(story)) {
    return (
      <>
        {story.italics.map((s, k) => (
          <Text fontSize="$m" fontStyle="italic" key={k}>
            <InlineContent story={s} />
          </Text>
        ))}
      </>
    );
  }

  if (isStrikethrough(story)) {
    return (
      <>
        {story.strike.map((s, k) => (
          <Text fontSize="$m" textDecorationLine="line-through" key={k}>
            <InlineContent story={s} />
          </Text>
        ))}
      </>
    );
  }

  if (isInlineCode(story)) {
    return (
      <Text
        fontFamily="$mono"
        backgroundColor="$gray100"
        padding="$xs"
        borderRadius="$xl"
      >
        {story['inline-code']}
      </Text>
    );
  }

  if (isBlockCode(story)) {
    return (
      <View
        backgroundColor="$gray100"
        padding="$m"
        borderRadius="$xl"
        marginBottom="$m"
      >
        <Text
          fontFamily="$mono"
          padding="$m"
          borderRadius="$xl"
          backgroundColor="$gray100"
        >
          {story.code}
        </Text>
      </View>
    );
  }

  if (isLink(story)) {
    const supported = Linking.canOpenURL(story.link.href);

    if (!supported) {
      return (
        <Text textDecorationLine="underline">
          <InlineContent story={story.link.content} />
        </Text>
      );
    }

    return (
      <Text
        textDecorationLine="underline"
        onPress={() => Linking.openURL(story.link.href)}
      >
        <InlineContent story={story.link.content} />
      </Text>
    );
  }

  if (isBreak(story)) {
    return <Text height="$s" />;
  }
  if (isShip(story)) {
    return <ShipMention ship={story.ship} />;
  }
  console.error(`Unhandled message type: ${JSON.stringify(story)}`);
  return (
    <Text color="$primaryText" fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

export function BlockContent({ story }: { story: Block }) {
  // TODO add support for other embeds and refs

  if (isImage(story)) {
    const isVideoFile = utils.VIDEO_REGEX.test(story.image.src);

    if (isVideoFile) {
      console.log('is video file');
      const videoRef = useRef<Video | null>(null);
      const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus>();

      console.log({ playbackStatus });

      useEffect(() => {
        if (!videoRef.current || !playbackStatus || !playbackStatus.isLoaded) {
          return;
        }

        if (playbackStatus.isPlaying) {
          videoRef.current?.presentFullscreenPlayer();
        }

        if (playbackStatus.didJustFinish) {
          videoRef.current?.dismissFullscreenPlayer();
        }
      }, [playbackStatus]);

      return (
        <View flex={1}>
          <Video
            ref={videoRef}
            source={{ uri: story.image.src }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            onFullscreenUpdate={(event) => {
              if (event.fullscreenUpdate === 2) {
                videoRef.current?.pauseAsync();
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              setPlaybackStatus(status);
            }}
            style={{ width: 200, height: 200 }}
          />
        </View>
      );
    }

    return (
      <Image
        source={{
          uri: story.image.src,
          width: story.image.height,
          height: story.image.width,
        }}
        alt={story.image.alt}
        borderRadius="$m"
        height={200}
        width={200}
        resizeMode="contain"
      />
    );
  }
  console.error(`Unhandled message type: ${JSON.stringify(story)}`);
  return (
    <Text fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

function LineRenderer({ storyInlines }: { storyInlines: Inline[] }) {
  const inlineElements: ReactElement[][] = [];
  let currentLine: ReactElement[] = [];

  storyInlines.forEach((inline, index) => {
    if (isBreak(inline)) {
      inlineElements.push(currentLine);
      currentLine = [];
    } else if (typeof inline === 'string') {
      if (utils.isSingleEmoji(inline)) {
        currentLine.push(
          <Text
            key={`emoji-${inline}-${index}`}
            paddingTop="$xl"
            fontSize="$xl"
          >
            {inline}
          </Text>
        );
      } else {
        currentLine.push(
          <Text key={`string-${inline}-${index}`} fontSize="$m">
            {inline}
          </Text>
        );
      }
    } else if (isBlockquote(inline)) {
      currentLine.push(
        <YStack
          key={`blockquote-${index}`}
          borderLeftWidth={2}
          borderLeftColor="$gray100"
          paddingLeft="$l"
        >
          {Array.isArray(inline.blockquote) ? (
            <LineRenderer storyInlines={inline.blockquote} />
          ) : (
            // not clear if this is necessary
            <InlineContent story={inline.blockquote} />
          )}
        </YStack>
      );
    } else {
      currentLine.push(
        <InlineContent key={`inline-${index}`} story={inline} />
      );
    }
  });

  if (currentLine.length > 0) {
    inlineElements.push(currentLine);
  }

  return (
    <>
      {inlineElements.map((line, index) => {
        if (line.length === 0) {
          return (
            <XStack alignItems="center" key={`line-${index}`}>
              <Text height="$xl">{'\n'}</Text>
            </XStack>
          );
        }

        return (
          <XStack alignItems="center" key={`line-${index}`} flexWrap="wrap">
            {line}
          </XStack>
        );
      })}
    </>
  );
}

export default function ChatContent({ story }: { story: Story }) {
  const storyInlines = (
    story.filter((s) => 'inline' in s) as VerseInline[]
  ).flatMap((i) => i.inline);
  const storyBlocks = story.filter((s) => 'block' in s) as VerseBlock[];
  const inlineLength = storyInlines.length;
  const blockLength = storyBlocks.length;
  const blockContent = storyBlocks.sort((a, b) => {
    // Sort images to the end
    if (isImage(a) && !isImage(b)) {
      return 1;
    }
    if (!isImage(a) && isImage(b)) {
      return -1;
    }
    return 0;
  });

  if (blockLength === 0 && inlineLength === 0) {
    return null;
  }

  return (
    <YStack>
      {blockLength > 0 ? (
        <YStack>
          {blockContent
            .filter((a) => !!a)
            .map((storyItem, key) => {
              return <BlockContent key={key} story={storyItem.block} />;
            })}
        </YStack>
      ) : null}
      {inlineLength > 0 ? <LineRenderer storyInlines={storyInlines} /> : null}
    </YStack>
  );
}
