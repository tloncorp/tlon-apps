import { extractContentTypesFromPost, utils } from '@tloncorp/shared';
import { Block, isImage } from '@tloncorp/shared/dist/urbit/channel';
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
import { Post, PostDeliveryStatus } from 'packages/shared/dist/db';
import { ReactElement, memo, useCallback, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { ColorTokens, Image, Text, View, XStack, YStack } from '../../core';
import ContactName from '../ContactName';
import ContentReference from '../ContentReference';
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
  inline,
  color = '$primaryText',
  viewMode = 'chat',
  onPressImage,
  onLongPress,
}: {
  inline: Inline | null;
  color?: ColorTokens;
  viewMode?: PostViewMode;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  if (inline === null) {
    return null;
  }
  if (typeof inline === 'string') {
    if (utils.isSingleEmoji(inline)) {
      return (
        <Text paddingTop="$xl" lineHeight="$m" fontSize="$xl">
          {inline}
        </Text>
      );
    }
    return (
      <Text
        color={color}
        lineHeight="$m"
        fontSize={viewMode === 'block' ? '$s' : '$m'}
      >
        {inline}
      </Text>
    );
  }

  if (isBold(inline)) {
    return (
      <>
        {inline.bold.map((s, k) => (
          <Text fontSize="$m" lineHeight="$m" fontWeight="bold" key={k}>
            <InlineContent inline={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isItalics(inline)) {
    return (
      <>
        {inline.italics.map((s, k) => (
          <Text fontSize="$m" lineHeight="$m" fontStyle="italic" key={k}>
            <InlineContent inline={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isStrikethrough(inline)) {
    return (
      <>
        {inline.strike.map((s, k) => (
          <Text
            fontSize="$m"
            lineHeight="$m"
            textDecorationLine="line-through"
            key={k}
          >
            <InlineContent inline={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isInlineCode(inline)) {
    return (
      <Text
        fontFamily="$mono"
        color={color}
        backgroundColor="$secondaryBackground"
        padding="$xs"
        borderRadius="$s"
        lineHeight="$m"
      >
        {inline['inline-code']}
      </Text>
    );
  }

  if (isBlockCode(inline)) {
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
          {inline.code}
        </Text>
      </View>
    );
  }

  if (isLink(inline)) {
    return (
      <ChatEmbedContent
        viewMode={viewMode}
        url={inline.link.href}
        content={inline.link.content}
        onPressImage={onPressImage}
        onLongPress={onLongPress}
      />
    );
  }

  if (isBreak(inline)) {
    return <Text height="$s" />;
  }
  if (isShip(inline)) {
    return <ShipMention ship={inline.ship} />;
  }
  console.error(`Unhandled message type: ${JSON.stringify(inline)}`);
  return (
    <Text color="$primaryText" fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

export function BlockContent({
  block,
  onPressImage,
  onLongPress,
}: {
  block: Block;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  const [aspect, setAspect] = useState<number | null>(() => {
    return isImage(block) && block.image.height && block.image.width
      ? block.image.width / block.image.height
      : null;
  });

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
  }, []);

  if (isImage(block)) {
    const isVideoFile = utils.VIDEO_REGEX.test(block.image.src);

    if (isVideoFile) {
      return (
        <ChatEmbedContent url={block.image.src} content={block.image.src} />
      );
    }

    return (
      <TouchableOpacity
        onPress={onPressImage ? () => onPressImage(block.image.src) : undefined}
        onLongPress={onLongPress}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri: block.image.src,
            width: block.image.height,
            height: block.image.width,
          }}
          alt={block.image.alt}
          borderRadius="$m"
          onLoad={handleImageLoaded}
          width={200}
          backgroundColor={'$secondaryBackground'}
          height={aspect ? 200 / aspect : 100}
        />
      </TouchableOpacity>
    );
  }
  console.error(`Unhandled message type: ${JSON.stringify(block)}`);
  return (
    <Text fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

const LineRenderer = memo(
  ({
    inlines,
    onPressImage,
    onLongPress,
    color = '$primaryText',
    isNotice = false,
    viewMode = 'chat',
  }: {
    inlines: Inline[];
    onLongPress?: () => void;
    onPressImage?: (src: string) => void;
    color?: ColorTokens;
    isNotice?: boolean;
    viewMode?: PostViewMode;
  }) => {
    const inlineElements: ReactElement[][] = [];
    let currentLine: ReactElement[] = [];

    inlines.forEach((inline, index) => {
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
              fontSize={viewMode === 'block' ? '$s' : '$m'}
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
                inlines={inline.blockquote}
                color="$secondaryText"
              />
            ) : (
              // not clear if this is necessary
              <InlineContent
                inline={inline.blockquote}
                color="$secondaryText"
              />
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
          <InlineContent
            viewMode={viewMode}
            key={`inline-${index}`}
            inline={inline}
            color={color}
            onPressImage={onPressImage}
            onLongPress={onLongPress}
          />
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
            <Text
              fontSize={viewMode === 'block' ? '$s' : '$m'}
              key={`line-${index}`}
              flexWrap="wrap"
              lineHeight="$m"
            >
              {line}
            </Text>
          );
        })}
      </>
    );
  }
);

LineRenderer.displayName = 'LineRenderer';

export type PostViewMode = 'chat' | 'block' | 'note';

export default function ChatContent({
  post,
  shortened = false,
  isNotice = false,
  deliveryStatus,
  onPressImage,
  onLongPress,
  isEdited = false,
  viewMode = 'chat',
}: {
  post: Post;
  shortened?: boolean;
  isNotice?: boolean;
  deliveryStatus?: PostDeliveryStatus | null;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
  isEdited?: boolean;
  viewMode?: PostViewMode;
}) {
  const { inlines, blocks, references } = useMemo(
    () => extractContentTypesFromPost(post),
    [post]
  );

  const firstInlineIsMention = useMemo(
    () =>
      inlines.length > 0 &&
      typeof inlines[0] === 'object' &&
      'ship' in inlines[0],
    [inlines]
  );
  const shortenedInlines = useMemo(
    () =>
      inlines.length > 1
        ? firstInlineIsMention
          ? inlines
              .map((i) =>
                typeof i === 'string'
                  ? truncate(i, { length: 100, omission: '' })
                  : i
              )
              .slice(0, 2)
              .concat('...')
          : inlines
              .map((i) =>
                typeof i === 'string'
                  ? truncate(i, { length: 100, omission: '' })
                  : i
              )
              .slice(0, 1)
              .concat('...')
        : [],
    [firstInlineIsMention, inlines]
  );
  const blockContent = useMemo(
    () =>
      blocks.sort((a, b) => {
        // Sort images to the end
        if (isImage(a) && !isImage(b)) {
          return 1;
        }
        if (!isImage(a) && isImage(b)) {
          return -1;
        }
        return 0;
      }),
    [blocks]
  );

  if (blocks.length === 0 && inlines.length === 0 && references.length === 0) {
    return null;
  }

  return (
    <YStack width="100%">
      {!shortened && references.length > 0 ? (
        <YStack gap="$s" paddingBottom="$l">
          {references.map((ref, key) => {
            return <ContentReference key={key} reference={ref} />;
          })}
        </YStack>
      ) : null}
      {!shortened && blocks.length > 0 ? (
        <YStack>
          {blockContent
            .filter((a) => !!a)
            .map((block, key) => {
              return (
                <BlockContent
                  key={key}
                  block={block}
                  onPressImage={onPressImage}
                  onLongPress={onLongPress}
                />
              );
            })}
        </YStack>
      ) : null}
      <XStack justifyContent="space-between" alignItems="flex-start">
        {inlines.length > 0 ? (
          <View flexGrow={1} flexShrink={1}>
            <LineRenderer
              inlines={shortened ? shortenedInlines : inlines}
              isNotice={isNotice}
              onPressImage={onPressImage}
              onLongPress={onLongPress}
              viewMode={viewMode}
            />
          </View>
        ) : null}
        {isEdited ? (
          <Text color="$tertiaryText" fontSize="$xs" flexWrap="nowrap">
            Edited
          </Text>
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
