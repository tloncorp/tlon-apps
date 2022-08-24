import React from 'react';

export default function HeapAudioPlayer({ source }: { source: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <audio src={source} controls />
    </div>
  );
}
