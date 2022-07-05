import React from 'react';
import { IconProps } from '@/components/icons/icon';

export default function LockIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 4.333C4 2.943 4.992 2 6 2s2 .943 2 2.333V6H4V4.333ZM10 6V4.333C10 2.042 8.306 0 6 0S2 2.042 2 4.333V6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm-8 6V8h8v4H2Z"
        className="fill-current"
      />
    </svg>
  );
}
