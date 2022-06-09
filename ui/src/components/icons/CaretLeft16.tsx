import React from 'react';
import { IconProps } from './icon';

export default function CaretLeft16({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="6"
      height="10"
      viewBox="0 0 6 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 9L1 5L5 1"
        stroke="#666666"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
