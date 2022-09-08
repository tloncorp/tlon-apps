import React from 'react';
import GroupAvatar from './GroupAvatar';

export default function GroupJoinListPlaceholder() {
  return (
    <ul className="animate-pulse">
      <li className="relative flex items-center">
        <div className="flex w-full items-center justify-start rounded-xl p-2 text-left">
          <div className="flex items-center space-x-3 font-semibold">
            <GroupAvatar image={'#f5f5f5'} size={'h-12 w-12'} />
            <div className="space-y-2">
              <div className="h-5 w-[68px] rounded bg-gray-100" />
              <div className="h-5 w-[123px] rounded bg-gray-200" />
            </div>
          </div>
        </div>
        <div className="absolute right-2 flex flex-row">
          <button disabled className="button ml-2 bg-gray-200 text-gray-400">
            Join
          </button>
        </div>
      </li>
    </ul>
  );
}
