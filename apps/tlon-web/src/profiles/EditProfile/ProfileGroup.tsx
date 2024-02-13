import X16Icon from '@/components/icons/X16Icon';
import { useGroup } from '@/state/groups';
import React from 'react';

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
    <div className="mb-2 mr-2 inline-flex items-center space-x-2 rounded-md bg-gray-50 px-4 py-2">
      <span className="font-semibold">
        {group ? group.meta.title : groupFlag}
      </span>
      <button
        className="flex h-full cursor-pointer items-center rounded pr-0"
        aria-label="Remove"
        onClick={() => onRemoveGroupClick(groupFlag)}
      >
        <X16Icon className="h-4 w-4 text-gray-300" />
      </button>
    </div>
  );
}
