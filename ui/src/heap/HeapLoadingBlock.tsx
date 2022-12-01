import React from 'react';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function HeapLoadingBlock({
  reference = false,
}: {
  reference?: boolean;
}) {
  return (
    <div
      className={
        reference
          ? 'heap-inline-block h-[126px] items-center justify-center bg-gray-100'
          : 'heap-block items-center justify-center bg-gray-100'
      }
    >
      <LoadingSpinner />
    </div>
  );
}
