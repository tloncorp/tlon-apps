import _ from 'lodash';
import React from 'react';
import { URL_REGEX, makePrettyDay } from '@/logic/utils';
import { inlineToString } from '@/logic/tiptap';
import { HeapCurio } from '@/types/heap';
import Author from '@/chat/ChatMessage/Author';

interface HeapDetailSidebarProps {
  curio: HeapCurio;
}

export default function HeapDetailSidebarInfo({
  curio,
}: HeapDetailSidebarProps) {
  const { content, author, sent, title } = curio.heart;
  const unixDate = new Date(sent);
  const stringContent = (content.inline?.[0] || '').toString();
  const textPreview = content.inline
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();
  const isURL = URL_REGEX.test(stringContent);

  return (
    <div className="flex flex-col space-y-4 rounded-lg bg-gray-50 p-4">
      {title ||
        (!isURL && (
          <h2 className="break-all text-base font-semibold text-gray-800 line-clamp-1">
            {title && title}
            {!title && !isURL ? textPreview : null}
          </h2>
        ))}
      {isURL && (
        <a
          href={stringContent}
          target="_blank"
          rel="noreferrer"
          className="break-all text-base font-semibold text-gray-800 line-clamp-1"
        >
          {stringContent}
        </a>
      )}

      <time className="text-base font-semibold text-gray-400">
        {makePrettyDay(unixDate)}
      </time>

      <Author ship={author} />
    </div>
  );
}
