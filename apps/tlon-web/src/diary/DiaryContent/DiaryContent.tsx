import {
  Block,
  Cite,
  Listing,
  Story,
  isCite,
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
  isStrikethrough,
} from '@tloncorp/shared/dist/urbit/content';
import cn from 'classnames';
import { toH } from 'hast-to-hyperscript';
import _ from 'lodash';
import React from 'react';
import hoon from 'refractor/lang/hoon.js';
import { refractor } from 'refractor/lib/common.js';

import ContentReference from '@/components/References/ContentReference';
import { useIsDark } from '@/logic/useMedia';

import DiaryContentImage from './DiaryContentImage';

refractor.register(hoon);

interface DiaryContentProps {
  content: Story;
  isPreview?: boolean;
}

interface InlineContentProps {
  story: Inline;
}

interface BlockContentProps {
  story: Block;
}

export function groupByParagraph(inlines: Inline[]): Inline[][] {
  let index = 0;
  const final = [];

  while (index < inlines.length) {
    const remaining = _.slice(inlines, index);
    const nextParagraph = _.takeWhile(remaining, (i) => !isBreak(i));
    const head = _.head(remaining);
    if (nextParagraph.length === 0 && head) {
      final.push([head]);
      index += 1;
    } else {
      final.push(nextParagraph);
      index += nextParagraph.length + 1;
    }
  }

  return final;
}

export function InlineContent({ story }: InlineContentProps) {
  if (_.isArray(story)) {
    return (
      <>
        {story.map((s, k) => (
          <InlineContent story={s} key={k} />
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
        className="break-all"
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

  if ('task' in story) {
    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={story.task.checked}
          className="pointer-events-none mr-2"
          aria-checked={story.task.checked}
          aria-disabled
        />
        {story.task.content.map((con, i) => (
          <InlineContent key={`${con}-${i}`} story={con} />
        ))}
      </div>
    );
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
}

export function ListingContent({ content }: { content: Listing }) {
  if ('item' in content) {
    return (
      <>
        {content.item.map((con, i) => (
          <InlineContent key={`${i}-${con}`} story={con} />
        ))}
      </>
    );
  }

  if (content.list.type === 'tasklist') {
    return (
      <>
        {content.list.contents.map((con, i) => (
          <InlineContent key={i} story={con} />
        ))}
        <ul className="list-none">
          {content.list.items.map((con, i) => (
            <li key={i}>
              <ListingContent key={i} content={con} />
            </li>
          ))}
        </ul>
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
        {content.list.items.map((con, i) => (
          <li key={i}>
            <ListingContent key={i} content={con} />
          </li>
        ))}
      </List>
    </>
  );
}

export const BlockContent = React.memo(({ story }: BlockContentProps) => {
  const dark = useIsDark();

  if (isImage(story)) {
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
          <InlineContent key={`${con}-${i}`} story={con} />
        ))}
      </Tag>
    );
  }

  if ('rule' in story) {
    return <hr />;
  }

  if ('code' in story) {
    const tree = refractor.highlight(story.code.code, story.code.lang);
    const element = toH(React.createElement, tree);
    return (
      <pre
        className={cn('max-w-xs sm:max-w-md  lg:max-w-none xl:max-w-none', {
          invert: dark,
          'bg-white': dark,
        })}
      >
        <code className={`language-${story.code.lang}`}>{element}</code>
      </pre>
    );
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(story)}`);
});

export default function DiaryContent({
  content,
  isPreview,
}: DiaryContentProps) {
  return (
    <article
      className={cn('prose select-auto break-words dark:prose-invert', {
        'prose-sm': isPreview,
        'prose-lg': !isPreview,
      })}
    >
      {content.map((c, index) => {
        if ('block' in c) {
          return <BlockContent key={index} story={c.block} />;
        }

        return (
          <React.Fragment key={index}>
            {groupByParagraph(c.inline).map((con, i) => {
              if (con.length === 1 && isBreak(con[0])) {
                return <br key={i} />;
              }

              return (
                <p key={i}>
                  {con.map((s, j) => (
                    <InlineContent key={j} story={s} />
                  ))}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </article>
  );
}
