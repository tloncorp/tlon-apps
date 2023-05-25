import React from 'react';
import { IconProps } from './icon';

export default function BadgeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M7 5h10a1 1 0 0 1 1 1v9.004c-.823-1.089-2.15-1.538-3.973-1.543 1.645-.009 2.973-.864 2.973-3.23C17 7.85 15.657 7 14 7s-3 .852-3 3.23c0 2.367 1.328 3.222 2.972 3.231C10.672 13.47 8 14.933 8 19h9.015H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6Z"
        clipRule="evenodd"
      />
      <path
        className="stroke-current"
        strokeLinecap="square"
        strokeWidth="2"
        d="M2 11h6M5 7v8"
      />
      <path
        className="stroke-current"
        strokeLinecap="round"
        strokeWidth="2"
        d="M2 11h6M5 8v6"
      />
    </svg>
  );
}
