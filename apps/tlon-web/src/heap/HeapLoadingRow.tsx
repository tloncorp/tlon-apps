import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import React from 'react';

export default function HeapLoadingRow() {
  return (
    <div className="heap-row items-center justify-center bg-gray-100 p-2">
      <LoadingSpinner />
    </div>
  );
}
