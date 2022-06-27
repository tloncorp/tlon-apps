import React from 'react';
import { IconProps } from './icon';

export default function XIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="stroke-current"
        d="m12 12 6-6m-6 6L6 6m6 6-6 6m6-6 6 6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
