import React from 'react';
import { IconProps } from './icon';

export default function ShareIcon({ className }: IconProps) {
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
        d="M9 3.414V10a1 1 0 1 1-2 0V3.414L4.707 5.707a1 1 0 0 1-1.414-1.414l4-4a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1-1.414 1.414L9 3.414ZM2 10a1 1 0 1 0-2 0v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3a1 1 0 1 0-2 0v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3Z"
        className="fill-current"
      />
    </svg>
  );
}
