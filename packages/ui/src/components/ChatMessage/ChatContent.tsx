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
import { findLastIndex } from 'lodash';
import { Image, SizableText, View, YStack } from 'tamagui';

import { Button } from '../Button';
import ShipName from '../ShipName';

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
      <ShipName name={ship} showAlias />
    </Button>
  );
}

export function InlineContent({ story }: { story: Inline }) {
  if (typeof story === 'string') {
    if (utils.isSingleEmoji(story)) {
      return (
        <SizableText paddingTop="$xl" size="$xl">
          {story}
        </SizableText>
      );
    }
    return (
      <SizableText color="$primaryText" size="$m">
        {story}
      </SizableText>
    );
  }

  if (isBold(story)) {
    return (
      <SizableText fontWeight="$l">
        {story.bold.map((s, k) => (
          <InlineContent key={k} story={s} />
        ))}
      </SizableText>
    );
  }

  if (isItalics(story)) {
    return (
      <SizableText fontStyle="italic">
        {story.italics.map((s, k) => (
          <InlineContent key={k} story={s} />
        ))}
      </SizableText>
    );
  }

  if (isStrikethrough(story)) {
    return (
      <SizableText textDecorationLine="line-through">
        {story.strike.map((s, k) => (
          <InlineContent key={k} story={s} />
        ))}
      </SizableText>
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
    return <br />;
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

export function BlockContent({ story }: { story: Block }) {
  // TODO add support for videos and other embeds
  if (isImage(story)) {
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
    <SizableText fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </SizableText>
  );
}

export default function ChatContent({ story }: { story: Story }) {
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
            .map((storyItem) => {
              return <BlockContent story={storyItem.block} />;
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
