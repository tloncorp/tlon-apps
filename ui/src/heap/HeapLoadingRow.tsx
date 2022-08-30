import React from 'react';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function HeapLoadingRow() {
  return (
    <div className="heap-row items-center justify-center bg-gray-100 p-2">
      <LoadingSpinner />
    </div>
  );
}
