import React from 'react';

import { IconProps } from './icon';

export default function SmileIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        d="M16 10V7"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10V7"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 16.0002C14 18 10 18 8 16"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
