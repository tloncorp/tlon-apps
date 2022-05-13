import React from 'react';
import { IconProps } from './icon';

export default function ElipsisCircleIcon({ className }: IconProps) {
  // The elipsis here is transparent, waiting on a new icon from @urcades
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
        d="M9 18A9 9 0 1 1 9 0a9 9 0 0 1 0 18ZM6 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        className="fill-current"
      />
    </svg>
  );
}
