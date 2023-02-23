import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import React, { ChangeEvent } from 'react';
import useChannelSearch from './useChannelSearch';

export default function ChannelsListSearch() {
  const { searchInput, setSearchInput } = useChannelSearch();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const { value } = input;

    setSearchInput(value.trimStart());
  };

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Search Prefences</span>
      <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
        <MagnifyingGlass16Icon className="h-4 w-4" />
      </span>
      <input
        className="input h-10 w-[260px] bg-gray-50 pl-7 text-sm mix-blend-multiply placeholder:font-normal md:text-base"
        placeholder="Filter Channel Titles and Sections"
        value={searchInput}
        onChange={handleChange}
      />
    </label>
  );
}
