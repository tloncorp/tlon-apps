import React from 'react';
import { IconProps } from './icon';

export default function AddIcon16({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
    >
      <path
        className="stroke-current"
        d="M3 8h10M8 3v10"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
