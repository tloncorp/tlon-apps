import React from 'react';
import CopyIcon from '@/components/icons/CopyIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import { HeapCurio } from '@/types/heap';

export default function HeapRow({ curio }: { curio: HeapCurio }) {
  return (
    <div className="flex h-14 w-full items-center justify-between space-x-2 rounded-lg bg-white">
      <div className="flex space-x-2">
        <div className="h-14 w-14 rounded-l-lg bg-gray-200" />
        <div className="flex flex-col justify-end p-2">
          <div className="font-semibold text-gray-800">
            {curio.heart.content[0]}
          </div>
          <div className="text-sm font-semibold text-gray-600">
            Soundcloud • 10m ago • 32 Comments
          </div>
        </div>
      </div>
      <div className="flex space-x-1 text-gray-400">
        <button className="icon-button bg-transparent">
          <CopyIcon className="h-6 w-6" />
        </button>
        <button className="icon-button bg-transparent">
          <ElipsisIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
