import React from 'react';
import { ChannelPreview } from '@/types/groups';
import bigInt from 'big-integer';
import ExclamationPoint from '../icons/ExclamationPoint';
import ReferenceBar from './ReferenceBar';

interface UnavailableReferenceProps {
  nest: string;
  time: bigInt.BigInteger;
  preview: ChannelPreview | null;
}

export default function UnavailableReference({
  nest,
  time,
  preview,
}: UnavailableReferenceProps) {
  return (
    <div className="heap-inline-block group">
      <div className="h-full w-full p-2">
        <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-gray-50 font-semibold text-gray-600">
          <ExclamationPoint className="mb-3 h-12 w-12" />
          This content is unavailable to you.
        </div>
      </div>
      <ReferenceBar
        nest={nest}
        time={time}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
