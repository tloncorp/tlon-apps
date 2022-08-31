import cn from 'classnames';
import React from 'react';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { Link } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';

export interface DiaryNoteHeaderProps {
  title: string;
}

export default function DiaryNoteHeader({ title }: DiaryNoteHeaderProps) {
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
        <button
          className="secondary-button"
          onClick={() => console.log('share')}
        >
          <span className="font-semibold">Edit Note</span>
        </button>
        <button
          className="secondary-button"
          onClick={() => console.log('share')}
        >
          <span className="font-semibold">Share</span>
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
            <Dropdown.Item className="dropdown-item">
              Copy Note Link
            </Dropdown.Item>
            <Dropdown.Item className="dropdown-item">Edit Note</Dropdown.Item>
            <Dropdown.Item className="dropdown-item">Delete Note</Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      </div>
    </div>
  );
}
