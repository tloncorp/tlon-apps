import React from 'react';
import { IconProps } from './icon';

export default function AsteriskIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 6L10 2M6 6L2 2M6 6L2 10M6 6L10 10M6 6H11M6 6V1M6 6H1M6 6V11"
        stroke="#008EFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
