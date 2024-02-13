import ChatContentImage from '@/chat/ChatContent/ChatContentImage';
import ChatEmbedContent from '@/chat/ChatEmbedContent/ChatEmbedContent';
// eslint-disable-next-line import/no-cycle
import ContentReference from '@/components/References/ContentReference';
import ShipName from '@/components/ShipName';
import { isSingleEmoji } from '@/logic/utils';
import {
  Block,
  Story,
  VerseBlock,
  VerseInline,
  isImage,
} from '@/types/channel';
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
} from '@/types/content';
import cn from 'classnames';
import { findLastIndex } from 'lodash';
import React from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';

interface ChatContentProps {
  story: Story;
  isScrolling?: boolean;
  className?: string;
  writId?: string;
}

interface InlineContentProps {
  story: Inline;
  writId?: string;
}

interface BlockContentProps {
  story: Block;
  isScrolling: boolean;
  writId: string;
  blockIndex: number;
}

interface ShipMentionProps {
  ship: string;
}

function ShipMention({ ship }: ShipMentionProps) {
  const location = useLocation();

  return (
    <Link
      to={`/profile/${ship}`}
      className="default-focus inline-block rounded bg-blue-soft px-1.5 py-0 text-blue"
      state={{ backgroundLocation: location }}
    >
      <ShipName name={ship} showAlias />
    </Link>
  );
}

export function InlineContent({
  story,
  writId = 'not-writ',
}: InlineContentProps) {
  if (typeof story === 'string') {
    if (isSingleEmoji(story)) {
      return <span className="text-[32px]">{story}</span>;
    }
    return <span>{story}</span>;
  }

  if (isBold(story)) {
    return (
      <strong>
        {story.bold.map((s, k) => (
          <InlineContent key={k} story={s} />
        ))}
      </strong>
    );
  }

  if (isItalics(story)) {
    return (
      <em>
        {story.italics.map((s, k) => (
          <InlineContent key={k} story={s} />
        ))}
      </em>
    );
  }

  if (isStrikethrough(story)) {
    return (
      <span className="line-through">
        {story.strike.map((s, k) => (
          <InlineContent key={k} story={s} />
        ))}
      </span>
    );
  }

  if (isLink(story)) {
    return (
      <ChatEmbedContent
        writId={writId}
        url={story.link.href}
        content={story.link.content}
      />
    );
  }

  if (isBlockquote(story)) {
    return (
      <blockquote className="leading-6">
        {Array.isArray(story.blockquote)
          ? story.blockquote.map((item, index) => (
              <InlineContent key={item.toString() + index} story={item} />
            ))
          : story.blockquote}
      </blockquote>
    );
  }

  if (isInlineCode(story)) {
    return (
      <code className="inline-block rounded bg-gray-100 px-1.5">
        {typeof story['inline-code'] === 'object' ? (
          <InlineContent story={story['inline-code']} />
        ) : (
          story['inline-code']
        )}
      </code>
    );
  }

  if (isBlockCode(story)) {
    return (
      <pre className="overflow-x-auto bg-gray-100 px-4">
        <code>{story.code}</code>
      </pre>
    );
  }

  if (isShip(story)) {
    return <ShipMention ship={story.ship} />;
  }

  if (isBreak(story)) {
    return <br />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

export function BlockContent({
  story,
  isScrolling,
  writId,
  blockIndex,
}: BlockContentProps) {
  if (isImage(story)) {
    return (
      <ChatContentImage
        src={story.image.src}
        height={story.image.height}
        width={story.image.width}
        altText={story.image.alt}
        writId={writId}
        blockIndex={blockIndex}
      />
    );
  }
  if ('cite' in story) {
    return <ContentReference cite={story.cite} isScrolling={isScrolling} />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

function ChatContent({
  story,
  isScrolling = false,
  className = '',
  writId = 'not-writ',
}: ChatContentProps) {
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

  return (
    <div className={cn('leading-6', className)}>
      {blockLength > 0 ? (
        <>
          {blockContent
            .filter((a) => !!a)
            .map((storyItem, index) => (
              <div
                key={`${storyItem.toString()}-${index}`}
                className="flex flex-col"
              >
                <BlockContent
                  story={storyItem.block}
                  isScrolling={isScrolling}
                  writId={writId}
                  blockIndex={index}
                />
              </div>
            ))}
        </>
      ) : null}
      {inlineLength > 0 ? (
        <>
          {storyInlines.map((storyItem, index) => {
            // we need to add top and bottom padding to first/last lines of code blocks.

            if (firstBlockCode === 0 && firstBlockCode === lastBlockCode) {
              return (
                <div
                  key={`${storyItem.toString()}-${index}`}
                  className="rounded bg-gray-100 py-2"
                  style={{ maxWidth: 'calc(100% - 2rem)' }}
                >
                  <InlineContent story={storyItem} />
                </div>
              );
            }

            if (index === firstBlockCode) {
              return (
                <div
                  className="rounded bg-gray-100 pt-2"
                  style={{ maxWidth: 'calc(100% - 2rem)' }}
                >
                  <InlineContent
                    key={`${storyItem.toString()}-${index}`}
                    story={storyItem}
                  />
                </div>
              );
            }
            if (index === lastBlockCode) {
              return (
                <div
                  className="rounded bg-gray-100 pb-2"
                  style={{ maxWidth: 'calc(100% - 2rem)' }}
                >
                  <InlineContent
                    key={`${storyItem.toString()}-${index}`}
                    story={storyItem}
                  />
                </div>
              );
            }
            return (
              <InlineContent
                key={`${storyItem.toString()}-${index}`}
                story={storyItem}
                writId={writId}
              />
            );
          })}
        </>
      ) : null}
    </div>
  );
}

export default React.memo(ChatContent);
