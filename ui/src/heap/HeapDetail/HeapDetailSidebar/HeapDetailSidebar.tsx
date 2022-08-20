import React from 'react';
import { HeapCurio } from '@/types/heap';
import { BigInteger } from 'big-integer';
import HeapDetailSidebarInfo from './HeapDetailSidebarInfo';
import HeapDetailComments from './HeapDetailComments';

interface HeapDetailSidebarProps {
  curio: HeapCurio;
  time: BigInteger;
}

export default function HeapDetailSidebar({
  curio,
  time,
}: HeapDetailSidebarProps) {
  return (
    <div className="fixed inset-0 z-40 flex h-full w-full flex-col border-gray-50 bg-white sm:absolute lg:static lg:w-72 lg:border-l-2 xl:w-96">
      <HeapDetailSidebarInfo curio={curio} time={time} />
      <HeapDetailComments time={time} />
    </div>
  );
}
