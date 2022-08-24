import React from 'react';

export default function HeapAudioPlayer({ source }: { source: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <audio src={source} controls className="m-6 w-full max-w-2xl" />
    </div>
  );
}
