import React from 'react';
import { IconProps } from './icon';

export default function CopyIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.5 21A2.5 2.5 0 0 1 9 18.5v-2H7A2.5 2.5 0 0 1 4.5 14V5.5A2.5 2.5 0 0 1 7 3h7a2.5 2.5 0 0 1 2.5 2.5v2h2A2.5 2.5 0 0 1 21 10v8.5a2.5 2.5 0 0 1-2.5 2.5h-7Zm5-10.5H18V18h-6v-1.5h2a2.5 2.5 0 0 0 2.5-2.5v-3.5ZM7.5 6v7.5h6V6h-6Z"
        className="fill-current"
      />
    </svg>
  );
}
