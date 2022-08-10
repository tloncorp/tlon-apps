import React from 'react';
import { useGroup } from '@/state/groups';
import X16Icon from '@/components/icons/X16Icon';

interface ProfileGroupProps {
  groupFlag: string;
  onRemoveGroupClick: (groupFlag: string) => void;
}

export default function ProfileGroup({
  groupFlag,
  onRemoveGroupClick,
}: ProfileGroupProps) {
  const group = useGroup(groupFlag);

  return (
    <div className="my-2 flex h-6 items-center rounded bg-gray-100">
      <span className="p-1 font-semibold">
        {group ? group.meta.title : groupFlag}
      </span>
      <button
        className="flex h-full cursor-pointer items-center rounded bg-gray-100 pr-1"
        aria-label="Remove"
        onClick={() => onRemoveGroupClick(groupFlag)}
      >
        <X16Icon className="h-4 text-gray-300" />
      </button>
    </div>
  );
}
