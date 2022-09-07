import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { Link } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useDiaryState } from '@/state/diary';
import { useCopyToClipboard } from 'usehooks-ts';
import { useGroupFlag } from '@/state/groups';

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
  const [_copied, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);
  const delNote = useCallback(() => {
    useDiaryState.getState().delNote(flag, time);
  }, [flag, time]);

  const onCopy = useCallback(() => {
    doCopy(`${groupFlag}/channels/diary/${flag}/note/${time}`);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1000);
  }, [doCopy, time, groupFlag, flag]);

  return (
    <div
      className={cn(
        'flex h-full items-center border-b-2 border-gray-50 bg-white p-4'
      )}
    >
      <Link
        to=".."
        className="flex h-8 w-8 items-center justify-center rounded bg-gray-50"
        aria-label="Back to notebook"
      >
        <CaretLeftIcon className="h-6 w-6 text-gray-600" />
      </Link>
      <h1 className="ml-3 font-semibold">{title}</h1>

      <div className="ml-auto flex items-center space-x-3">
        <Link to={`../edit/${time}`} className="secondary-button">
          Edit Note
        </Link>
        <button className="secondary-button" onClick={onCopy}>
          <span className="font-semibold">
            {justCopied ? 'copied!' : 'Share'}
          </span>
        </button>
        <Dropdown.Root>
          <Dropdown.Trigger
            className="secondary-button h-8 w-8 p-0"
            aria-label="Note menu"
          >
            <EllipsisIcon className="h-6 w-6" />
          </Dropdown.Trigger>
          <Dropdown.Content
            sideOffset={8}
            className="dropdown min-w-[208px] drop-shadow-lg"
          >
            <Dropdown.Item className="dropdown-item" onSelect={onCopy}>
              Copy Note Link
            </Dropdown.Item>
            <Dropdown.Item className="dropdown-item" asChild>
              <Link to={`../edit/${time}`}>Edit Note</Link>
            </Dropdown.Item>
            <Dropdown.Item
              className="dropdown-item text-red"
              onSelect={delNote}
            >
              Delete Note
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      </div>
    </div>
  );
}
