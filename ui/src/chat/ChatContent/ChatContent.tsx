import React from 'react';
import { findLastIndex } from 'lodash';
import { ChatBlock, isChatImage, ChatStory } from '@/types/chat';
import {
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isStrikethrough,
  Inline,
  isShip,
  isBlockCode,
} from '@/types/content';
import ChatContentImage from '@/chat/ChatContent/ChatContentImage';
// eslint-disable-next-line import/no-cycle
import ContentReference from '@/components/References/ContentReference';
import { useLocation } from 'react-router';
import ShipName from '@/components/ShipName';
import { Link } from 'react-router-dom';

interface ChatContentProps {
  story: ChatStory;
  isScrolling?: boolean;
}

interface InlineContentProps {
  story: Inline;
}

interface BlockContentProps {
  story: ChatBlock;
  isScrolling: boolean;
}

interface ShipMentionProps {
  ship: string;
}

function ShipMention({ ship }: ShipMentionProps) {
  const location = useLocation();

  return (
    <Link
      to={`/profile/${ship}`}
      className="inline-block rounded bg-blue-soft px-1.5 py-0 text-blue"
      state={{ backgroundLocation: location }}
    >
      <ShipName name={ship} showAlias />
    </Link>
  );
}

export function InlineContent({ story }: InlineContentProps) {
  if (typeof story === 'string') {
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
    const containsProtocol = story.link.href.match(/https?:\/\//);
    return (
      <a
        target="_blank"
        rel="noreferrer"
        href={containsProtocol ? story.link.href : `//${story.link.href}`}
      >
        {story.link.content || story.link.href}
      </a>
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
      <code className="inline-block rounded bg-gray-50 px-1.5 dark:bg-gray-100">
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
      <pre className="overflow-x-auto bg-gray-50 px-4 dark:bg-gray-100">
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

export function BlockContent({ story, isScrolling }: BlockContentProps) {
  if (isChatImage(story)) {
    return (
      <ChatContentImage
        src={story.image.src}
        height={story.image.height}
        width={story.image.width}
        altText={story.image.alt}
      />
    );
  }
  if ('cite' in story) {
    return <ContentReference cite={story.cite} isScrolling={isScrolling} />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

export default function ChatContent({
  story,
  isScrolling = false,
}: ChatContentProps) {
  const inlineLength = story.inline.length;
  const blockLength = story.block.length;
  const firstBlockCode = story.inline.findIndex(isBlockCode);
  const lastBlockCode = findLastIndex(story.inline, isBlockCode);

  return (
    <div className="leading-6">
      {blockLength > 0 ? (
        <>
          {story.block
            .filter((a) => !!a)
            .map((storyItem, index) => (
              <div
                key={`${storyItem.toString()}-${index}`}
                className="flex flex-col"
              >
                <BlockContent story={storyItem} isScrolling={isScrolling} />
              </div>
            ))}
        </>
      ) : null}
      {inlineLength > 0 ? (
        <>
          {story.inline.map((storyItem, index) => {
            // we need to add top and bottom padding to first/last lines of code blocks.

            if (firstBlockCode === 0 && firstBlockCode === lastBlockCode) {
              return (
                <div
                  className="rounded bg-gray-50 py-2 dark:bg-gray-100"
                  style={{ maxWidth: 'calc(100% - 2rem)' }}
                >
                  <InlineContent
                    key={`${storyItem.toString()}-${index}`}
                    story={storyItem}
                  />
                </div>
              );
            }

            if (index === firstBlockCode) {
              return (
                <div
                  className="rounded bg-gray-50 pt-2 dark:bg-gray-100"
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
                  className="rounded bg-gray-50 pb-2 dark:bg-gray-100"
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
              />
            );
          })}
        </>
      ) : null}
    </div>
  );
}
