import React from 'react';
import { IconProps } from './icon';

export default function ExpandIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0 9a9 9 0 1 0 18 0A9 9 0 0 0 0 9Z" className="fill-current" />
      <path
        d="M10.333 5H13v2.667M7.667 13H5v-2.666"
        stroke="#333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
