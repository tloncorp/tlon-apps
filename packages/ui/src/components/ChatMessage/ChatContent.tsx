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
import { ImageLoadEventData } from 'expo-image';
import { truncate } from 'lodash';
import { PostDeliveryStatus } from 'packages/shared/dist/db';
import { ReactElement, memo, useCallback, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { ColorTokens, Image, Text, View, XStack, YStack } from '../../core';
import ContactName from '../ContactName';
import ContentReference from '../ContentReference';
import { Icon } from '../Icon';
import ChatEmbedContent from './ChatEmbedContent';
import { ChatMessageDeliveryStatus } from './ChatMessageDeliveryStatus';

function ShipMention({ ship }: { ship: string }) {
  return (
    <ContactName
      onPress={() => {}}
      fontWeight={'500'}
      color="$positiveActionText"
      userId={ship}
      showNickname
    />
  );
}

export function InlineContent({
  story,
  color = '$primaryText',
}: {
  story: Inline | null;
  color?: ColorTokens;
}) {
  if (story === null) {
    return null;
  }
  if (typeof story === 'string') {
    if (utils.isSingleEmoji(story)) {
      return (
        <Text paddingTop="$xl" lineHeight="$m" fontSize="$xl">
          {story}
        </Text>
      );
    }
    return (
      <Text color={color} lineHeight="$m" fontSize="$m">
        {story}
      </Text>
    );
  }

  if (isBold(story)) {
    return (
      <>
        {story.bold.map((s, k) => (
          <Text fontSize="$m" lineHeight="$m" fontWeight="bold" key={k}>
            <InlineContent story={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isItalics(story)) {
    return (
      <>
        {story.italics.map((s, k) => (
          <Text fontSize="$m" lineHeight="$m" fontStyle="italic" key={k}>
            <InlineContent story={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isStrikethrough(story)) {
    return (
      <>
        {story.strike.map((s, k) => (
          <Text
            fontSize="$m"
            lineHeight="$m"
            textDecorationLine="line-through"
            key={k}
          >
            <InlineContent story={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isInlineCode(story)) {
    return (
      <Text
        fontFamily="$mono"
        color={color}
        backgroundColor="$secondaryBackground"
        padding="$xs"
        borderRadius="$s"
        lineHeight="$m"
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
          color={color}
          backgroundColor="$secondaryBackground"
          lineHeight="$m"
        >
          {story.code}
        </Text>
      </View>
    );
  }

  if (isLink(story)) {
    return (
      <ChatEmbedContent url={story.link.href} content={story.link.content} />
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
  onLongPress,
}: {
  story: Block;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  const [aspect, setAspect] = useState<number | null>(() => {
    return isImage(story) && story.image.height && story.image.width
      ? story.image.width / story.image.height
      : null;
  });

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
  }, []);

  if (isImage(story)) {
    const isVideoFile = utils.VIDEO_REGEX.test(story.image.src);

    if (isVideoFile) {
      return (
        <ChatEmbedContent url={story.image.src} content={story.image.src} />
      );
    }

    return (
      <TouchableOpacity
        onPress={onPressImage ? () => onPressImage(story.image.src) : undefined}
        onLongPress={onLongPress}
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
          backgroundColor={'$secondaryBackground'}
          height={aspect ? 200 / aspect : 100}
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

const LineRenderer = memo(
  ({
    storyInlines,
    color = '$primaryText',
    isNotice = false,
  }: {
    storyInlines: Inline[];
    color?: ColorTokens;
    isNotice?: boolean;
  }) => {
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
              fontSize="$xl"
              flexWrap="wrap"
            >
              {inline}
            </Text>
          );
        } else {
          currentLine.push(
            <Text
              key={`string-${inline}-${index}`}
              color={isNotice ? '$tertiaryText' : color}
              fontSize="$m"
              fontWeight={isNotice ? '500' : 'normal'}
              lineHeight="$m"
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
              <LineRenderer
                storyInlines={inline.blockquote}
                color="$secondaryText"
              />
            ) : (
              // not clear if this is necessary
              <InlineContent story={inline.blockquote} color="$secondaryText" />
            )}
          </YStack>
        );
        inlineElements.push(currentLine);
        currentLine = [];
      } else if (isShip(inline)) {
        currentLine.push(
          <ShipMention key={`ship-${index}`} ship={inline.ship} />
        );
      } else {
        currentLine.push(
          <InlineContent key={`inline-${index}`} story={inline} color={color} />
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
              <XStack key={`line-${index}`}>
                <Text height="$xl">{'\n'}</Text>
              </XStack>
            );
          }

          return (
            <Text key={`line-${index}`} flexWrap="wrap" lineHeight="$m">
              {line}
            </Text>
          );
        })}
      </>
    );
  }
);

LineRenderer.displayName = 'LineRenderer';

export default function ChatContent({
  story,
  shortened = false,
  isNotice = false,
  deliveryStatus,
  onPressImage,
  onLongPress,
}: {
  story: PostContent;
  shortened?: boolean;
  isNotice?: boolean;
  deliveryStatus?: PostDeliveryStatus | null;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
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
  const firstInlineIsMention = useMemo(
    () =>
      storyInlines.length > 0 &&
      typeof storyInlines[0] === 'object' &&
      'ship' in storyInlines[0],
    [storyInlines]
  );
  const shortenedStoryInlines = useMemo(
    () =>
      story !== null
        ? firstInlineIsMention
          ? storyInlines
              .map((i) =>
                typeof i === 'string'
                  ? truncate(i, { length: 100, omission: '' })
                  : i
              )
              .slice(0, 2)
              .concat('...')
          : storyInlines
              .map((i) =>
                typeof i === 'string'
                  ? truncate(i, { length: 100, omission: '' })
                  : i
              )
              .slice(0, 1)
              .concat('...')
        : [],
    [firstInlineIsMention, storyInlines, story]
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
    <YStack width="100%">
      {!shortened && referenceLength > 0 ? (
        <YStack gap="$s" paddingBottom="$l">
          {storyReferences.map((ref, key) => {
            return <ContentReference key={key} reference={ref} />;
          })}
        </YStack>
      ) : null}
      {!shortened && blockLength > 0 ? (
        <YStack>
          {blockContent
            .filter((a) => !!a)
            .map((storyItem, key) => {
              return (
                <BlockContent
                  key={key}
                  story={storyItem.block}
                  onPressImage={onPressImage}
                  onLongPress={onLongPress}
                />
              );
            })}
        </YStack>
      ) : null}
      <XStack justifyContent="space-between" alignItems="flex-start">
        {inlineLength > 0 ? (
          <View flexGrow={1} flexShrink={1}>
            <LineRenderer
              storyInlines={shortened ? shortenedStoryInlines : storyInlines}
              isNotice={isNotice}
            />
          </View>
        ) : null}
        {deliveryStatus ? (
          <View flexShrink={1}>
            <ChatMessageDeliveryStatus status={deliveryStatus} />
          </View>
        ) : null}
      </XStack>
    </YStack>
  );
}
