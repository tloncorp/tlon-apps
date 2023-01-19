import React from 'react';
import {
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isStrikethrough,
  Inline,
  isBlockCode,
} from '@/types/content';
// eslint-disable-next-line import/no-cycle
import ContentReference from '@/components/References/ContentReference';
import {
  DiaryBlock,
  DiaryListing,
  isDiaryImage,
  NoteContent,
} from '@/types/diary';
import _ from 'lodash';
import { refractor } from 'refractor';
import { toH } from 'hast-to-hyperscript';
import { useIsDark } from '@/logic/useMedia';
import cn from 'classnames';
import DiaryContentImage from './DiaryContentImage';

interface DiaryContentProps {
  content: NoteContent;
}

interface InlineContentProps {
  story: Inline;
}

interface BlockContentProps {
  story: DiaryBlock;
}

export function InlineContent({ story }: InlineContentProps) {
  if (_.isArray(story)) {
    return (
      <>
        {story.map((s) => (
          <InlineContent story={s} />
        ))}
      </>
    );
  }
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
      <code>
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
      <pre>
        <code>
          {typeof story.code === 'object' ? (
            <InlineContent story={story.code} />
          ) : (
            story.code
          )}
        </code>
      </pre>
    );
  }

  if (isBreak(story)) {
    return <br />;
  }

  if ('ship' in story) {
    return <span className="text-blue">{story.ship}</span>;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

export function ListingContent({ content }: { content: DiaryListing }) {
  if ('item' in content) {
    return (
      <>
        {content.item.map((con, i) => (
          <InlineContent key={i} story={con} />
        ))}
      </>
    );
  }

  const List = content.list.type === 'ordered' ? 'ol' : 'ul';

  return (
    <>
      {content.list.contents.map((con, i) => (
        <InlineContent key={i} story={con} />
      ))}
      <List>
        {content.list.items.map((i) => (
          <li>
            <ListingContent content={i} />
          </li>
        ))}
      </List>
    </>
  );
}

export const BlockContent = React.memo(({ story }: BlockContentProps) => {
  const dark = useIsDark();

  if (isDiaryImage(story)) {
    return (
      <DiaryContentImage
        src={story.image.src}
        height={story.image.height}
        width={story.image.width}
        altText={story.image.alt}
      />
    );
  }

  if ('cite' in story) {
    return (
      <div className="my-4 text-base">
        <ContentReference cite={story.cite} />
      </div>
    );
  }

  if ('listing' in story) {
    return <ListingContent content={story.listing} />;
  }

  if ('header' in story) {
    const Tag = story.header.tag;
    return (
      <Tag>
        {story.header.content.map((con, i) => (
          <InlineContent key={i} story={con} />
        ))}
      </Tag>
    );
  }

  if ('rule' in story) {
    return <hr />;
  }

  const tree = refractor.highlight(story.code.code, story.code.lang);
  const element = toH(React.createElement, tree);

  if ('code' in story) {
    return (
      <pre className={cn({ invert: dark, 'bg-white': dark })}>
        <code className={`language-${story.code.lang}`}>{element}</code>
      </pre>
    );
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
});

export default function DiaryContent({ content }: DiaryContentProps) {
  return (
    <article className="prose-lg prose dark:prose-invert">
      {content.map((c, index) => {
        if ('block' in c) {
          return <BlockContent key={index} story={c.block} />;
        }

        return (
          <p key={index}>
            {c.inline.map((con, i) => (
              <InlineContent key={i} story={con} />
            ))}
          </p>
        );
      })}
    </article>
  );
}
