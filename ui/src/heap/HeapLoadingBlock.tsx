import React from 'react';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function HeapLoadingBlock() {
  return (
    <div className="heap-block items-center justify-center bg-gray-100 p-2">
      <LoadingSpinner />
    </div>
  );
}
