import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { Link } from 'react-router-dom';
import { useCopyToClipboard } from 'usehooks-ts';
import { useGroupFlag } from '@/state/groups';
import DiaryNoteOptionsDropdown from './DiaryNoteOptionsDropdown';

export interface DiaryNoteHeaderProps {
  title: string;
  flag: string;
  time: string;
}

export default function DiaryNoteHeader({
  title,
  flag,
  time,
}: DiaryNoteHeaderProps) {
  const groupFlag = useGroupFlag();
  const [isOpen, setIsOpen] = useState(false);
  const [_copied, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);

  const onCopy = useCallback(() => {
    doCopy(`${groupFlag}/channels/diary/${flag}/note/${time}`);
    setJustCopied(true);
    setTimeout(() => {
      setIsOpen(false);
      setJustCopied(false);
    }, 1000);
  }, [doCopy, time, groupFlag, flag]);

  const onCopySelect = useCallback(
    (event: Event) => {
      event.preventDefault();
      onCopy();
    },
    [onCopy]
  );

  return (
    <div
      className={cn(
        'flex h-full items-center border-b-2 border-gray-50 bg-white p-4'
      )}
    >
      <Link
        to=".."
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-50"
        aria-label="Back to notebook"
      >
        <CaretLeftIcon className="h-6 w-6 text-gray-600" />
      </Link>
      <h1 className="mx-2 ml-3 grow-0 truncate font-semibold">{title}</h1>

      <div className="ml-auto flex min-w-fit items-center space-x-3">
        <Link to={`../edit/${time}`} className="secondary-button">
          Edit Post
        </Link>
        <button className="secondary-button" disabled>
          Share
        </button>
        <DiaryNoteOptionsDropdown
          time={time}
          flag={flag}
          triggerClassName={'secondary-button'}
        >
          <EllipsisIcon className="h-6 w-6" />
        </DiaryNoteOptionsDropdown>
      </div>
    </div>
  );
}
