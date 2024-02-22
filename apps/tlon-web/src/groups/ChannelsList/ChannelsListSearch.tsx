import cn from 'classnames';
import React, { ChangeEvent } from 'react';

import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';

import useChannelListSearch from './useChannelListSearch';

export default function ChannelsListSearch({
  className,
}: {
  className?: string;
}) {
  const { searchInput, setSearchInput } = useChannelListSearch();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const { value } = input;

    setSearchInput(value.trimStart());
  };

  return (
    <label className={cn('relative flex w-full items-center', className)}>
      <span className="sr-only">Search Prefences</span>
      <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
        <MagnifyingGlass16Icon className="h-4 w-4" />
      </span>
      <input
        className="input h-10 w-full bg-gray-50 pl-7 mix-blend-multiply placeholder:font-normal focus-within:mix-blend-normal dark:bg-white dark:mix-blend-normal md:text-base"
        placeholder="Filter Channel Titles and Sections"
        value={searchInput}
        onChange={handleChange}
      />
    </label>
  );
}
