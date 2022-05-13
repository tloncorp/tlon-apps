import React from 'react';
import { IconProps } from './icon';

export default function AddIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="stroke-current"
        d="M4 12h16m-8-8v16"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
