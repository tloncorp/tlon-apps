import React from 'react';
import useHeapContentType from '@/logic/useHeapContentType';

interface HeapDetailHeaderDescriptionProps {
  url: string;
}

export default function HeapDetailHeaderDescription({
  url,
}: HeapDetailHeaderDescriptionProps) {
  const { description } = useHeapContentType(url);

  return (
    <div className="text-md font-semibold text-gray-600">{description()}</div>
  );
}
