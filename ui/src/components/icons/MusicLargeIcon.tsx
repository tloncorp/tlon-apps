import React from 'react';
import { IconProps } from './icon';

export default function MusicLargeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M56 8a4.062 4.062 0 0 0-1.478-3.153 3.721 3.721 0 0 0-3.294-.728l-30.72 8C18.8 12.566 17.6 14.165 17.6 16v26.055a8.388 8.388 0 0 0-.96-.055C11.868 42 8 46.03 8 51s3.868 9 8.64 9c4.77 0 8.636-4.026 8.64-8.993V19.123l23.04-6v20.932a8.388 8.388 0 0 0-.96-.055c-4.772 0-8.64 4.03-8.64 9s3.868 9 8.64 9c4.769 0 8.636-4.026 8.64-8.993V8Z"
        className="fill-current"
      />
    </svg>
  );
}
