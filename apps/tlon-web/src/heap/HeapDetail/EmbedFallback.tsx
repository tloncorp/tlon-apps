import LinkIcon from '@/components/icons/LinkIcon';
import React from 'react';

export default function EmbedFallback({ url }: { url: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <LinkIcon className="mb-3 h-16 w-16 text-gray-300" />
      <p className="text-gray-60 mb-2 font-semibold">
        Content was unable to be sourced or you have disabled remote content.
      </p>
      <a href={url} target="_blank" rel="noreferrer" className="button">
        View Link
      </a>
    </div>
  );
}
