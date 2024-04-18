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
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { Image, SizableText, Text, View, YStack } from '../../core';
import { Button } from '../Button';
import ContactName from '../ContactName';
import { PreviewableImage } from '../PreviewableImage';

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
            {s}
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
            {s}
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
            {s}
          </Text>
        ))}
      </>
    );
  }

  if (isInlineCode(story)) {
    return (
      <SizableText
        fontFamily="$mono"
        backgroundColor="$gray100"
        padding="$xs"
        borderRadius="$xl"
      >
        <InlineContent story={story['inline-code']} />
      </SizableText>
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
        <SizableText
          fontFamily="$mono"
          padding="$m"
          borderRadius="$xl"
          backgroundColor="$gray100"
        >
          {story.code}
        </SizableText>
      </View>
    );
  }

  if (isLink(story)) {
    return (
      <SizableText
        color="$blue"
        onPress={() => window.open(story.link.href, '_blank')}
      >
        {story.link.content}
      </SizableText>
    );
  }

  if (isBreak(story)) {
    return <InlineContent story={null} />;
  }
  if (isShip(story)) {
    return <ShipMention ship={story.ship} />;
  }
  if (isBlockquote(story)) {
    return (
      <SizableText
        backgroundColor="$gray100"
        padding="$m"
        borderRadius="$xl"
        fontStyle="italic"
      >
        {Array.isArray(story.blockquote)
          ? story.blockquote.map((item, index) => (
              <InlineContent key={item.toString() + index} story={item} />
            ))
          : story.blockquote}
      </SizableText>
    );
  }
  console.error(`Unhandled message type: ${JSON.stringify(story)}`);
  return (
    <SizableText color="$primaryText" fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </SizableText>
  );
}

export function BlockContent({
  story,
  onPressImage,
}: {
  story: Block;
  onPressImage?: (source: { uri: string }) => void;
}) {
  // TODO add support for videos and other embeds
  if (isImage(story)) {
    return (
      <Pressable
        onPress={() =>
          onPressImage &&
          onPressImage({
            uri: story.image.src,
          })
        }
      >
        <Animated.Image
          sharedTransitionTag={story.image.src}
          source={{ uri: story.image.src, height: 200, width: 200 }}
          style={{ resizeMode: 'contain' }}
          alt={story.image.alt}
        />
        {/* <Animated.View sharedTransitionTag="blub">
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
        </Animated.View> */}
      </Pressable>
    );
  }
  console.error(`Unhandled message type: ${JSON.stringify(story)}`);
  return (
    <SizableText fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </SizableText>
  );
}

export default function ChatContent({
  story,
  onPressImage,
}: {
  story: Story;
  onPressImage?: (source: { uri: string }) => void;
}) {
  const storyInlines = (
    story.filter((s) => 'inline' in s) as VerseInline[]
  ).flatMap((i) => i.inline);
  const storyBlocks = story.filter((s) => 'block' in s) as VerseBlock[];
  const inlineLength = storyInlines.length;
  const blockLength = storyBlocks.length;
  // const firstBlockCode = storyInlines.findIndex(isBlockCode);
  // const lastBlockCode = findLastIndex(storyInlines, isBlockCode);
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
      {inlineLength > 0 ? (
        <>
          {storyInlines.map((storyItem, index) => {
            // TODO: figure out if this was necessary
            // if (firstBlockCode === 0 && firstBlockCode === lastBlockCode) {
            // return (
            // <YStack
            // key={`${storyItem.toString()}-${index}`}
            // className="rounded bg-gray-100 py-2"
            // borderRadius="$m"
            // >
            // <InlineContent story={storyItem} />
            // </YStack>
            // );
            // }

            // if (index === firstBlockCode) {
            // return (
            // <YStack
            // key={`${storyItem.toString()}-${index}`}
            // className="rounded bg-gray-100 py-2"
            // borderRadius="$m"
            // >
            // <InlineContent
            // key={`${storyItem.toString()}-${index}`}
            // story={storyItem}
            // />
            // </YStack>
            // );
            // }
            // if (index === lastBlockCode) {
            // return (
            // <YStack
            // key={`${storyItem.toString()}-${index}`}
            // className="rounded bg-gray-100 py-2"
            // borderRadius="$m"
            // >
            // <InlineContent
            // key={`${storyItem.toString()}-${index}`}
            // story={storyItem}
            // />
            // </YStack>
            // );
            // }
            return (
              <InlineContent
                key={`${storyItem.toString()}-${index}`}
                story={storyItem}
              />
            );
          })}
        </>
      ) : null}
    </YStack>
  );
}
