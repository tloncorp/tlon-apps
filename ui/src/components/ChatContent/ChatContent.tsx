import classNames from 'classnames';
import React from 'react';
import { ChatMessage, isBold, isItalics, isLink } from '../../types/chat';

interface ChatContentProps {
  content: ChatMessage;
}

interface InlineContentProps extends ChatContentProps {
  inlineLength: number;
}

export function InlineContent({ content, inlineLength }: InlineContentProps) {
  return (
    <div>
      {content.inline.map((contentItem, index) => {
        const key = `${contentItem.toString}-${index}`;
        const space = inlineLength - 1 === index ? null : <span>&nbsp;</span>;

        if (typeof contentItem === 'string') {
          return (
            <span className={classNames({ '-ml-4': index === 0 })} key={key}>
              {contentItem} {space}
            </span>
          );
        }

        if (isBold(contentItem)) {
          return (
            <b className={classNames({ '-ml-4': index === 0 })} key={key}>
              {contentItem.bold} {space}
            </b>
          );
        }

        if (isItalics(contentItem)) {
          return (
            <i className={classNames({ '-ml-4': index === 0 })} key={key}>
              {contentItem.italics} {space}
            </i>
          );
        }

        if (isLink(contentItem)) {
          return (
            <a
              className={classNames({ '-ml-4': index === 0 })}
              target="_blank"
              rel="noreferrer"
              href={contentItem.href}
              key={key}
            >
              {contentItem.href} {space}
            </a>
          );
        }

        throw new Error(
          `Unhandled message type: ${JSON.stringify(contentItem)}`
        );
      })}
    </div>
  );
}

export function BlockContent({ content }: ChatContentProps) {
  return (
    <div>
      {content.block.map((contentItem, index) => (
        <div key={index} className={classNames({ '-ml-4': index === 0 })} />
      ))}
    </div>
  );
}

export default function ChatContent({ content }: ChatContentProps) {
  const inlineLength = content.inline.length;
  const blockLength = content.block.length;

  return (
    <div className="leading-6">
      {blockLength > 0 ? <BlockContent content={content} /> : null}
      {inlineLength > 0 ? (
        <InlineContent content={content} inlineLength={inlineLength} />
      ) : null}
    </div>
  );
}
