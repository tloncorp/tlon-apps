import React from 'react';
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
} from '@/types/content';
import ChatContentImage from '@/chat/ChatContent/ChatContentImage';
import { PATP_REGEX } from '@/logic/utils';
// eslint-disable-next-line import/no-cycle
import ChatContentReference from '@/chat/ChatContent/ChatContentReference/ChatContentReference';

interface ChatContentProps {
  story: ChatStory;
}

interface InlineContentProps {
  story: Inline;
}

interface BlockContentProps {
  story: ChatBlock;
}

export function InlineContent({ story }: InlineContentProps) {
  if (typeof story === 'string') {
    const containsPatp = PATP_REGEX.test(story);

    if (containsPatp) {
      return <ChatContentReference story={story} />;
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
      <code>
        {typeof story['inline-code'] === 'object' ? (
          <InlineContent story={story['inline-code']} />
        ) : (
          story['inline-code']
        )}
      </code>
    );
  }

  if (isBreak(story)) {
    return <br />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

export function BlockContent({ story }: BlockContentProps) {
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

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

export default function ChatContent({ story }: ChatContentProps) {
  const inlineLength = story.inline.length;
  const blockLength = story.block.length;

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
                <BlockContent story={storyItem} />
              </div>
            ))}
        </>
      ) : null}
      {inlineLength > 0 ? (
        <>
          {story.inline.map((storyItem, index) => (
            <InlineContent
              key={`${storyItem.toString()}-${index}`}
              story={storyItem}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
