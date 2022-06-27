import React from 'react';
import { IconProps } from './icon';

export default function X16Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
    >
      <path
        className="stroke-current"
        d="m8 8 4-4M8 8 4 4m4 4-4 4m4-4 4 4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
