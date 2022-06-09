import React from 'react';
import { IconProps } from './icon';

export default function AddIcon16({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
    >
      <path
        className="stroke-current"
        d="M1 6H11M6 1V11"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
