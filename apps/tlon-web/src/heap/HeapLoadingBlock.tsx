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
          ? 'heap-inline-block h-[72px] w-[72px] items-center justify-center border-0 bg-gray-100'
          : 'heap-block items-center justify-center bg-gray-100'
      }
    >
      <LoadingSpinner />
    </div>
  );
}
