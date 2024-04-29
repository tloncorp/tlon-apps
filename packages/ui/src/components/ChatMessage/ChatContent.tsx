import { utils } from '@tloncorp/shared';
import {
  ContentReference as ContentReferenceType,
  PostContent,
} from '@tloncorp/shared/dist/api';
import {
  Block,
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
import { ReactElement, memo, useCallback, useMemo, useState } from 'react';
import {
  ImageLoadEventData,
  Linking,
  NativeSyntheticEvent,
  TouchableOpacity,
} from 'react-native';

import { Image, Text, View, XStack, YStack } from '../../core';
import { Button } from '../Button';
import ContactName from '../ContactName';
import ContentReference from '../ContentReference';
import Video from '../Video';

function ShipMention({ ship }: { ship: string }) {
  return (
    <Button
      // TODO: implement this once we have a profile screen or sheet
      // onPress={() => naivigate('Profile', { ship })}
      backgroundColor="$positiveBackground"
      paddingHorizontal="$xs"
      paddingVertical={0}
      borderRadius="$s"
    >
      <Text color="$positiveActionText" fontSize="$m">
        <ContactName name={ship} showAlias />
      </Text>
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
        backgroundColor="$secondaryBackground"
        padding="$xs"
        borderRadius="$s"
      >
        {story['inline-code']}
      </Text>
    );
  }

  if (isBlockCode(story)) {
    return (
      <View
        backgroundColor="$secondaryBackground"
        padding="$m"
        borderRadius="$s"
        marginBottom="$m"
      >
        <Text
          fontFamily="$mono"
          padding="$m"
          borderRadius="$s"
          backgroundColor="$secondaryBackground"
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

export function BlockContent({
  story,
  onPressImage,
}: {
  story: Block;
  onPressImage?: (src: string) => void;
}) {
  // TODO add support for other embeds and refs

  const [aspect, setAspect] = useState<number | null>(null);

  const handleImageLoaded = useCallback(
    (e: NativeSyntheticEvent<ImageLoadEventData>) => {
      //@ts-expect-error TODO: figure out why the type is wrong here.
      setAspect(e.nativeEvent.width / e.nativeEvent.height);
    },
    []
  );

  if (isImage(story)) {
    const isVideoFile = utils.VIDEO_REGEX.test(story.image.src);

    if (isVideoFile) {
      return <Video block={story} />;
    }

    return (
      <TouchableOpacity
        onPress={onPressImage ? () => onPressImage(story.image.src) : undefined}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri: story.image.src,
            width: story.image.height,
            height: story.image.width,
          }}
          alt={story.image.alt}
          borderRadius="$m"
          onLoad={handleImageLoaded}
          width={200}
          height={aspect ? 200 / aspect : 100}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  }
  console.error(`Unhandled message type: ${JSON.stringify(story)}`);
  return (
    <Text fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

const LineRenderer = memo(({ storyInlines }: { storyInlines: Inline[] }) => {
  const inlineElements: ReactElement[][] = [];
  let currentLine: ReactElement[] = [];

  storyInlines.forEach((inline, index) => {
    if (isBreak(inline)) {
      inlineElements.push(currentLine);
      currentLine = [];
    } else if (typeof inline === 'string') {
      if (utils.isSingleEmoji(inline)) {
        currentLine.push(
          <Text key={`emoji-${inline}-${index}`} fontSize="$xl">
            {inline}
          </Text>
        );
      } else {
        currentLine.push(
          <Text
            key={`string-${inline}-${index}`}
            fontSize="$m"
            lineHeight={'$m'}
          >
            {inline}
          </Text>
        );
      }
    } else if (isBlockquote(inline)) {
      currentLine.push(
        <YStack
          key={`blockquote-${index}`}
          borderLeftWidth={2}
          borderColor="$border"
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
});

LineRenderer.displayName = 'LineRenderer';

export default function ChatContent({
  story,
  onPressImage,
}: {
  story: PostContent;
  onPressImage?: (src: string) => void;
}) {
  const storyInlines = useMemo(
    () =>
      story !== null
        ? (story.filter((s) => 'inline' in s) as VerseInline[]).flatMap(
            (i) => i.inline
          )
        : [],
    [story]
  );
  const storyBlocks = useMemo(
    () =>
      story !== null ? (story.filter((s) => 'block' in s) as VerseBlock[]) : [],
    [story]
  );
  const storyReferences = useMemo(
    () =>
      story !== null
        ? (story.filter(
            (s) => 'type' in s && s.type == 'reference'
          ) as ContentReferenceType[])
        : [],
    [story]
  );
  const inlineLength = useMemo(() => storyInlines.length, [storyInlines]);
  const blockLength = useMemo(() => storyBlocks.length, [storyBlocks]);
  const referenceLength = useMemo(
    () => storyReferences.length,
    [storyReferences]
  );
  const blockContent = useMemo(
    () =>
      storyBlocks.sort((a, b) => {
        // Sort images to the end
        if (isImage(a) && !isImage(b)) {
          return 1;
        }
        if (!isImage(a) && isImage(b)) {
          return -1;
        }
        return 0;
      }),
    [storyBlocks]
  );

  if (blockLength === 0 && inlineLength === 0 && referenceLength === 0) {
    return null;
  }

  return (
    <YStack>
      {referenceLength > 0 ? (
        <YStack gap="$s">
          {storyReferences.map((ref, key) => {
            return <ContentReference key={key} reference={ref} />;
          })}
        </YStack>
      ) : null}
      {blockLength > 0 ? (
        <YStack>
          {blockContent
            .filter((a) => !!a)
            .map((storyItem, key) => {
              return (
                <BlockContent
                  key={key}
                  story={storyItem.block}
                  onPressImage={onPressImage}
                />
              );
            })}
        </YStack>
      ) : null}
      {inlineLength > 0 ? <LineRenderer storyInlines={storyInlines} /> : null}
    </YStack>
  );
}
