import React, { PropsWithChildren } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import Divider from '@/components/Divider';
import useDiaryActions from './useDiaryActions';

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
  const { isOpen, justCopied, onCopy, delNote, setIsOpen } = useDiaryActions({
    flag,
    time,
  });

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
        <Dropdown.Item
          disabled
          className="dropdown-item text-gray-400"
          onSelect={onCopy}
        >
          Share Note
        </Dropdown.Item>
        <Dropdown.Item className="dropdown-item" onSelect={onCopy}>
          {justCopied ? 'Link Copied!' : 'Copy Note Link'}
        </Dropdown.Item>
        <Divider />
        <Dropdown.Item
          disabled
          className="dropdown-item text-gray-400"
          onSelect={onCopy}
        >
          Mark Read
        </Dropdown.Item>
        <Dropdown.Item
          className="dropdown-item text-gray-400"
          onSelect={onCopy}
        >
          Mute
        </Dropdown.Item>
        <Divider />
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
