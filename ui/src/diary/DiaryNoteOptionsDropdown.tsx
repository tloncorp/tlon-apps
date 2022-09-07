import React, { PropsWithChildren, useCallback, useState } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import { useGroupFlag } from '@/state/groups';
import { useDiaryState } from '@/state/diary';
import { useCopyToClipboard } from 'usehooks-ts';

type DiaryNoteOptionsDropdownProps = PropsWithChildren<{
  time: string;
  flag: string;
  triggerClassName?: string;
}>;

export default function DiaryNoteOptionsDropdown({
  children,
  flag,
  time,
  triggerClassName,
}: DiaryNoteOptionsDropdownProps) {
  const groupFlag = useGroupFlag();
  const [isOpen, setIsOpen] = useState(false);
  const [_copied, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);
  const delNote = useCallback(() => {
    useDiaryState.getState().delNote(flag, time);
  }, [flag, time]);

  const onCopy = useCallback(
    (e) => {
      e.preventDefault();
      doCopy(`${groupFlag}/channels/diary/${flag}/note/${time}`);
      setJustCopied(true);
      setTimeout(() => {
        setJustCopied(false);
        setIsOpen(false);
      }, 1000);
    },
    [doCopy, time, groupFlag, flag]
  );

  return (
    <Dropdown.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dropdown.Trigger
        className={`h-8 w-8 p-0 ${triggerClassName}`}
        aria-label="Note menu"
      >
        {children}
      </Dropdown.Trigger>
      <Dropdown.Content
        sideOffset={8}
        className="dropdown min-w-[208px] drop-shadow-lg"
      >
        <Dropdown.Item className="dropdown-item" onSelect={onCopy}>
          {justCopied ? 'Link Copied!' : 'Copy Note Link'}
        </Dropdown.Item>
        <Dropdown.Item className="dropdown-item" asChild>
          <Link to={`../edit/${time}`}>Edit Note</Link>
        </Dropdown.Item>
        <Dropdown.Item className="dropdown-item text-red" onSelect={delNote}>
          Delete Note
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
