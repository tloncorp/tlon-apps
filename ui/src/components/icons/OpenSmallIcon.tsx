import React from 'react';
import { IconProps } from './icon';

export default function OpenSmallIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.897 2a1 1 0 1 0 0 2h2.483L6.374 8.006A1 1 0 1 0 7.788 9.42l4.006-4.006v2.483a1 1 0 1 0 2 0V3a1 1 0 0 0-1-1H7.897ZM4 4.632a1 1 0 0 0-2 0v6.562a2.6 2.6 0 0 0 2.6 2.6h6.97a1 1 0 1 0 0-2H4.6a.6.6 0 0 1-.6-.6V4.632Z"
        className="fill-current"
      />
    </svg>
  );
}
