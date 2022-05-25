import React from 'react';
import { IconProps } from './icon';

export default function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="stroke-current"
        d="m6 12 3.64645 3.6464c.19526.1953.51185.1953.70715 0L18 8"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
