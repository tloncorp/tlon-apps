import React from 'react';
import cn from 'classnames';
import { URL_REGEX, nestToFlag } from '@/logic/utils';
import { HeapCurio } from '@/types/heap';
import { BigInteger } from 'big-integer';
import { useHeapState } from '@/state/heap/heap';
import Author from '@/chat/ChatMessage/Author';
import ElipsisSmallIcon from '@/components/icons/EllipsisSmallIcon';
import IconButton from '@/components/IconButton';
import useNest from '@/logic/useNest';
import { InlineContent } from '@/heap/HeapContent';

interface HeapDetailSidebarProps {
  curio: HeapCurio;
  time: BigInteger;
}

export default function HeapDetailSidebarInfo({
  curio,
  time,
}: HeapDetailSidebarProps) {
  const nest = useNest();
  const { content, author, sent, title } = curio.heart;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [, chFlag] = nestToFlag(nest);
  const unixDate = new Date(sent);
  const stringContent = content[0].toString();
  const textPreview = content.toString().split(' ').slice(0, 3).join(' ');

  const onDelete = () => {
    setMenuOpen(false);
    // FIXME: this state update is not working.
    useHeapState.getState().delCurio(chFlag, time.toString());
  };

  const isURL = URL_REGEX.test(stringContent);

  return (
    <div className="w-full break-words border-b-2 border-gray-50 p-2">
      <div className="relative mb-6">
        <div className="absolute right-2 w-fit">
          <IconButton
            icon={<ElipsisSmallIcon className="h-4 w-4" />}
            label="options"
            className="rounded"
            action={() => setMenuOpen(!menuOpen)}
          />
          <div
            className={cn(
              'absolute right-0 flex w-[101px] flex-col items-start rounded bg-white text-sm font-semibold text-gray-800 shadow',
              { hidden: !menuOpen }
            )}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              // FIXME: add edit functionality
              className="small-menu-button"
            >
              Edit
            </button>
            <button className="small-menu-button" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
      <h2 className="mb-2 whitespace-normal text-lg font-semibold line-clamp-2">
        {title && title}
        {!title && !isURL ? textPreview : null}
      </h2>
      {isURL && (
        <a
          href={stringContent}
          target="_blank"
          rel="noreferrer"
          className="mb-2 text-ellipsis font-semibold text-gray-800 underline line-clamp-1"
        >
          {stringContent}
        </a>
      )}
      <Author ship={author} date={unixDate} timeOnly />
    </div>
  );
}
