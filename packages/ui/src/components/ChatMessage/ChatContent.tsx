import { ClientTypes, utils } from '@tloncorp/shared';
import {
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
import { SizableText, YStack } from 'tamagui';

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
        <SizableText lineHeight={40} size="$xl">
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

export default function ChatContent({ story }: { story: Story }) {
  const storyInlines = (
    story.filter((s) => 'inline' in s) as VerseInline[]
  ).flatMap((i) => i.inline);
  const storyBlocks = story.filter((s) => 'block' in s) as VerseBlock[];
  const inlineLength = storyInlines.length;
  const blockLength = storyBlocks.length;
  const firstBlockCode = storyInlines.findIndex(isBlockCode);
  const lastBlockCode = findLastIndex(storyInlines, isBlockCode);
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
        <>
          {blockContent
            .filter((a) => !!a)
            .map((storyItem, index) => {
              /* TODO: implement images/embeds/refs
            (
              <div
                key={`${storyItem.toString()}-${index}`}
                className="flex flex-col"
              >
                <BlockContent
                  story={storyItem.block}
                  writId={writId}
                  blockIndex={index}
                />
              </div>
            )
          */
            })}
        </>
      ) : null}
      {inlineLength > 0 ? (
        <>
          {storyInlines.map((storyItem, index) => {
            // TODO: figure out if this was necessary
            // if (firstBlockCode === 0 && firstBlockCode === lastBlockCode) {
            // return (
            // <div
            // key={`${storyItem.toString()}-${index}`}
            // className="rounded bg-gray-100 py-2"
            // style={{ maxWidth: 'calc(100% - 2rem)' }}
            // >
            // <InlineContent story={storyItem} />
            // </div>
            // );
            // }

            // if (index === firstBlockCode) {
            // return (
            // <div
            // className="rounded bg-gray-100 pt-2"
            // style={{ maxWidth: 'calc(100% - 2rem)' }}
            // >
            // <InlineContent
            // key={`${storyItem.toString()}-${index}`}
            // story={storyItem}
            // />
            // </div>
            // );
            // }
            // if (index === lastBlockCode) {
            // return (
            // <div
            // className="rounded bg-gray-100 pb-2"
            // style={{ maxWidth: 'calc(100% - 2rem)' }}
            // >
            // <InlineContent
            // key={`${storyItem.toString()}-${index}`}
            // story={storyItem}
            // />
            // </div>
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
