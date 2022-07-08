import React from 'react';
import { IconProps } from '@/components/icons/icon';

export default function LockIcon({ className }: IconProps) {
  return (
    <svg
      fill="none"
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 9.333C10 7.943 10.992 7 12 7s2 .943 2 2.333V11h-4V9.333ZM16 11V9.333C16 7.042 14.306 5 12 5S8 7.042 8 9.333V11a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Zm-8 6v-4h8v4H8Z"
        className="fill-current"
      />
    </svg>
  );
}
