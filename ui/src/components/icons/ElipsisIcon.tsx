import React from 'react';
import { IconProps } from './icon';

export default function ElipsisIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 16a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM2 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
        className="fill-current"
      />
    </svg>
  );
}
