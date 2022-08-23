import React, { Suspense } from 'react';
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
    <Suspense fallback={<div>Loading..</div>}>
      <div className="mt-5 flex h-full w-full flex-col border-gray-50 bg-white lg:mt-0 lg:w-72 lg:border-l-2 xl:w-96">
        <HeapDetailSidebarInfo curio={curio} time={time} />
        <HeapDetailComments time={time} />
      </div>
    </Suspense>
  );
}
